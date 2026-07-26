import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { loadSourceModule } from './helpers/vite-loader.mjs';

let mod;

before(async () => {
  globalThis.window = {
    electronAPI: undefined,
    location: { protocol: 'http:' },
  };
  mod = await loadSourceModule('/src/utils/roomConnection.ts');
});

describe('computeReconnectDelay', () => {
  const policy = { baseDelayMs: 1000, maxDelayMs: 15000, maxAttempts: 6, jitterRatio: 0.3 };
  const noJitter = () => 0.5; // (0.5*2-1)*ratio = 0 → 无抖动

  test('exponential growth from base delay', () => {
    assert.equal(mod.computeReconnectDelay(1, policy, noJitter), 1000);
    assert.equal(mod.computeReconnectDelay(2, policy, noJitter), 2000);
    assert.equal(mod.computeReconnectDelay(3, policy, noJitter), 4000);
    assert.equal(mod.computeReconnectDelay(4, policy, noJitter), 8000);
  });

  test('caps at maxDelayMs', () => {
    assert.equal(mod.computeReconnectDelay(5, policy, noJitter), 15000);
    assert.equal(mod.computeReconnectDelay(50, policy, noJitter), 15000);
  });

  test('jitter stays inside ±jitterRatio and never negative', () => {
    assert.equal(mod.computeReconnectDelay(1, policy, () => 0), 700); // 1000 * (1-0.3)
    assert.equal(mod.computeReconnectDelay(1, policy, () => 1), 1300); // 1000 * (1+0.3)
    const extreme = { ...policy, jitterRatio: 1 };
    assert.equal(mod.computeReconnectDelay(1, extreme, () => 0), 0);
  });
});

describe('shouldScheduleReconnect', () => {
  const policy = { baseDelayMs: 1000, maxDelayMs: 15000, maxAttempts: 3, jitterRatio: 0 };

  test('never reconnects after manual close', () => {
    assert.equal(
      mod.shouldScheduleReconnect({ closedByUser: true, everConnected: true, attemptsMade: 0 }, policy),
      false,
    );
  });

  test('does not auto-retry when the first connect never succeeded', () => {
    assert.equal(
      mod.shouldScheduleReconnect({ closedByUser: false, everConnected: false, attemptsMade: 0 }, policy),
      false,
    );
  });

  test('stops after maxAttempts', () => {
    assert.equal(
      mod.shouldScheduleReconnect({ closedByUser: false, everConnected: true, attemptsMade: 2 }, policy),
      true,
    );
    assert.equal(
      mod.shouldScheduleReconnect({ closedByUser: false, everConnected: true, attemptsMade: 3 }, policy),
      false,
    );
  });
});

describe('parseRoomMessage', () => {
  test('parses a valid frame', () => {
    assert.deepEqual(
      mod.parseRoomMessage(JSON.stringify({ type: 'joined', payload: { a: 1 } })),
      { type: 'joined', payload: { a: 1 } },
    );
  });

  test('rejects bad frames without throwing', () => {
    assert.equal(mod.parseRoomMessage('not-json{'), null);
    assert.equal(mod.parseRoomMessage(JSON.stringify(null)), null);
    assert.equal(mod.parseRoomMessage(JSON.stringify({ payload: 1 })), null);
    assert.equal(mod.parseRoomMessage(JSON.stringify({ type: 42 })), null);
    assert.equal(mod.parseRoomMessage(123), null);
  });
});
