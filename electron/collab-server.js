const crypto = require('crypto');
const http = require('http');
const os = require('os');

const DEFAULT_START_PORT = 17888;
const MAX_PORT_ATTEMPTS = 20;
const MAX_ACTIVITY_LOG = 30;
const WS_PATH = '/ws';

function buildServiceUrls(address, port) {
  const host = address.includes(':') ? `[${address}]` : address;
  return {
    httpUrl: `http://${host}:${port}`,
    wsUrl: `ws://${host}:${port}${WS_PATH}`,
  };
}

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];

  Object.values(nets).forEach((networks) => {
    (networks || []).forEach((net) => {
      if (!net || net.family !== 'IPv4' || net.internal) return;
      addresses.push(net.address);
    });
  });

  return Array.from(new Set(['127.0.0.1', ...addresses]));
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function encodeFrame(payload) {
  const data = Buffer.from(payload);
  const length = data.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), data]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, data]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, data]);
}

function decodeFrames(state) {
  const messages = [];

  while (state.buffer.length >= 2) {
    const firstByte = state.buffer[0];
    const secondByte = state.buffer[1];
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      if (state.buffer.length < offset + 2) break;
      payloadLength = state.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (state.buffer.length < offset + 8) break;
      payloadLength = Number(state.buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    const maskLength = isMasked ? 4 : 0;
    if (state.buffer.length < offset + maskLength + payloadLength) break;

    let payload = state.buffer.subarray(offset + maskLength, offset + maskLength + payloadLength);

    if (isMasked) {
      const mask = state.buffer.subarray(offset, offset + 4);
      const decoded = Buffer.alloc(payloadLength);
      for (let index = 0; index < payloadLength; index += 1) {
        decoded[index] = payload[index] ^ mask[index % 4];
      }
      payload = decoded;
    }

    state.buffer = state.buffer.subarray(offset + maskLength + payloadLength);

    if (opcode === 0x8) {
      messages.push({ type: 'close' });
      continue;
    }

    if (opcode === 0x9) {
      messages.push({ type: 'ping' });
      continue;
    }

    if (opcode === 0x1) {
      messages.push({ type: 'text', payload: payload.toString('utf8') });
    }
  }

  return messages;
}

class CollabServer {
  constructor() {
    this.port = null;
    this.server = null;
    this.rooms = new Map();
    this.connections = new Map();
  }

  async start() {
    if (this.server) {
      return this.getServiceInfo();
    }

    let lastError = null;
    for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
      const port = DEFAULT_START_PORT + attempt;
      try {
        await this.listen(port);
        this.port = port;
        return this.getServiceInfo();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Unable to start collaboration server');
  }

  listen(port) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this.handleHttpRequest(req, res));

      server.on('upgrade', (req, socket) => this.handleUpgrade(req, socket));
      server.on('error', reject);
      server.listen(port, '0.0.0.0', () => {
        server.off('error', reject);
        this.server = server;
        resolve();
      });
    });
  }

  handleHttpRequest(req, res) {
    if (!req.url || req.url === '/' || req.url === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        service: this.getServiceInfo(),
        rooms: Array.from(this.rooms.values()).map((room) => ({
          id: room.id,
          participantCount: room.participants.size,
          revision: room.revision,
          updatedAt: room.updatedAt,
          projectName: room.projectName || '',
        })),
      }));
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, port: this.port }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  handleUpgrade(req, socket) {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname !== WS_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, 'binary')
      .digest('base64');

    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n',
    ].join('\r\n'));
    socket.setNoDelay(true);

    const connection = {
      id: generateId('conn'),
      socket,
      buffer: Buffer.alloc(0),
      roomId: null,
      user: null,
    };

    this.connections.set(connection.id, connection);

    socket.on('data', (chunk) => this.handleSocketData(connection, chunk));
    socket.on('close', () => this.handleDisconnect(connection));
    socket.on('error', () => this.handleDisconnect(connection));
  }

  handleSocketData(connection, chunk) {
    connection.buffer = Buffer.concat([connection.buffer, chunk]);
    const events = decodeFrames(connection);

    events.forEach((event) => {
      if (event.type === 'close') {
        connection.socket.end();
        return;
      }

      if (event.type === 'ping') {
        connection.socket.write(Buffer.from([0x8a, 0x00]));
        return;
      }

      if (event.type === 'text') {
        const message = safeJsonParse(event.payload);
        if (!message || typeof message.type !== 'string') {
          this.send(connection, 'room:error', { message: 'Invalid message payload' });
          return;
        }

        this.handleMessage(connection, message.type, message.payload || {});
      }
    });
  }

  handleMessage(connection, type, payload) {
    switch (type) {
      case 'join':
        this.handleJoin(connection, payload);
        break;
      case 'content:update':
        this.handleContentUpdate(connection, payload);
        break;
      case 'presence:update':
        this.handlePresenceUpdate(connection, payload);
        break;
      case 'activity:event':
        this.handleActivityEvent(connection, payload);
        break;
      case 'ping':
        this.send(connection, 'pong', { now: Date.now() });
        break;
      default:
        this.send(connection, 'room:error', { message: `Unsupported message type: ${type}` });
    }
  }

  ensureRoom(connection) {
    return connection.roomId ? this.rooms.get(connection.roomId) || null : null;
  }

  handleJoin(connection, payload) {
    const roomId = String(payload.roomId || '').trim();
    const user = payload.user || {};
    const displayName = String(user.name || '').trim();

    if (!roomId) {
      this.send(connection, 'room:error', { message: 'Room ID is required' });
      return;
    }

    if (!displayName) {
      this.send(connection, 'room:error', { message: 'Display name is required' });
      return;
    }

    let room = this.rooms.get(roomId);
    const snapshot = payload.snapshot;

    if (!room) {
      if (!snapshot) {
        this.send(connection, 'room:error', { message: `Room "${roomId}" does not exist on this server` });
        return;
      }

      room = {
        id: roomId,
        revision: 0,
        snapshot,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectId: payload.projectId || null,
        projectName: payload.projectName || '',
        participants: new Map(),
        activityLog: [],
      };
      this.rooms.set(roomId, room);
    } else if (!room.snapshot && snapshot) {
      room.snapshot = snapshot;
    }

    connection.roomId = roomId;
    connection.user = {
      id: String(user.id || generateId('user')),
      name: displayName,
      color: String(user.color || '#10b981'),
      isHost: Boolean(payload.isHost),
    };

    room.participants.set(connection.id, {
      connectionId: connection.id,
      userId: connection.user.id,
      name: connection.user.name,
      color: connection.user.color,
      isHost: connection.user.isHost,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      presence: {
        activeModule: payload.activeModule || 'team',
        status: payload.status || '在线',
        focusedItemId: payload.focusedItemId || null,
        updatedAt: Date.now(),
      },
    });

    this.send(connection, 'joined', {
      connectionId: connection.id,
      roomId: room.id,
      revision: room.revision,
      snapshot: room.snapshot,
      participants: this.getParticipantList(room),
      activityLog: room.activityLog,
      projectName: room.projectName,
      projectId: room.projectId,
      service: this.getServiceInfo(),
    });

    this.pushActivity(room, {
      actorId: connection.id,
      actorName: connection.user.name,
      color: connection.user.color,
      module: 'team',
      kind: 'join',
      message: `${connection.user.name} 已加入房间`,
    });

    this.broadcastPresence(room);
  }

  handleContentUpdate(connection, payload) {
    const room = this.ensureRoom(connection);
    if (!room) return;

    room.snapshot = payload.snapshot;
    room.revision += 1;
    room.updatedAt = Date.now();

    const participant = room.participants.get(connection.id);
    if (participant) {
      participant.lastSeen = Date.now();
      participant.presence = {
        ...participant.presence,
        activeModule: payload.activeModule || participant.presence.activeModule,
        status: payload.status || participant.presence.status,
        focusedItemId: payload.focusedItemId ?? participant.presence.focusedItemId,
        updatedAt: Date.now(),
      };
    }

    this.broadcast(room, 'room:update-content', {
      snapshot: room.snapshot,
      revision: room.revision,
      actorId: connection.id,
      updatedAt: room.updatedAt,
    });

    this.broadcastPresence(room);
  }

  handlePresenceUpdate(connection, payload) {
    const room = this.ensureRoom(connection);
    if (!room) return;

    const participant = room.participants.get(connection.id);
    if (!participant) return;

    participant.lastSeen = Date.now();
    participant.presence = {
      activeModule: payload.activeModule || participant.presence.activeModule,
      status: payload.status || participant.presence.status,
      focusedItemId: payload.focusedItemId ?? null,
      updatedAt: Date.now(),
    };

    this.broadcastPresence(room);
  }

  handleActivityEvent(connection, payload) {
    const room = this.ensureRoom(connection);
    if (!room || !connection.user) return;

    const participant = room.participants.get(connection.id);
    if (participant) {
      participant.lastSeen = Date.now();
      participant.presence = {
        activeModule: payload.module || participant.presence.activeModule,
        status: payload.status || payload.message || participant.presence.status,
        focusedItemId: payload.focusedItemId ?? participant.presence.focusedItemId,
        updatedAt: Date.now(),
      };
    }

    this.pushActivity(room, {
      actorId: connection.id,
      actorName: connection.user.name,
      color: connection.user.color,
      module: payload.module || 'team',
      kind: payload.kind || 'activity',
      itemId: payload.itemId || null,
      message: payload.message || `${connection.user.name} 有新的操作`,
    });

    this.broadcastPresence(room);
  }

  handleDisconnect(connection) {
    if (!this.connections.has(connection.id)) return;
    this.connections.delete(connection.id);

    const room = this.ensureRoom(connection);
    if (!room || !connection.user) return;

    room.participants.delete(connection.id);

    this.pushActivity(room, {
      actorId: connection.id,
      actorName: connection.user.name,
      color: connection.user.color,
      module: 'team',
      kind: 'leave',
      message: `${connection.user.name} 已离开房间`,
    });

    this.broadcastPresence(room);
  }

  pushActivity(room, activity) {
    const entry = {
      id: generateId('activity'),
      createdAt: Date.now(),
      ...activity,
    };

    room.activityLog = [entry, ...room.activityLog].slice(0, MAX_ACTIVITY_LOG);
    this.broadcast(room, 'room:activity', entry);
  }

  getParticipantList(room) {
    return Array.from(room.participants.values())
      .map((participant) => ({
        connectionId: participant.connectionId,
        userId: participant.userId,
        name: participant.name,
        color: participant.color,
        isHost: participant.isHost,
        joinedAt: participant.joinedAt,
        lastSeen: participant.lastSeen,
        presence: participant.presence,
      }))
      .sort((left, right) => {
        if (left.isHost && !right.isHost) return -1;
        if (!left.isHost && right.isHost) return 1;
        return left.joinedAt - right.joinedAt;
      });
  }

  broadcastPresence(room) {
    this.broadcast(room, 'room:presence', {
      participants: this.getParticipantList(room),
      roomId: room.id,
      revision: room.revision,
      updatedAt: Date.now(),
    });
  }

  broadcast(room, type, payload) {
    room.participants.forEach((participant) => {
      const connection = this.connections.get(participant.connectionId);
      if (connection) {
        this.send(connection, type, payload);
      }
    });
  }

  send(connection, type, payload) {
    if (!connection.socket.destroyed) {
      connection.socket.write(encodeFrame(JSON.stringify({ type, payload })));
    }
  }

  getServiceInfo() {
    const addresses = getLanAddresses().map((address) => ({
      address,
      ...buildServiceUrls(address, this.port || DEFAULT_START_PORT),
    }));

    return {
      ready: Boolean(this.server && this.port),
      port: this.port,
      wsPath: WS_PATH,
      addresses,
    };
  }
}

module.exports = {
  CollabServer,
};
