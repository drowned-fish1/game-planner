const crypto = require('crypto');
const net = require('net');
const tls = require('tls');

function encodeClientFrame(payload) {
  const data = Buffer.from(payload);
  const length = data.length;
  const mask = crypto.randomBytes(4);

  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  header[0] = 0x81;
  const masked = Buffer.alloc(length);
  for (let index = 0; index < length; index += 1) {
    masked[index] = data[index] ^ mask[index % 4];
  }

  return Buffer.concat([header, mask, masked]);
}

function decodeFrames(state) {
  const events = [];

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
      events.push({ type: 'close' });
      continue;
    }

    if (opcode === 0x9) {
      events.push({ type: 'ping' });
      continue;
    }

    if (opcode === 0xA) {
      continue;
    }

    if (opcode === 0x1) {
      events.push({ type: 'text', payload: payload.toString('utf8') });
    }
  }

  return events;
}

class SimpleWebSocketClient {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = new URL(url);
    this.readyState = SimpleWebSocketClient.CONNECTING;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.handshakeComplete = false;

    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;

    this.open();
  }

  open() {
    const isSecure = this.url.protocol === 'wss:';
    const port = Number(this.url.port || (isSecure ? 443 : 80));
    const connectOptions = {
      host: this.url.hostname,
      port,
      servername: this.url.hostname,
    };

    const socket = isSecure
      ? tls.connect(connectOptions)
      : net.connect(connectOptions);

    this.socket = socket;

    socket.on('connect', () => {
      const key = crypto.randomBytes(16).toString('base64');
      const pathname = `${this.url.pathname || '/'}${this.url.search || ''}`;
      socket.write([
        `GET ${pathname} HTTP/1.1`,
        `Host: ${this.url.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '\r\n',
      ].join('\r\n'));
    });

    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);

      if (!this.handshakeComplete) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const headerText = this.buffer.subarray(0, headerEnd).toString('utf8');
        if (!headerText.includes('101 Switching Protocols')) {
          this.emitError(new Error(`WebSocket handshake failed: ${headerText.split('\r\n')[0] || 'unknown response'}`));
          this.close();
          return;
        }

        this.handshakeComplete = true;
        this.readyState = SimpleWebSocketClient.OPEN;
        this.buffer = this.buffer.subarray(headerEnd + 4);
        this.onopen?.();
      }

      const events = decodeFrames(this);
      events.forEach((event) => {
        if (event.type === 'ping') {
          socket.write(Buffer.from([0x8a, 0x00]));
          return;
        }

        if (event.type === 'close') {
          this.close();
          return;
        }

        if (event.type === 'text') {
          this.onmessage?.({ data: event.payload });
        }
      });
    });

    socket.on('error', (error) => {
      this.emitError(error);
    });

    socket.on('close', () => {
      const wasClosedAlready = this.readyState === SimpleWebSocketClient.CLOSED;
      this.readyState = SimpleWebSocketClient.CLOSED;
      if (!wasClosedAlready) {
        this.onclose?.({ code: 1006, reason: 'Socket closed' });
      }
    });
  }

  send(payload) {
    if (!this.socket || this.readyState !== SimpleWebSocketClient.OPEN) {
      throw new Error('WebSocket is not open');
    }

    this.socket.write(encodeClientFrame(payload));
  }

  close() {
    if (!this.socket || this.readyState >= SimpleWebSocketClient.CLOSING) return;
    this.readyState = SimpleWebSocketClient.CLOSING;
    this.socket.end(Buffer.from([0x88, 0x00]));
  }

  emitError(error) {
    this.onerror?.(error);
  }
}

module.exports = {
  SimpleWebSocketClient,
};
