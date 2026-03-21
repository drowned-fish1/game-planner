import { v4 as uuidv4 } from 'uuid';
import type { ProjectContent } from './storage';

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

interface CollaborationMessage<T = unknown> {
  type: string;
  payload: T;
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
  onDisconnected?: (reason?: string) => void;
}

function getElectronAPI() {
  return window.electronAPI;
}

function randomColor() {
  return PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)];
}

function normalizePath(pathname: string) {
  return pathname && pathname !== '/' ? pathname : '/ws';
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

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `ws://${trimmed}`;
  const url = new URL(withProtocol);

  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol === 'https:') url.protocol = 'wss:';

  url.pathname = normalizePath(url.pathname === '/info' || url.pathname === '/health' ? '/ws' : url.pathname);
  url.search = '';
  url.hash = '';

  return url.toString();
}

export class RoomClient {
  private readonly url: string;
  private readonly handlers: RoomClientHandlers;
  private socket: WebSocket | null = null;
  private closedByUser = false;
  private connectedResolver: ((value: unknown) => void) | null = null;
  private connectedRejecter: ((reason?: unknown) => void) | null = null;
  public connectionId: string | null = null;

  constructor(url: string, handlers: RoomClientHandlers) {
    this.url = url;
    this.handlers = handlers;
  }

  connect(options: JoinRoomOptions) {
    this.closedByUser = false;

    return new Promise((resolve, reject) => {
      this.connectedResolver = resolve;
      this.connectedRejecter = reject;

      const socket = new WebSocket(this.url);
      this.socket = socket;

      socket.onopen = () => {
        this.send('join', options);
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as CollaborationMessage;

        switch (message.type) {
          case 'joined': {
            const payload = message.payload as {
              connectionId: string;
              roomId: string;
              revision: number;
              snapshot?: ProjectContent;
              participants: RoomParticipant[];
              activityLog: RoomActivity[];
              service?: CollaborationServiceInfo;
            };

            this.connectionId = payload.connectionId;
            this.handlers.onJoined?.(payload);
            this.connectedResolver?.(payload);
            this.connectedResolver = null;
            this.connectedRejecter = null;
            break;
          }
          case 'room:presence':
            this.handlers.onPresence?.(message.payload as { participants: RoomParticipant[]; revision: number });
            break;
          case 'room:update-content':
            this.handlers.onContent?.(message.payload as { snapshot: ProjectContent; revision: number; actorId: string; updatedAt: number });
            break;
          case 'room:activity':
            this.handlers.onActivity?.(message.payload as RoomActivity);
            break;
          case 'room:error': {
            const errorPayload = message.payload as { message?: string };
            const errorMessage = errorPayload.message || 'Room error';
            this.handlers.onError?.(errorMessage);
            this.connectedRejecter?.(new Error(errorMessage));
            this.connectedResolver = null;
            this.connectedRejecter = null;
            break;
          }
          default:
            break;
        }
      };

      socket.onerror = () => {
        const errorMessage = '无法连接到房间服务';
        this.handlers.onError?.(errorMessage);
        this.connectedRejecter?.(new Error(errorMessage));
        this.connectedResolver = null;
        this.connectedRejecter = null;
      };

      socket.onclose = (event) => {
        this.socket = null;
        this.connectionId = null;
        if (!this.closedByUser) {
          this.handlers.onDisconnected?.(event.reason || '连接已断开');
        }
      };
    });
  }

  disconnect() {
    this.closedByUser = true;
    this.socket?.close(1000, 'Client disconnect');
    this.socket = null;
    this.connectionId = null;
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

  private send(type: string, payload: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type, payload }));
  }
}
