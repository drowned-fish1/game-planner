const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 17887;
const DISCOVERY_REQUEST = 'GAME_PLANNER_DISCOVER_V1';

function ipv4ToInt(ip) {
  return ip.split('.').reduce((value, part) => ((value << 8) + Number(part)) >>> 0, 0);
}

function intToIpv4(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function getLanInterfaces() {
  const interfaces = [];
  const networkMap = os.networkInterfaces();

  Object.values(networkMap).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.family !== 'IPv4' || entry.internal || !entry.netmask) return;
      const addressInt = ipv4ToInt(entry.address);
      const maskInt = ipv4ToInt(entry.netmask);
      const broadcast = intToIpv4((addressInt | (~maskInt >>> 0)) >>> 0);

      interfaces.push({
        address: entry.address,
        broadcast,
      });
    });
  });

  return interfaces;
}

class LanDiscoveryService {
  constructor(getPayload) {
    this.getPayload = getPayload;
    this.server = null;
  }

  start() {
    if (this.server) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const server = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      server.on('error', reject);
      server.on('message', (message, remote) => {
        if (String(message) !== DISCOVERY_REQUEST) return;

        const payload = JSON.stringify(this.getPayload());
        server.send(Buffer.from(payload), remote.port, remote.address);
      });

      server.bind(DISCOVERY_PORT, () => {
        server.off('error', reject);
        server.setBroadcast(true);
        this.server = server;
        resolve();
      });
    });
  }

  discover(timeoutMs = 900) {
    const interfaces = getLanInterfaces();
    if (interfaces.length === 0) {
      return Promise.resolve([]);
    }

    const localAddresses = new Set(interfaces.map((entry) => entry.address));

    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const discovered = new Map();

      socket.on('message', (message, remote) => {
        const remoteAddress = remote.address;
        if (localAddresses.has(remoteAddress)) return;

        try {
          const parsed = JSON.parse(String(message));
          discovered.set(remoteAddress, {
            deviceName: parsed.deviceName || remoteAddress,
            address: remoteAddress,
            service: parsed.service || null,
            rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
          });
        } catch (error) {
          // ignore malformed responses
        }
      });

      socket.bind(() => {
        socket.setBroadcast(true);
        interfaces.forEach((entry) => {
          socket.send(Buffer.from(DISCOVERY_REQUEST), DISCOVERY_PORT, entry.broadcast);
        });
      });

      setTimeout(() => {
        socket.close();
        resolve(Array.from(discovered.values()));
      }, timeoutMs);
    });
  }
}

module.exports = {
  LanDiscoveryService,
};
