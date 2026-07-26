import assert from 'node:assert/strict';
import { before, beforeEach, describe, test } from 'node:test';
import { loadSourceModule } from './helpers/vite-loader.mjs';

let RoomClient;

// ===== 假定时器：手动推进，记录已清除的句柄 =====
class FakeTimers {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.pending = new Map(); // id -> {fn, at}
  }

  setTimeout(fn, ms) {
    const id = this.nextId++;
    this.pending.set(id, { fn, at: this.now + ms });
    return id;
  }

  clearTimeout(handle) {
    this.pending.delete(handle);
  }

  /** 推进时间，触发到期回调（按到期先后） */
  advance(ms) {
    this.now += ms;
    for (;;) {
      const due = [...this.pending.entries()]
        .filter(([, t]) => t.at <= this.now)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.pending.delete(due[0]);
      due[1].fn();
    }
  }

  get pendingCount() {
    return this.pending.size;
  }
}

// ===== Fake WebSocket：由测试脚本驱动 open/message/close =====
class FakeSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    this.closeCalls = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    if (this.readyState === 3) return;
    this.readyState = 3;
    // 浏览器语义：close() 之后异步触发 onclose；测试里同步触发已足够
    this.onclose?.({ code: code ?? 1000, reason: reason ?? '' });
  }

  // —— 测试驱动接口 ——
  serverOpen() {
    this.readyState = 1;
    this.onopen?.({});
  }

  serverMessage(type, payload) {
    this.onmessage?.({ data: JSON.stringify({ type, payload }) });
  }

  serverClose(reason = '', code = 1006) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  serverError() {
    this.onerror?.({});
  }
}

function joinedPayload(overrides = {}) {
  return {
    connectionId: 'conn-1',
    roomId: 'room-1',
    revision: 0,
    participants: [],
    activityLog: [],
    ...overrides,
  };
}

function createHarness({ handlers = {}, reconnect, connectTimeoutMs } = {}) {
  const timers = new FakeTimers();
  const sockets = [];
  const events = [];
  const record = (name) => (payload) => events.push({ name, payload });

  const client = new RoomClient('ws://test.local/ws', {
    onJoined: record('joined'),
    onError: record('error'),
    onDisconnected: record('disconnected'),
    onReconnecting: record('reconnecting'),
    ...handlers,
  }, {
    timers,
    random: () => 0.5, // 无抖动，退避时间确定
    connectTimeoutMs: connectTimeoutMs ?? 5000,
    reconnect: { baseDelayMs: 1000, maxDelayMs: 8000, maxAttempts: 3, jitterRatio: 0.3, ...reconnect },
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
  });

  return { client, timers, sockets, events };
}

const joinOptions = { roomId: 'room-1', user: { id: 'u1', name: '测试', color: '#fff' }, isHost: false };

/** 冲刷微任务：重连续排走 Promise.catch，需要在推进假定时器前先让它执行 */
const flush = () => new Promise((resolve) => setImmediate(resolve));

before(async () => {
  globalThis.window = {
    electronAPI: undefined,
    location: { protocol: 'http:' },
  };
  ({ RoomClient } = await loadSourceModule('/src/utils/collaboration.ts'));
});

beforeEach(() => {
  globalThis.window = {
    electronAPI: undefined,
    location: { protocol: 'http:' },
  };
});

describe('RoomClient connect 生命周期', () => {
  test('joined 回执后 connect resolve，且发送了 join 帧', async () => {
    const { client, sockets } = createHarness();
    const promise = client.connect(joinOptions);

    sockets[0].serverOpen();
    assert.deepEqual(sockets[0].sent[0], { type: 'join', payload: joinOptions });

    sockets[0].serverMessage('joined', joinedPayload());
    const result = await promise;
    assert.equal(result.connectionId, 'conn-1');
    assert.equal(client.connectionId, 'conn-1');
  });

  test('joined 之前连接被关闭 → connect reject（原实现会永久挂起）', async () => {
    const { client, sockets } = createHarness();
    const promise = client.connect(joinOptions);
    sockets[0].serverClose('server going away');
    await assert.rejects(promise, /server going away/);
  });

  test('joined 之前 onerror（继而 close）→ connect reject 且 onError 通知一次', async () => {
    const { client, sockets, events } = createHarness();
    const promise = client.connect(joinOptions);
    // 浏览器语义：error 事件后必跟 close 事件
    sockets[0].serverError();
    sockets[0].serverClose('');
    await assert.rejects(promise, /Connection closed before join completed/);
    assert.equal(events.filter((e) => e.name === 'error').length, 1);
  });

  test('服务器一直不回 joined → 超时 reject 并关闭半开连接', async () => {
    const { client, timers, sockets } = createHarness({ connectTimeoutMs: 5000 });
    const promise = client.connect(joinOptions);
    sockets[0].serverOpen();

    timers.advance(5000);
    await assert.rejects(promise, /连接超时/);
    assert.equal(sockets[0].closeCalls.length, 1);
  });

  test('room:error → connect reject 且 onError 触发', async () => {
    const { client, sockets, events } = createHarness();
    const promise = client.connect(joinOptions);
    sockets[0].serverOpen();
    sockets[0].serverMessage('room:error', { message: 'Room "x" does not exist on this server.' });
    await assert.rejects(promise, /does not exist/);
    assert.ok(events.some((e) => e.name === 'error'));
  });

  test('首次连接失败不自动重连、不触发 onDisconnected', async () => {
    const { client, timers, sockets, events } = createHarness();
    const promise = client.connect(joinOptions);
    sockets[0].serverClose('refused');
    await assert.rejects(promise);

    timers.advance(60000);
    assert.equal(sockets.length, 1);
    assert.equal(events.filter((e) => e.name === 'disconnected').length, 0);
    assert.equal(events.filter((e) => e.name === 'reconnecting').length, 0);
  });
});

describe('RoomClient 自动重连', () => {
  async function establish(harness) {
    const promise = harness.client.connect(joinOptions);
    harness.sockets[0].serverOpen();
    harness.sockets[0].serverMessage('joined', joinedPayload());
    await promise;
  }

  test('异常断线 → 指数退避重连 → 成功后计数重置', async () => {
    const harness = createHarness();
    const { client, timers, sockets, events } = harness;
    await establish(harness);

    // 异常断开（非用户操作）
    sockets[0].serverClose('network lost');
    assert.equal(events.filter((e) => e.name === 'reconnecting').length, 1);
    assert.equal(events.at(-1).payload.attempt, 1);
    assert.equal(events.at(-1).payload.delayMs, 1000); // base 1000ms、无抖动

    // 第 1 次重连成功
    timers.advance(1000);
    assert.equal(sockets.length, 2);
    sockets[1].serverOpen();
    sockets[1].serverMessage('joined', joinedPayload({ connectionId: 'conn-2' }));
    assert.equal(client.connectionId, 'conn-2');
    assert.equal(events.filter((e) => e.name === 'joined').length, 2);

    // 再次断开：attempt 应从 1 重新开始（成功后重置）
    sockets[1].serverClose('network lost again');
    const reconnects = events.filter((e) => e.name === 'reconnecting');
    assert.equal(reconnects.at(-1).payload.attempt, 1);
    // 全程未触发最终 onDisconnected
    assert.equal(events.filter((e) => e.name === 'disconnected').length, 0);
  });

  test('重连屡次失败 → 退避递增 → 次数用尽后 onDisconnected 恰好一次', async () => {
    const harness = createHarness({ reconnect: { maxAttempts: 3 } });
    const { timers, sockets, events } = harness;
    await establish(harness);

    sockets[0].serverClose('gone');

    // attempt1: 1000ms
    timers.advance(1000);
    assert.equal(sockets.length, 2);
    sockets[1].serverClose('still down');
    await flush();

    // attempt2: 2000ms
    timers.advance(2000);
    assert.equal(sockets.length, 3);
    sockets[2].serverClose('still down');
    await flush();

    // attempt3: 4000ms
    timers.advance(4000);
    assert.equal(sockets.length, 4);
    sockets[3].serverClose('still down');
    await flush();

    const reconnects = events.filter((e) => e.name === 'reconnecting');
    assert.deepEqual(reconnects.map((e) => e.payload.attempt), [1, 2, 3]);
    assert.deepEqual(reconnects.map((e) => e.payload.delayMs), [1000, 2000, 4000]);

    const finals = events.filter((e) => e.name === 'disconnected');
    assert.equal(finals.length, 1);

    // 之后不再有任何重连计划
    timers.advance(60000);
    assert.equal(sockets.length, 4);
  });

  test('重连等待期间手动 disconnect → 取消定时器，不再建立新连接', async () => {
    const harness = createHarness();
    const { client, timers, sockets, events } = harness;
    await establish(harness);

    sockets[0].serverClose('lost');
    assert.equal(events.filter((e) => e.name === 'reconnecting').length, 1);

    client.disconnect();
    assert.equal(timers.pendingCount, 0);

    timers.advance(60000);
    assert.equal(sockets.length, 1);
    assert.equal(events.filter((e) => e.name === 'disconnected').length, 0);
  });

  test('重连时通过 getLatestSnapshot 刷新房主快照', async () => {
    let latest = { docs: [{ id: 'new-doc' }] };
    const harness = createHarness({ handlers: { getLatestSnapshot: () => latest } });
    const { client, timers, sockets } = harness;

    const hostOptions = { ...joinOptions, isHost: true, snapshot: { docs: [] } };
    const promise = client.connect(hostOptions);
    sockets[0].serverOpen();
    sockets[0].serverMessage('joined', joinedPayload());
    await promise;

    sockets[0].serverClose('server restart');
    timers.advance(1000);
    sockets[1].serverOpen();

    assert.deepEqual(sockets[1].sent[0].payload.snapshot, { docs: [{ id: 'new-doc' }] });
  });
});

describe('RoomClient 手动退出与重复调用防护', () => {
  test('手动 disconnect：关闭 socket、不触发 onDisconnected，挂起的 connect 被 reject', async () => {
    const { client, sockets, events } = createHarness();
    const promise = client.connect(joinOptions);
    sockets[0].serverOpen();

    client.disconnect();
    await assert.rejects(promise, /已主动断开/);
    assert.equal(sockets[0].closeCalls.length, 1);
    assert.equal(sockets[0].closeCalls[0].code, 1000);
    assert.equal(events.filter((e) => e.name === 'disconnected').length, 0);
  });

  test('重复 connect：旧 socket 被静默替换，旧连接迟到事件不产生回调', async () => {
    const { client, sockets, events } = createHarness();
    const first = client.connect(joinOptions);
    const second = client.connect(joinOptions);

    await assert.rejects(first, /已被新的连接请求取代/);
    assert.equal(sockets.length, 2);

    // 旧 socket 的迟到事件应被代号机制丢弃
    sockets[0].serverOpen();
    sockets[0].serverMessage('joined', joinedPayload({ connectionId: 'stale' }));
    sockets[0].serverClose('stale close');
    assert.equal(events.filter((e) => e.name === 'joined').length, 0);
    assert.equal(events.filter((e) => e.name === 'disconnected').length, 0);

    sockets[1].serverOpen();
    sockets[1].serverMessage('joined', joinedPayload({ connectionId: 'fresh' }));
    const result = await second;
    assert.equal(result.connectionId, 'fresh');
  });

  test('断线后的迟到 close 不会产生第二次 disconnected 回调', async () => {
    const harness = createHarness({ reconnect: { maxAttempts: 1 } });
    const { timers, sockets, events } = harness;
    const promise = harness.client.connect(joinOptions);
    sockets[0].serverOpen();
    sockets[0].serverMessage('joined', joinedPayload());
    await promise;

    sockets[0].serverClose('lost');
    timers.advance(1000);
    sockets[1].serverClose('still down'); // 唯一一次重连失败 → 最终 disconnected
    await flush();

    // 迟到的重复 close（如底层实现重复触发）不应再引发回调
    sockets[0].onclose?.({ code: 1006, reason: 'dup' });
    sockets[1].onclose?.({ code: 1006, reason: 'dup' });
    await flush();

    assert.equal(events.filter((e) => e.name === 'disconnected').length, 1);
  });
});
