import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Xarrow, { Xwrapper, useXarrow } from 'react-xarrows';
import { toPng } from 'html-to-image';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import {
  Activity,
  Bot,
  Code,
  Image,
  Link,
  Link as LinkIcon,
  MoreHorizontal,
  MousePointer2,
  Move,
  PenTool,
  Plus,
  Type,
  X,
} from 'lucide-react';
import { NoteCard, type ConnectorHandle } from './NoteCard';
import type { RoomParticipant } from '../../utils/collaboration';

interface BoardItem {
  id: string;
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code' | 'ai' | 'note' | 'drawing';
  content: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface Connection {
  id: string;
  start: string;
  end: string;
  startHandle?: ConnectorHandle;
  endHandle?: ConnectorHandle;
}

interface BrainstormBoardProps {
  initialItems?: BoardItem[];
  initialConnections?: Connection[];
  onDataChange?: (items: BoardItem[], connections: Connection[]) => void;
  participants?: RoomParticipant[];
  selfConnectionId?: string | null;
  isConnected?: boolean;
  onPresenceChange?: (status: string, focusedItemId?: string | null) => void;
  onActivity?: (activity: { kind: string; message: string; itemId?: string | null; focusedItemId?: string | null; status?: string }) => void;
}

type TransformState = {
  scale: number;
  positionX: number;
  positionY: number;
};

type PendingConnection = {
  itemId: string;
  handle: ConnectorHandle;
};

function getItemDefaults(type: BoardItem['type']) {
  switch (type) {
    case 'text':
      return { width: 200, height: 150 };
    case 'ai':
      return { width: 300, height: 400 };
    case 'code':
      return { width: 400, height: 300 };
    case 'image':
      return { width: 300, height: 200 };
    case 'drawing':
      return { width: 360, height: 280 };
    case 'status':
      return { width: 160, height: 50 };
    case 'audio':
      return { width: 320, height: 96 };
    default:
      return { width: 250, height: 160 };
  }
}

export function BrainstormBoard({
  initialItems = [],
  initialConnections = [],
  onDataChange,
  participants = [],
  selfConnectionId = null,
  isConnected = false,
  onPresenceChange,
  onActivity,
}: BrainstormBoardProps) {
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [mode, setMode] = useState<'pan' | 'edit' | 'connect'>('pan');
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 768));
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);

  const transformComponentRef = useRef<ReactZoomPanPinchContentRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const middlePanRef = useRef<{ startX: number; startY: number; originX: number; originY: number; active: boolean } | null>(null);

  const updateXarrow = useXarrow();

  useEffect(() => {
    if (!hasInitialized.current) {
      setItems(initialItems);
      setConnections(initialConnections);
      hasInitialized.current = true;
    }
  }, [initialItems, initialConnections]);

  useEffect(() => {
    onDataChange?.(items, connections);
  }, [items, connections, onDataChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewportMode = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setConnectSourceId(null);
      setMode('edit');
    } else {
      setPendingConnection(null);
      setIsMiddlePanning(false);
      middlePanRef.current = null;
    }
  }, [isDesktop]);

  const syncXarrowTransformVars = useCallback((state?: TransformState) => {
    const captureEl = captureRef.current;
    const transformState = state ?? transformComponentRef.current?.instance.transformState;
    if (!captureEl || !transformState) return;

    const inverseScale = transformState.scale ? 1 / transformState.scale : 1;
    captureEl.style.setProperty('--xarrow-inv-scale', `${inverseScale}`);
    captureEl.style.setProperty('--xarrow-inv-tx', `${-transformState.positionX}px`);
    captureEl.style.setProperty('--xarrow-inv-ty', `${-transformState.positionY}px`);
  }, []);

  const handleTransform = useCallback((_ref: unknown, state?: TransformState) => {
    syncXarrowTransformVars(state);
    updateXarrow();
  }, [syncXarrowTransformVars, updateXarrow]);

  const otherEditors = participants.filter(
    (participant) => participant.connectionId !== selfConnectionId && participant.presence.activeModule === 'brainstorm',
  );

  const getItemWatchers = (itemId: string) => otherEditors.filter((participant) => participant.presence.focusedItemId === itemId);

  const getCenterCoords = () => {
    if (!transformComponentRef.current) {
      return { x: 100, y: 100 };
    }

    const { transformState } = transformComponentRef.current.instance;
    const centerX = (window.innerWidth / 2 - transformState.positionX) / transformState.scale;
    const centerY = (window.innerHeight / 2 - transformState.positionY) / transformState.scale;
    return { x: centerX - 100, y: centerY - 60 };
  };

  const createConnection = useCallback((start: PendingConnection, end: PendingConnection) => {
    if (start.itemId === end.itemId) return;

    const exists = connections.some((connection) => (
      connection.start === start.itemId
      && connection.end === end.itemId
      && connection.startHandle === start.handle
      && connection.endHandle === end.handle
    ));

    if (exists) return;

    setConnections((prev) => [...prev, {
      id: uuidv4(),
      start: start.itemId,
      end: end.itemId,
      startHandle: start.handle,
      endHandle: end.handle,
    }]);

    onActivity?.({
      kind: 'brainstorm:connect',
      itemId: end.itemId,
      focusedItemId: end.itemId,
      message: '连接了两张磁贴',
      status: '正在连接磁贴',
    });
  }, [connections, onActivity]);

  const handleConnectHandleClick = useCallback((itemId: string, handle: ConnectorHandle) => {
    if (!isDesktop) return;

    setPendingConnection((current) => {
      if (!current) {
        onPresenceChange?.('准备连接磁贴', itemId);
        return { itemId, handle };
      }

      if (current.itemId === itemId && current.handle === handle) {
        onPresenceChange?.('正在编辑白板', itemId);
        return null;
      }

      createConnection(current, { itemId, handle });
      onPresenceChange?.('正在编辑白板', itemId);
      return null;
    });
  }, [createConnection, isDesktop, onPresenceChange]);

  const handleRootMouseDownCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDesktop || event.button !== 1) return;

    const target = event.target;
    if (target instanceof HTMLElement && target.closest('[data-board-overlay="true"]')) {
      return;
    }

    const transformState = transformComponentRef.current?.instance.transformState;
    if (!transformState) return;

    event.preventDefault();
    setConnectSourceId(null);
    setPendingConnection(null);
    middlePanRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: transformState.positionX,
      originY: transformState.positionY,
    };
    setIsMiddlePanning(true);
    onPresenceChange?.('正在拖动白板', null);
  }, [isDesktop, onPresenceChange]);

  useEffect(() => {
    if (!isDesktop || typeof window === 'undefined') return undefined;

    const handleMouseMove = (event: MouseEvent) => {
      const panState = middlePanRef.current;
      const transformApi = transformComponentRef.current;
      if (!panState?.active || !transformApi) return;

      const { scale } = transformApi.instance.transformState;
      const nextX = panState.originX + (event.clientX - panState.startX);
      const nextY = panState.originY + (event.clientY - panState.startY);
      transformApi.setTransform(nextX, nextY, scale, 0);
      syncXarrowTransformVars({ scale, positionX: nextX, positionY: nextY });
      updateXarrow();
    };

    const handleMouseUp = () => {
      if (!middlePanRef.current?.active) return;
      middlePanRef.current = null;
      setIsMiddlePanning(false);
      onPresenceChange?.('正在浏览白板', null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDesktop, onPresenceChange, syncXarrowTransformVars, updateXarrow]);

  const addItem = (type: BoardItem['type'], defaultContent = '') => {
    const { x, y } = getCenterCoords();
    const size = getItemDefaults(type);

    setItems((prev) => [...prev, { id: uuidv4(), type, content: defaultContent, x, y, width: size.width, height: size.height }]);
    setIsMenuOpen(false);
    setMode('edit');
    onActivity?.({
      kind: 'brainstorm:add',
      message: `新增了一个${type === 'text' ? '文本' : type === 'ai' ? 'AI' : type === 'drawing' ? '绘图' : type}磁贴`,
      status: '正在新增磁贴',
    });
  };

  const handleItemClick = (id: string, event: React.MouseEvent | React.TouchEvent) => {
    if (isConnected) {
      onPresenceChange?.('正在查看磁贴', id);
    }

    if (isDesktop || mode !== 'connect') return;

    event.stopPropagation();

    if (!connectSourceId) {
      setConnectSourceId(id);
      return;
    }

    if (connectSourceId !== id) {
      const exists = connections.some((connection) => connection.start === connectSourceId && connection.end === id);
      if (!exists) {
        setConnections((prev) => [...prev, { id: uuidv4(), start: connectSourceId, end: id }]);
        onActivity?.({
          kind: 'brainstorm:connect',
          itemId: id,
          focusedItemId: id,
          message: '连接了两张磁贴',
          status: '正在连接磁贴',
        });
      }
    }

    setConnectSourceId(null);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const mediaFiles = Array.from(event.dataTransfer.files).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/'),
    );

    if (mediaFiles.length === 0) return;

    let canvasX = 0;
    let canvasY = 0;
    if (transformComponentRef.current) {
      const { transformState } = transformComponentRef.current.instance;
      canvasX = (event.clientX - transformState.positionX) / transformState.scale;
      canvasY = (event.clientY - transformState.positionY) / transformState.scale;
    }

    mediaFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const type = file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'image';
        const size = getItemDefaults(type);
        setItems((prev) => [...prev, {
          id: uuidv4(),
          type,
          content: readerEvent.target?.result as string,
          x: canvasX + index * 20 - 150,
          y: canvasY + index * 20 - 100,
          width: size.width,
          height: size.height,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const type = file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'image';
      const { x, y } = getCenterCoords();
      const size = getItemDefaults(type);
      setItems((prev) => [...prev, {
        id: uuidv4(),
        type,
        content: readerEvent.target?.result as string,
        x,
        y,
        width: size.width,
        height: size.height,
      }]);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const exportAsImage = async () => {
    if (!captureRef.current || !transformComponentRef.current) return;
    setIsMenuOpen(false);

    const { instance, setTransform } = transformComponentRef.current;
    const originalX = instance.transformState.positionX;
    const originalY = instance.transformState.positionY;
    const originalScale = instance.transformState.scale;

    try {
      setTransform(0, 0, 1, 0);
      syncXarrowTransformVars({ scale: 1, positionX: 0, positionY: 0 });

      window.setTimeout(async () => {
        updateXarrow();
        if (!captureRef.current) return;

        const dataUrl = await toPng(captureRef.current, {
          backgroundColor: '#0f172a',
          pixelRatio: 2,
          filter: (node) => !node.classList?.contains('drag-handle-ignored'),
        });

        const link = document.createElement('a');
        link.download = `GP_Board_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        setTransform(originalX, originalY, originalScale, 0);
        syncXarrowTransformVars({ scale: originalScale, positionX: originalX, positionY: originalY });
      }, 350);
    } catch (error) {
      console.error('Export failed:', error);
      setTransform(originalX, originalY, originalScale, 0);
      syncXarrowTransformVars({ scale: originalScale, positionX: originalX, positionY: originalY });
    }
  };

  const deleteConnection = (connectionId: string) => {
    setConnections((prev) => prev.filter((connection) => connection.id !== connectionId));
    onActivity?.({
      kind: 'brainstorm:disconnect',
      message: '删除了一条磁贴连接',
      status: '刚删除一条连接',
    });
  };

  const getAIInputs = (aiId: string) => {
    const incomingConnections = connections.filter((connection) => connection.end === aiId);
    const sourceItems = incomingConnections
      .map((connection) => items.find((item) => item.id === connection.start))
      .filter(Boolean) as BoardItem[];

    return sourceItems
      .filter((item) => (item.type === 'text' || item.type === 'code' || item.type === 'ai') && item.content.trim().length > 0)
      .map((item) => item.content);
  };

  const enterConnectMode = () => {
    if (isDesktop) return;
    setConnectSourceId(null);
    setMode('connect');
    setIsMenuOpen(false);
    onPresenceChange?.('准备连接磁贴', null);
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-bg select-none"
      onMouseDownCapture={handleRootMouseDownCapture}
      onAuxClick={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />

      {!isDesktop && mode === 'connect' && (
        <div data-board-overlay="true" className="pointer-events-auto absolute left-1/2 top-4 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 rounded-full bg-brand-600 px-4 py-2 text-white shadow-lg">
            <LinkIcon size={16} />
            <span className="text-sm font-bold">
              {connectSourceId ? '请点击另一张卡片完成连接' : '请点击起点卡片'}
            </span>
            <button onClick={() => { setMode('pan'); setConnectSourceId(null); }} className="rounded-full bg-black/20 p-1 transition-colors hover:bg-black/40">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {isDesktop && pendingConnection && (
        <div data-board-overlay="true" className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full border border-brand-400/60 bg-bg/95 px-4 py-2 text-white shadow-2xl backdrop-blur">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
            <span className="text-sm font-semibold">{'\u8bf7\u70b9\u51fb\u53e6\u4e00\u4e2a\u8fde\u63a5\u70b9\u5b8c\u6210\u8fde\u7ebf'}</span>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div data-board-overlay="true" className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="flex max-w-xs flex-col items-center gap-3 text-center animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface/80 text-brand-400 shadow-xl backdrop-blur">
              <Plus size={28} />
            </div>
            <p className="text-sm font-semibold text-content">白板还是空的</p>
            <p className="text-xs leading-relaxed text-muted">
              点击右下角 ＋ 添加第一个灵感，也可以直接拖入图片 / 视频 / 音频
            </p>
          </div>
        </div>
      )}

      {isConnected && otherEditors.length > 0 && (
        <div data-board-overlay="true" className="pointer-events-none absolute right-4 top-4 z-[120] max-w-xs space-y-2">
          {otherEditors.slice(0, 4).map((participant) => (
            <div key={participant.connectionId} className="rounded-xl border border-line bg-surface/95 px-3 py-2 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: participant.color }} />
                {participant.name}
              </div>
              <div className="mt-1 text-xs text-content">{participant.presence.status || '正在白板中协作'}</div>
            </div>
          ))}
        </div>
      )}

      <TransformWrapper
        ref={transformComponentRef}
        initialScale={1}
        minScale={0.1}
        maxScale={5}
        centerOnInit
        limitToBounds={false}
        panning={{
          disabled: isDesktop ? true : mode !== 'pan',
          velocityDisabled: true,
          excluded: ['button', 'textarea', 'input', 'audio', 'video', 'canvas'],
        }}
        onTransformed={handleTransform}
        onInit={(ref) => {
          syncXarrowTransformVars(ref.state);
          updateXarrow();
        }}
        doubleClick={{ disabled: true }}
      >
        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
          <div
            ref={captureRef}
            className="relative h-[4000px] w-[4000px] bg-bg"
            style={{
              backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              ['--xarrow-inv-scale' as any]: 1,
              ['--xarrow-inv-tx' as any]: '0px',
              ['--xarrow-inv-ty' as any]: '0px',
            }}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            onClick={() => {
              if (mode === 'connect') setConnectSourceId(null);
              if (isDesktop) setPendingConnection(null);
              if (isConnected) onPresenceChange?.('正在浏览白板', null);
            }}
          >
            <Xwrapper>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{ position: 'absolute', left: 0, top: 0 }}
                  onClick={(event) => handleItemClick(item.id, event)}
                  className={!isDesktop && mode === 'connect' ? 'cursor-pointer' : ''}
                >
                  {getItemWatchers(item.id).length > 0 && (
                    <div className="pointer-events-none absolute -top-10 left-0 z-[120] flex flex-wrap gap-2">
                      {getItemWatchers(item.id).slice(0, 3).map((participant) => (
                        <div
                          key={participant.connectionId}
                          className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-white shadow-lg"
                          style={{ backgroundColor: participant.color }}
                        >
                          {participant.name} 正在看这里
                        </div>
                      ))}
                    </div>
                  )}

                  <NoteCard
                    {...item}
                    scale={transformComponentRef.current?.instance.transformState.scale || 1}
                    disabled={isDesktop ? false : mode === 'pan' || mode === 'connect'}
                    isDesktop={isDesktop}
                    showConnectionHandles={isDesktop ? pendingConnection?.itemId === item.id : true}
                    activeConnectHandle={pendingConnection?.itemId === item.id ? pendingConnection.handle : null}
                    isSelected={connectSourceId === item.id || pendingConnection?.itemId === item.id}
                    inputs={item.type === 'ai' ? getAIInputs(item.id) : undefined}
                    onUpdate={(id, text) => {
                      setItems((prev) => prev.map((entry) => (entry.id === id ? { ...entry, content: text } : entry)));
                      onPresenceChange?.('正在编辑磁贴', id);
                    }}
                    onResize={(id, width, height) => {
                      setItems((prev) => prev.map((entry) => (entry.id === id ? { ...entry, width, height } : entry)));
                      updateXarrow();
                      onPresenceChange?.('正在调整磁贴大小', id);
                    }}
                    onDelete={(id) => {
                      setItems((prev) => prev.filter((entry) => entry.id !== id));
                      setConnections((prev) => prev.filter((connection) => connection.start !== id && connection.end !== id));
                      setPendingConnection((current) => (current?.itemId === id ? null : current));
                      onActivity?.({
                        kind: 'brainstorm:delete',
                        itemId: id,
                        message: '删除了一张磁贴',
                        status: '刚删除一张磁贴',
                      });
                    }}
                    onDrag={(id, x, y) => {
                      setItems((prev) => prev.map((entry) => (entry.id === id ? { ...entry, x, y } : entry)));
                      updateXarrow();
                      onPresenceChange?.('正在移动磁贴', id);
                    }}
                    onConnectHandleClick={handleConnectHandleClick}
                  />

                  {!isDesktop && mode === 'connect' && (
                    <div
                      className={`absolute inset-0 z-50 rounded-lg transition-all duration-300 ${
                        connectSourceId === item.id
                          ? 'ring-4 ring-brand-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                          : 'hover:bg-brand-500/10 hover:ring-2 hover:ring-brand-400'
                      }`}
                    />
                  )}
                </div>
              ))}

              {connections.map((connection) => (
                <Xarrow
                  key={connection.id}
                  start={connection.start}
                  end={connection.end}
                  startAnchor={connection.startHandle ?? 'auto'}
                  endAnchor={connection.endHandle ?? 'auto'}
                  color="#34d399"
                  strokeWidth={3.5}
                  headSize={5}
                  path="smooth"
                  curveness={0.55}
                  dashness={{ strokeLen: 10, nonStrokeLen: 6, animation: 0 }}
                  zIndex={10}
                  divContainerStyle={{
                    transform: 'scale(var(--xarrow-inv-scale, 1)) translate(var(--xarrow-inv-tx, 0px), var(--xarrow-inv-ty, 0px))',
                    transformOrigin: '0 0',
                  }}
                  labels={{
                    middle: (
                      <div
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteConnection(connection.id);
                        }}
                        className={`pointer-events-auto z-[999] cursor-pointer rounded-full border border-brand-400/40 bg-bg/90 p-1.5 text-content shadow-xl backdrop-blur transition-all hover:border-red-500 hover:bg-red-500 hover:text-white ${!isDesktop && mode === 'pan' ? 'hidden' : ''}`}
                        title="删除连线"
                      >
                        <X size={12} />
                      </div>
                    ),
                  }}
                />
              ))}
            </Xwrapper>
          </div>
        </TransformComponent>
      </TransformWrapper>

      <div data-board-overlay="true" className="pointer-events-none absolute bottom-20 right-4 z-[100] flex items-end gap-4 md:bottom-8 md:right-8">
        {!isDesktop && (
        <div className="mb-1 flex gap-2 rounded-full border border-line bg-surface/90 px-2 py-1 shadow-xl backdrop-blur pointer-events-auto">
          <button
            onClick={() => {
              setMode('pan');
              setConnectSourceId(null);
              onPresenceChange?.('正在浏览白板', null);
            }}
            className={`rounded-full p-2 transition-colors ${mode === 'pan' ? 'bg-brand-600 text-white' : 'text-muted hover:text-white'}`}
            title="浏览模式"
          >
            <Move size={20} />
          </button>
          <div className="h-6 w-px self-center bg-surface-3 opacity-50" />
          <button
            onClick={() => {
              setMode('edit');
              setConnectSourceId(null);
              onPresenceChange?.('正在编辑白板', null);
            }}
            className={`rounded-full p-2 transition-colors ${mode === 'edit' ? 'bg-brand-600 text-white' : 'text-muted hover:text-white'}`}
            title="编辑模式"
          >
            <MousePointer2 size={20} />
          </button>
          <button
            onClick={enterConnectMode}
            className={`rounded-full p-2 transition-colors ${mode === 'connect' ? 'bg-brand-600 text-white' : 'text-muted hover:text-white'}`}
            title="连线模式"
          >
            <LinkIcon size={20} />
          </button>
        </div>
        )}

        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <div className={`origin-bottom rounded-2xl border border-line/80 bg-bg/95 p-3 shadow-2xl backdrop-blur flex flex-col gap-3 transition-all duration-300 ${isMenuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}>
            <div className="flex gap-2">
              <button onClick={exportAsImage} className="rounded-full bg-blue-600 px-4 py-2 text-white shadow-lg transition-colors hover:bg-blue-500" title="导出图片">
                <Image size={18} />
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="rounded-full bg-indigo-600 px-4 py-2 text-white shadow-lg transition-colors hover:bg-indigo-500" title="上传文件">
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => addItem('drawing')} className="rounded-full bg-amber-600 px-4 py-2 text-white shadow-lg transition-colors hover:bg-amber-500" title="绘图">
                <PenTool size={18} />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => addItem('code')} className="rounded-full bg-surface-3 px-4 py-2 text-white shadow-lg transition-colors hover:bg-line-strong" title="代码">
                <Code size={18} />
              </button>
              <button onClick={() => addItem('link')} className="rounded-full bg-sky-600 px-4 py-2 text-white shadow-lg transition-colors hover:bg-sky-500" title="网页">
                <Link size={18} />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => addItem('status', 'unused')} className="rounded-full bg-iris-600 px-4 py-2 text-white shadow-lg transition-colors hover:bg-iris-500" title="状态">
                <Activity size={18} />
              </button>
              <button onClick={() => addItem('text')} className="rounded-full bg-yellow-500 px-4 py-2 text-white shadow-lg transition-colors hover:bg-yellow-400" title="便签">
                <Type size={18} />
              </button>
              <button onClick={() => addItem('ai')} className="rounded-full border border-iris-500 bg-iris-700 px-4 py-2 text-white shadow-lg transition-colors hover:bg-iris-700" title="AI 助手">
                <Bot size={18} />
              </button>
            </div>
          </div>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-2xl transition-transform duration-300 hover:bg-brand-400 md:h-16 md:w-16 ${isMenuOpen ? 'rotate-45' : 'rotate-0'}`}
          >
            <Plus size={32} />
          </button>
        </div>
      </div>

      <div data-board-overlay="true" className="pointer-events-none absolute bottom-4 left-4 hidden text-xs text-muted/80 md:block">
        {mode === 'pan' && '当前: 浏览模式 (拖动画布 / 缩放白板)'}
        {mode === 'edit' && '当前: 编辑模式 (移动卡片 / 调整尺寸)'}
        {mode === 'connect' && '当前: 连线模式 (点击两张卡片建立连接)'}
      </div>
    </div>
  );
}
