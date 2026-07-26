// 真实联机验证：两个 RoomClient（真实 WebSocket）对接真实 CollabServer。
// 覆盖：加入 → 编辑同步 → 断网(服务器关闭) → 服务重启 → 自动恢复 → 主动退出。
// 用法：node scripts/verify-collab.mjs   （全部通过输出 ALL PASS，退出码 0）

import { createRequire } from 'node:module';
import { loadSourceModule } from '../tests/helpers/vite-loader.mjs';

const require = createRequire(import.meta.url);
const { CollabServer } = require('../electron/collab-server.js');

const PORT = 17999;
const URL = `ws://127.0.0.1:${PORT}/ws`;

// RoomClient 走浏览器路径（无 electronAPI），使用 Node 自带的全局 WebSocket
globalThis.window = { electronAPI: undefined, location: { protocol: 'http:' } };

const { RoomClient } = await loadSourceModule('/src/utils/collaboration.ts');

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✔' : '✖'} ${name}${extra ? ` — ${extra}` : ''}`);
}

function waitFor(predicate, timeoutMs, label) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve(undefined);
      if (Date.now() - started > timeoutMs) return reject(new Error(`timeout waiting for: ${label}`));
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function startServer() {
  const server = new CollabServer();
  await server.listen(PORT);
  server.port = PORT;
  return server;
}

async function stopServer(server) {
  for (const connection of server.connections.values()) {
    try { connection.socket.destroy(); } catch { /* ignore */ }
  }
  await new Promise((resolve) => server.server.close(resolve));
  server.server = null;
}

function makeClient(name, { snapshotRef = null } = {}) {
  const state = {
    joined: 0,
    reconnecting: 0,
    disconnected: 0,
    errors: [],
    lastContent: null,
    participants: [],
  };
  const client = new RoomClient(URL, {
    onJoined: (payload) => { state.joined += 1; state.participants = payload.participants; state.lastContent = payload.snapshot ?? state.lastContent; },
    onPresence: (payload) => { state.participants = payload.participants; },
    onContent: (payload) => { state.lastContent = payload.snapshot; },
    onError: (message) => { state.errors.push(message); },
    onReconnecting: (info) => { state.reconnecting += 1; console.log(`  [${name}] reconnecting attempt=${info.attempt} delay=${info.delayMs}ms`); },
    onDisconnected: (reason) => { state.disconnected += 1; console.log(`  [${name}] final disconnect: ${reason}`); },
    getLatestSnapshot: snapshotRef ? () => snapshotRef.current : undefined,
  }, {
    reconnect: { baseDelayMs: 300, maxDelayMs: 1200, maxAttempts: 12, jitterRatio: 0.2 },
    connectTimeoutMs: 4000,
  });
  return { client, state };
}

let server = await startServer();
console.log(`CollabServer listening on ${PORT}`);

// ---------- 1. 加入 ----------
const hostSnapshot = { current: { docs: [], brainstorm: { items: [], connections: [] }, members: [], todos: [], ui: { pages: [] } } };
const host = makeClient('host', { snapshotRef: hostSnapshot });
const guest = makeClient('guest');

const hostJoin = await host.client.connect({
  roomId: 'verify-room',
  user: { id: 'u-host', name: '房主', color: '#10b981' },
  isHost: true,
  snapshot: hostSnapshot.current,
  projectName: '联机验证',
});
check('host 加入房间', hostJoin.connectionId === host.client.connectionId && host.state.joined === 1);

const guestJoin = await guest.client.connect({
  roomId: 'verify-room',
  user: { id: 'u-guest', name: '访客', color: '#0ea5e9' },
  isHost: false,
});
check('guest 加入房间并拿到快照', Boolean(guestJoin.connectionId) && guest.state.lastContent !== null);

await waitFor(() => host.state.participants.length === 2, 3000, 'host 看到 2 人');
check('双方 presence 同步（2 人在线）', host.state.participants.length === 2);

// ---------- 2. 编辑同步 ----------
hostSnapshot.current = { ...hostSnapshot.current, docs: [{ id: 'doc-1', title: '第一版' }] };
host.client.sendContentUpdate({ snapshot: hostSnapshot.current, activeModule: 'docs', status: '编辑中' });
await waitFor(() => guest.state.lastContent?.docs?.length === 1, 3000, 'guest 收到内容更新');
check('host 编辑 → guest 实时同步', guest.state.lastContent.docs[0].title === '第一版');

// ---------- 3. 断网（服务器整体关闭） ----------
await stopServer(server);
console.log('server closed (模拟断网/服务停止)');
await waitFor(() => host.state.reconnecting >= 1 && guest.state.reconnecting >= 1, 4000, '双方进入重连');
check('断网后双方自动进入重连', true);

// 让两端各失败几次，验证退避期间不会放弃
await new Promise((resolve) => setTimeout(resolve, 1200));

// ---------- 4. 服务重启 → 自动恢复 ----------
hostSnapshot.current = { ...hostSnapshot.current, docs: [{ id: 'doc-1', title: '断线期间的新内容' }] };
server = await startServer();
console.log('server restarted');

await waitFor(() => host.state.joined >= 2, 15000, 'host 自动重连成功');
check('host 自动重连成功（房主重建房间）', host.state.joined >= 2);
await waitFor(() => guest.state.joined >= 2, 15000, 'guest 自动重连成功');
check('guest 自动重连成功', guest.state.joined >= 2);

// 重建房间应带上房主的最新快照（getLatestSnapshot 刷新）
await waitFor(() => guest.state.lastContent?.docs?.[0]?.title === '断线期间的新内容', 5000, 'guest 拿到重建后的最新快照');
check('服务重启后 guest 获得房主最新内容', true);

// 恢复后的正常同步再验证一轮
hostSnapshot.current = { ...hostSnapshot.current, docs: [{ id: 'doc-1', title: '恢复后的编辑' }] };
host.client.sendContentUpdate({ snapshot: hostSnapshot.current, activeModule: 'docs', status: '编辑中' });
await waitFor(() => guest.state.lastContent?.docs?.[0]?.title === '恢复后的编辑', 3000, '恢复后同步');
check('恢复后编辑同步正常', true);

// ---------- 5. 主动退出 ----------
const guestReconnectsBefore = guest.state.reconnecting;
guest.client.disconnect();
await waitFor(() => host.state.participants.length === 1, 3000, 'host 看到 guest 离开');
check('guest 主动退出后 host 侧人数变为 1', host.state.participants.length === 1);

await new Promise((resolve) => setTimeout(resolve, 1500));
check('主动退出后 guest 不再重连、不触发最终 disconnected',
  guest.state.reconnecting === guestReconnectsBefore && guest.state.disconnected === 0);

host.client.disconnect();
await stopServer(server);

// ---------- 汇总 ----------
const failed = results.filter((entry) => !entry.ok);
console.log(failed.length === 0 ? '\nALL PASS' : `\n${failed.length} FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
