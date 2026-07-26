import assert from 'node:assert/strict';
import { before, beforeEach, describe, test } from 'node:test';
import { loadSourceModule } from './helpers/vite-loader.mjs';

let normalizeRoomServerUrl;

before(async () => {
  ({ normalizeRoomServerUrl } = await loadSourceModule('/src/utils/collaboration.ts'));
});

beforeEach(() => {
  globalThis.window = {
    electronAPI: undefined,
    location: { protocol: 'http:' },
  };
});

describe('normalizeRoomServerUrl', () => {
  test('trims input and supplies the default websocket protocol and path', () => {
    assert.equal(normalizeRoomServerUrl('  192.168.1.8:4173  '), 'ws://192.168.1.8:4173/ws');
    assert.equal(normalizeRoomServerUrl('   '), '');
  });

  test('converts HTTP protocols and service endpoints to websocket URLs', () => {
    assert.equal(normalizeRoomServerUrl('http://example.com:8080/info'), 'ws://example.com:8080/ws');
    assert.equal(normalizeRoomServerUrl('https://example.com/health'), 'wss://example.com/ws');
  });

  test('preserves a custom path while removing query parameters and fragments', () => {
    assert.equal(
      normalizeRoomServerUrl('ws://example.com/rooms/socket?token=secret#debug'),
      'ws://example.com/rooms/socket',
    );
  });

  test('upgrades insecure websocket URLs on an HTTPS page', () => {
    window.location.protocol = 'https:';
    assert.equal(normalizeRoomServerUrl('ws://example.com'), 'wss://example.com/ws');
  });

  test('keeps direct ws URLs when the Electron proxy is available', () => {
    window.location.protocol = 'https:';
    window.electronAPI = { invoke() {} };
    assert.equal(normalizeRoomServerUrl('ws://127.0.0.1:4173'), 'ws://127.0.0.1:4173/ws');
  });
});
