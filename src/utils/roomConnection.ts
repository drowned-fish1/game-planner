// 协作连接的纯逻辑：重连策略、消息解析与提示文案。
// 与 RoomClient 解耦，便于在 Node 单测中用 Fake WebSocket / 假定时器验证。

export interface ReconnectPolicy {
  /** 首次重连的基础等待（毫秒） */
  baseDelayMs: number;
  /** 指数退避的等待上限（毫秒） */
  maxDelayMs: number;
  /** 最多自动重连次数，超过后放弃并通知 onDisconnected */
  maxAttempts: number;
  /** 抖动比例（0~1）：实际等待在 ±ratio 区间内随机浮动，避免多客户端同时重连 */
  jitterRatio: number;
}

export const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  maxAttempts: 6,
  jitterRatio: 0.3,
};

/**
 * 第 attempt 次（1 起）重连前应等待的毫秒数：指数退避 + 上限 + 抖动。
 * random 可注入以便测试（默认 Math.random）。
 */
export function computeReconnectDelay(
  attempt: number,
  policy: ReconnectPolicy = DEFAULT_RECONNECT_POLICY,
  random: () => number = Math.random,
): number {
  const exponent = Math.max(0, attempt - 1);
  const base = Math.min(policy.baseDelayMs * 2 ** exponent, policy.maxDelayMs);
  const jitter = 1 + (random() * 2 - 1) * policy.jitterRatio;
  return Math.max(0, Math.round(base * jitter));
}

export interface ReconnectContext {
  /** 用户是否已主动断开（主动退出永不重连） */
  closedByUser: boolean;
  /** 本次会话是否成功加入过房间（首次连接失败交给调用方处理，不自动重试） */
  everConnected: boolean;
  /** 已经发起过的重连次数 */
  attemptsMade: number;
}

/** 是否还应该安排下一次自动重连 */
export function shouldScheduleReconnect(
  context: ReconnectContext,
  policy: ReconnectPolicy = DEFAULT_RECONNECT_POLICY,
): boolean {
  if (context.closedByUser) return false;
  if (!context.everConnected) return false;
  return context.attemptsMade < policy.maxAttempts;
}

export interface RoomMessage {
  type: string;
  payload: unknown;
}

/** 安全解析一帧房间消息；坏帧返回 null（调用方忽略即可，不抛异常） */
export function parseRoomMessage(raw: unknown): RoomMessage | null {
  if (typeof raw !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const type = (data as { type?: unknown }).type;
  if (typeof type !== 'string' || !type) return null;
  return { type, payload: (data as { payload?: unknown }).payload };
}

/** 重连过程中给 UI 的状态文案 */
export function describeReconnectAttempt(attempt: number, maxAttempts: number): string {
  return `连接断开，正在重连（第 ${attempt}/${maxAttempts} 次）…`;
}

/** RoomClient 所需的最小 WebSocket 形状，测试里用 Fake 实现替代 */
export interface WebSocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** 可注入的定时器接口（测试里换成手动推进的假定时器） */
export interface TimerApi {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const REALTIME_TIMERS: TimerApi = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
};

/** WebSocket.OPEN，独立常量避免依赖全局 WebSocket（Fake 场景无该全局） */
export const WS_OPEN = 1;
