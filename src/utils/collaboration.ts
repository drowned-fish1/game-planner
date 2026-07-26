import { v4 as uuidv4 } from 'uuid';
import type { ProjectContent } from './storage';
import {
  DEFAULT_RECONNECT_POLICY,
  REALTIME_TIMERS,
  WS_OPEN,
  computeReconnectDelay,
  parseRoomMessage,
  shouldScheduleReconnect,
  type ReconnectPolicy,
  type TimerApi,
  type WebSocketLike,
} from './roomConnection';

const PROFILE_STORAGE_KEY = 'gp_collab_profile';
const PROFILE_COLORS = ['#10b981', '#f97316', '#0ea5e9', '#eab308', '#ef4444', '#8b5cf6', '#14b8a6'];

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export type CollaborationMode = 'host' | 'guest' | null;

export interface CollaborationProfile {
  id: string;
  name: string;
  color: string;
}

export interface CollaborationServiceAddress {
  address: string;
  httpUrl: string;
  wsUrl: string;
}

export interface CollaborationServiceInfo {
  ready: boolean;
  port: number | null;
  wsPath: string;
  addresses: CollaborationServiceAddress[];
  error?: string;
}

export interface ParticipantPresence {
  activeModule: string;
  status: string;
  focusedItemId: string | null;
  updatedAt: number;
}

export interface RoomParticipant {
  connectionId: string;
  userId: string;
  name: string;
  color: string;
  isHost: boolean;
  joinedAt: number;
  lastSeen: number;
  presence: ParticipantPresence;
}

export interface RoomActivity {
  id: string;
  actorId: string;
  actorName: string;
  color: string;
  module: string;
  kind: string;
  message: string;
  itemId?: string | null;
  createdAt: number;
}

export interface RoomSessionState {
  mode: CollaborationMode;
  connectionState: ConnectionState;
  serverUrl: string;
  roomId: string;
  revision: number;
  error: string | null;
  selfConnectionId: string | null;
  participants: RoomParticipant[];
  activityLog: RoomActivity[];
  serviceInfo: CollaborationServiceInfo | null;
}

export interface JoinRoomOptions {
  roomId: string;
  user: CollaborationProfile;
  isHost: boolean;
  snapshot?: ProjectContent;
  projectId?: string;
  projectName?: string;
  activeModule?: string;
  status?: string;
}

export interface LanRoomSummary {
  id: string;
  participantCount: number;
  revision: number;
  updatedAt: number;
  projectName: string;
}

export interface LanDiscoveredPeer {
  deviceName: string;
  address: string;
  service: CollaborationServiceInfo | null;
  rooms: LanRoomSummary[];
}

interface RoomClientHandlers {
  onJoined?: (payload: {
    connectionId: string;
    roomId: string;
    revision: number;
    snapshot?: ProjectContent;
    participants: RoomParticipant[];
    activityLog: RoomActivity[];
    service?: CollaborationServiceInfo;
  }) => void;
  onPresence?: (payload: { participants: RoomParticipant[]; revision: number }) => void;
  onContent?: (payload: { snapshot: ProjectContent; revision: number; actorId: string; updatedAt: number }) => void;
  onActivity?: (payload: RoomActivity) => void;
  onError?: (message: string) => void;
  /** 最终断开：主动退出不会触发；自动重连只在放弃后触发一次 */
  onDisconnected?: (reason?: string) => void;
  /** 每次安排自动重连时通知（UI 可展示“正在重连”） */
  onReconnecting?: (info: { attempt: number; maxAttempts: number; delayMs: number }) => void;
  /** 重连时刷新加入快照（服务重启后房主用最新内容重建房间）；仅当首次加入携带快照时使用 */
  getLatestSnapshot?: () => ProjectContent | undefined;
}

interface ProxyEventEnvelope {
  clientId: string;
  type: string;
  payload: unknown;
}

const proxySubscribers = new Map<string, Set<(type: string, payload: unknown) => void>>();
let proxyBridgeInitialized = false;

function getElectronAPI() {
  return window.electronAPI;
}

function hasDesktopProxy() {
  return Boolean(getElectronAPI()?.invoke);
}

function randomColor() {
  return PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)];
}

function normalizePath(pathname: string) {
  return pathname && pathname !== '/' ? pathname : '/ws';
}

function shouldUseSecureWebSocket() {
  return !hasDesktopProxy() && typeof window !== 'undefined' && window.location.protocol === 'https:';
}

function ensureProxyBridge() {
  if (proxyBridgeInitialized || !hasDesktopProxy()) return;

  getElectronAPI()?.on('collab:proxy-event', (rawEvent) => {
    const event = rawEvent as ProxyEventEnvelope;
    const handlers = proxySubscribers.get(event.clientId);
    if (!handlers) return;
    handlers.forEach((handler) => handler(event.type, event.payload));
  });

  proxyBridgeInitialized = true;
}

function subscribeProxyClient(clientId: string, handler: (type: string, payload: unknown) => void) {
  ensureProxyBridge();
  const handlers = proxySubscribers.get(clientId) || new Set();
  handlers.add(handler);
  proxySubscribers.set(clientId, handlers);

  return () => {
    const current = proxySubscribers.get(clientId);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) {
      proxySubscribers.delete(clientId);
    }
  };
}

function buildSocketCreationErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (/insecure websocket connection/i.test(rawMessage) || /page loaded over https/i.test(rawMessage)) {
    return '当前页面运行在 HTTPS 下，远程联机地址必须使用 wss://。';
  }

  return rawMessage || '无法创建房间连接';
}

export function createEmptyRoomSession(): RoomSessionState {
  return {
    mode: null,
    connectionState: 'idle',
    serverUrl: '',
    roomId: '',
    revision: 0,
    error: null,
    selfConnectionId: null,
    participants: [],
    activityLog: [],
    serviceInfo: null,
  };
}

export function createDefaultRoomId(projectId: string) {
  return `room-${projectId.slice(0, 8)}`;
}

export function loadCollaborationProfile(): CollaborationProfile {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CollaborationProfile;
      if (parsed.id && parsed.name && parsed.color) {
        return parsed;
      }
    } catch (error) {
      console.error('Failed to parse collaboration profile:', error);
    }
  }

  const profile = {
    id: uuidv4(),
    name: `玩家${Math.floor(Math.random() * 900 + 100)}`,
    color: randomColor(),
  };
  saveCollaborationProfile(profile);
  return profile;
}

export function saveCollaborationProfile(profile: CollaborationProfile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export async function getLocalCollaborationServiceInfo(): Promise<CollaborationServiceInfo> {
  const api = getElectronAPI();
  if (!api?.invoke) {
    return {
      ready: false,
      port: null,
      wsPath: '/ws',
      addresses: [],
      error: 'Electron bridge unavailable',
    };
  }

  return api.invoke<CollaborationServiceInfo>('collab:get-service-info');
}

export async function discoverLanRooms(): Promise<LanDiscoveredPeer[]> {
  const api = getElectronAPI();
  if (!api?.invoke) return [];
  return api.invoke<LanDiscoveredPeer[]>('collab:discover-lan-rooms');
}

export function getPreferredLocalWsUrl(serviceInfo: CollaborationServiceInfo | null) {
  if (!serviceInfo?.ready || !serviceInfo.port) return '';

  const localhost = serviceInfo.addresses.find((entry) => entry.address === '127.0.0.1');
  if (localhost) return localhost.wsUrl;

  return serviceInfo.addresses[0]?.wsUrl || `ws://127.0.0.1:${serviceInfo.port}/ws`;
}

export function getShareableAddresses(serviceInfo: CollaborationServiceInfo | null) {
  if (!serviceInfo) return [];
  const direct = serviceInfo.addresses.filter((entry) => entry.address !== '127.0.0.1');
  return direct.length > 0 ? direct : serviceInfo.addresses;
}

export function normalizeRoomServerUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const defaultProtocol = shouldUseSecureWebSocket() ? 'wss://' : 'ws://';
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `${defaultProtocol}${trimmed}`;
  const url = new URL(withProtocol);

  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (shouldUseSecureWebSocket() && url.protocol === 'ws:') url.protocol = 'wss:';

  url.pathname = normalizePath(url.pathname === '/info' || url.pathname === '/health' ? '/ws' : url.pathname);
  url.search = '';
  url.hash = '';

  return url.toString();
}

export function buildPeerServerUrl(peer: LanDiscoveredPeer) {
  const candidate = peer.service?.addresses.find((entry) => entry.address === peer.address);
  if (candidate?.wsUrl) return candidate.wsUrl;

  const port = peer.service?.port;
  return port ? `ws://${peer.address}:${port}/ws` : '';
}

export interface RoomClientOptions {
  reconnect?: Partial<ReconnectPolicy>;
  /** 等待服务端 joined 回执的超时（毫秒），超时按连接失败处理 */
  connectTimeoutMs?: number;
  /** 可注入的定时器/随机数/socket 工厂，测试用；生产用默认值 */
  timers?: TimerApi;
  random?: () => number;
  createSocket?: (url: string) => WebSocketLike;
}

interface JoinedPayload {
  connectionId: string;
  roomId: string;
  revision: number;
  snapshot?: ProjectContent;
  participants: RoomParticipant[];
  activityLog: RoomActivity[];
  service?: CollaborationServiceInfo;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 10000;

export class RoomClient {
  private readonly url: string;
  private readonly handlers: RoomClientHandlers;
  private readonly policy: ReconnectPolicy;
  private readonly connectTimeoutMs: number;
  private readonly timers: TimerApi;
  private readonly random: () => number;
  private readonly createSocket: (url: string) => WebSocketLike;

  private socket: WebSocketLike | null = null;
  private clientId: string | null = null;
  private unsubProxy: (() => void) | null = null;
  private closedByUser = false;
  private everConnected = false;
  private attemptsMade = 0;
  private joinOptions: JoinRoomOptions | null = null;
  private reconnectTimer: unknown = null;
  private joinTimeoutTimer: unknown = null;
  /** 每次建立传输 +1；旧 socket/proxy 的迟到事件按代号丢弃，防重复回调 */
  private generation = 0;
  private connectedResolver: ((value: unknown) => void) | null = null;
  private connectedRejecter: ((reason?: unknown) => void) | null = null;
  public connectionId: string | null = null;

  constructor(url: string, handlers: RoomClientHandlers, options: RoomClientOptions = {}) {
    this.url = url;
    this.handlers = handlers;
    this.policy = { ...DEFAULT_RECONNECT_POLICY, ...options.reconnect };
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.timers = options.timers ?? REALTIME_TIMERS;
    this.random = options.random ?? Math.random;
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
  }

  connect(options: JoinRoomOptions) {
    this.closedByUser = false;
    this.everConnected = false;
    this.attemptsMade = 0;
    this.joinOptions = options;
    // 重复 connect：静默丢弃旧传输与挂起的旧 Promise（不触发 onDisconnected），
    // 防重复连接、重复监听与 Promise 泄漏
    this.clearReconnectTimer();
    this.clearJoinTimeout();
    this.settleReject(new Error('已被新的连接请求取代'));
    this.teardownTransport();
    return this.openTransport(options);
  }

  disconnect() {
    this.closedByUser = true;
    this.clearReconnectTimer();
    this.clearJoinTimeout();
    this.settleReject(new Error('已主动断开连接'));
    this.teardownTransport(1000, 'Client disconnect');
  }

  sendPresenceUpdate(payload: { activeModule: string; status: string; focusedItemId?: string | null }) {
    this.send('presence:update', payload);
  }

  sendContentUpdate(payload: { snapshot: ProjectContent; activeModule: string; status: string; focusedItemId?: string | null }) {
    this.send('content:update', payload);
  }

  sendActivity(payload: { module: string; kind: string; message: string; itemId?: string | null; focusedItemId?: string | null; status?: string }) {
    this.send('activity:event', payload);
  }

  // ===== 连接建立 =====

  private openTransport(options: JoinRoomOptions): Promise<unknown> {
    return hasDesktopProxy() ? this.connectViaElectron(options) : this.connectViaBrowser(options);
  }

  private connectViaBrowser(options: JoinRoomOptions) {
    const generation = ++this.generation;

    return new Promise((resolve, reject) => {
      this.connectedResolver = resolve;
      this.connectedRejecter = reject;

      let socket: WebSocketLike;
      try {
        socket = this.createSocket(this.url);
      } catch (error) {
        const errorMessage = buildSocketCreationErrorMessage(error);
        this.handlers.onError?.(errorMessage);
        this.settleReject(new Error(errorMessage));
        return;
      }

      this.socket = socket;
      this.armJoinTimeout(generation);

      // 一次性闩锁：底层实现若重复触发 close，只处理第一次，防重复 disconnected/重复调度
      let closeHandled = false;

      socket.onopen = () => {
        if (generation !== this.generation) return;
        this.rawSend('join', options);
      };

      socket.onmessage = (event) => {
        if (generation !== this.generation) return;
        const message = parseRoomMessage(typeof event.data === 'string' ? event.data : String(event.data));
        if (!message) {
          console.error('Failed to parse room message');
          return;
        }
        this.handleRoomEvent(message.type, message.payload);
      };

      socket.onerror = () => {
        if (generation !== this.generation) return;
        // 只做 UI 通知；settle 与重连统一收敛到 onclose（浏览器保证 error 后必有 close），
        // 避免 error+close 双路径造成重复 reject / 重复调度
        if (this.connectedRejecter) {
          this.handlers.onError?.('Unable to connect to room server');
        }
      };

      socket.onclose = (event) => {
        if (generation !== this.generation || closeHandled) return;
        closeHandled = true;
        this.socket = null;
        this.connectionId = null;
        this.handleTransportClosed(event?.reason || undefined);
      };
    });
  }

  private async connectViaElectron(options: JoinRoomOptions): Promise<unknown> {
    const api = getElectronAPI();
    if (!api?.invoke) {
      throw new Error('Electron collaboration proxy unavailable');
    }

    const generation = ++this.generation;
    const joined = new Promise((resolve, reject) => {
      this.connectedResolver = resolve;
      this.connectedRejecter = reject;
    });

    this.armJoinTimeout(generation);

    try {
      const { clientId } = await api.invoke<{ clientId: string }>('collab:proxy-connect', {
        url: this.url,
        joinPayload: options,
      });

      if (generation !== this.generation || this.closedByUser) {
        // 等待 IPC 期间被更新的连接替代 / 被手动断开：丢弃这条代理连接
        api.invoke('collab:proxy-disconnect', { clientId });
      } else {
        this.clientId = clientId;
        this.unsubProxy = subscribeProxyClient(clientId, (type, payload) => {
          if (generation !== this.generation) return;
          if (type === 'disconnected') {
            const reason = (payload as { reason?: string } | null)?.reason;
            this.cleanupProxy();
            this.handleTransportClosed(reason || undefined);
            return;
          }
          this.handleRoomEvent(type, payload);
        });
      }
    } catch (error) {
      if (generation === this.generation) {
        const message = error instanceof Error ? error.message : 'Unable to connect to room server';
        this.handlers.onError?.(message);
        this.settleReject(new Error(message));
      }
    }

    return joined;
  }

  // ===== 事件处理 =====

  private handleRoomEvent(type: string, payload: unknown) {
    switch (type) {
      case 'joined': {
        const joinedPayload = payload as JoinedPayload;
        this.everConnected = true;
        this.attemptsMade = 0;
        this.clearJoinTimeout();
        this.connectionId = joinedPayload.connectionId;
        this.handlers.onJoined?.(joinedPayload);
        this.settleResolve(joinedPayload);
        break;
      }
      case 'room:presence':
        this.handlers.onPresence?.(payload as { participants: RoomParticipant[]; revision: number });
        break;
      case 'room:update-content':
        this.handlers.onContent?.(payload as { snapshot: ProjectContent; revision: number; actorId: string; updatedAt: number });
        break;
      case 'room:activity':
        this.handlers.onActivity?.(payload as RoomActivity);
        break;
      case 'room:error': {
        const message = (payload as { message?: string } | null)?.message || 'Room error';
        this.handlers.onError?.(message);
        this.settleReject(new Error(message));
        break;
      }
      default:
        break;
    }
  }

  /** 传输层关闭（浏览器 onclose / 代理 disconnected）后的统一分支 */
  private handleTransportClosed(reason?: string) {
    this.clearJoinTimeout();

    if (this.connectedRejecter) {
      // 尚未收到 joined 就被关闭：让挂起的 connect 立即失败（原实现会永久挂起）。
      // 首次连接由调用方 catch 处理；重连尝试由 scheduleReconnect 的 catch 续排，
      // 这里不再调度，保证重连只有一个调度入口。
      this.settleReject(new Error(reason || 'Connection closed before join completed'));
      return;
    }

    if (this.closedByUser) return;

    if (shouldScheduleReconnect(this.reconnectContext(), this.policy)) {
      this.scheduleReconnect();
      return;
    }

    if (this.everConnected) {
      this.handlers.onDisconnected?.(reason || 'Connection closed');
    }
  }

  // ===== 自动重连 =====

  private reconnectContext() {
    return {
      closedByUser: this.closedByUser,
      everConnected: this.everConnected,
      attemptsMade: this.attemptsMade,
    };
  }

  private scheduleReconnect() {
    this.attemptsMade += 1;
    const delayMs = computeReconnectDelay(this.attemptsMade, this.policy, this.random);
    this.handlers.onReconnecting?.({ attempt: this.attemptsMade, maxAttempts: this.policy.maxAttempts, delayMs });

    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closedByUser || !this.joinOptions) return;

      this.openTransport(this.refreshedJoinOptions()).catch(() => {
        if (this.closedByUser) return;
        if (shouldScheduleReconnect(this.reconnectContext(), this.policy)) {
          this.scheduleReconnect();
        } else {
          this.handlers.onDisconnected?.('自动重连失败，已停止重试');
        }
      });
    }, delayMs);
  }

  /** 重连时刷新快照：服务重启导致房间丢失时，房主用最新内容重建房间 */
  private refreshedJoinOptions(): JoinRoomOptions {
    const base = this.joinOptions as JoinRoomOptions;
    if (base.snapshot === undefined) return base;
    const latest = this.handlers.getLatestSnapshot?.();
    return latest ? { ...base, snapshot: latest } : base;
  }

  // ===== 内部工具 =====

  private armJoinTimeout(generation: number) {
    this.clearJoinTimeout();
    this.joinTimeoutTimer = this.timers.setTimeout(() => {
      this.joinTimeoutTimer = null;
      if (generation !== this.generation) return;
      const message = '连接超时：服务器未在限定时间内确认加入';
      this.handlers.onError?.(message);
      // 先拆传输再 reject：teardown 递增代号，使半开 socket 的迟到 onclose 失效；
      // 重连续排交给 connect/reconnect 的 catch，避免双重调度
      this.teardownTransport(undefined, 'join timeout');
      this.settleReject(new Error(message));
    }, this.connectTimeoutMs);
  }

  private clearJoinTimeout() {
    if (this.joinTimeoutTimer !== null) {
      this.timers.clearTimeout(this.joinTimeoutTimer);
      this.joinTimeoutTimer = null;
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      this.timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private settleResolve(value: unknown) {
    const resolve = this.connectedResolver;
    this.connectedResolver = null;
    this.connectedRejecter = null;
    resolve?.(value);
  }

  private settleReject(error: Error) {
    const reject = this.connectedRejecter;
    this.connectedResolver = null;
    this.connectedRejecter = null;
    reject?.(error);
  }

  /** 静默拆除当前传输：递增代号让迟到事件全部失效 */
  private teardownTransport(code?: number, reason?: string) {
    this.generation += 1;

    if (this.clientId && hasDesktopProxy()) {
      getElectronAPI()?.invoke('collab:proxy-disconnect', { clientId: this.clientId });
      this.cleanupProxy();
    }

    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      try {
        socket.close(code, reason);
      } catch {
        // 已关闭的 socket 再 close 抛错可忽略
      }
    }
    this.connectionId = null;
  }

  private send(type: string, payload: unknown) {
    if (this.clientId && hasDesktopProxy()) {
      getElectronAPI()?.invoke('collab:proxy-send', {
        clientId: this.clientId,
        type,
        payload,
      });
      return;
    }
    this.rawSend(type, payload);
  }

  private rawSend(type: string, payload: unknown) {
    if (!this.socket || this.socket.readyState !== WS_OPEN) return;
    this.socket.send(JSON.stringify({ type, payload }));
  }

  private cleanupProxy() {
    this.unsubProxy?.();
    this.unsubProxy = null;
    this.clientId = null;
    this.connectionId = null;
  }
}
