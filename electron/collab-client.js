const crypto = require('crypto');
const { SimpleWebSocketClient } = require('./simple-ws-client');

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

class MainProcessCollabClientManager {
  constructor() {
    this.clients = new Map();
  }

  connect(sender, { url, joinPayload }) {
    const clientId = `proxy_${crypto.randomUUID()}`;
    const client = {
      id: clientId,
      sender,
      url,
      joinPayload,
      socket: null,
      manualClose: false,
    };

    this.clients.set(clientId, client);

    setImmediate(() => {
      this.openClient(client);
    });

    return { clientId };
  }

  openClient(client) {
    if (!this.clients.has(client.id)) return;

    let socket;
    try {
      socket = new SimpleWebSocketClient(client.url);
    } catch (error) {
      this.emit(client, 'room:error', {
        message: error instanceof Error ? error.message : String(error),
      });
      this.cleanup(client.id);
      return;
    }

    client.socket = socket;

    socket.onopen = () => {
      this.send(client.id, 'join', client.joinPayload);
    };

    socket.onmessage = (event) => {
      const message = safeJsonParse(String(event.data));
      if (!message || typeof message.type !== 'string') {
        this.emit(client, 'room:error', { message: 'Invalid message payload from room server.' });
        return;
      }

      this.emit(client, message.type, message.payload);
    };

    socket.onerror = () => {
      this.emit(client, 'room:error', { message: 'Unable to connect to room server.' });
    };

    socket.onclose = (event) => {
      if (!client.manualClose) {
        this.emit(client, 'disconnected', {
          reason: event.reason || 'Connection closed.',
          code: event.code,
        });
      }
      this.cleanup(client.id);
    };
  }

  send(clientId, type, payload) {
    const client = this.clients.get(clientId);
    if (!client || !client.socket || client.socket.readyState !== SimpleWebSocketClient.OPEN) {
      return false;
    }

    client.socket.send(JSON.stringify({ type, payload }));
    return true;
  }

  disconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.manualClose = true;
    if (client.socket && client.socket.readyState < SimpleWebSocketClient.CLOSING) {
      client.socket.close(1000, 'Client disconnect');
    } else {
      this.cleanup(clientId);
    }

    return true;
  }

  emit(client, type, payload) {
    if (!client.sender || client.sender.isDestroyed()) return;
    client.sender.send('collab:proxy-event', {
      clientId: client.id,
      type,
      payload,
    });
  }

  cleanup(clientId) {
    this.clients.delete(clientId);
  }
}

module.exports = {
  MainProcessCollabClientManager,
};
