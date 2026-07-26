import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings as SettingsIcon,
  Lightbulb,
  Users,
  FileText,
  Layout,
  ChevronLeft,
  Check,
  Loader2,
  CircleDot,
} from 'lucide-react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { CommandPalette, type CommandAction } from './components/CommandPalette';
import { ShortcutHelp } from './components/ShortcutHelp';
import { ModuleBoundary } from './components/ModuleBoundary';
import {
  loadProjectContent,
  saveProjectContent,
  type BrainstormConnection,
  type BrainstormItem,
  type DocItem,
  type ProjectContent,
  type ProjectMeta,
  type TeamMember,
  type TodoItem,
} from './utils/storage';
import { toast } from './utils/toast';
import { getTheme, setTheme } from './utils/theme';
import {
  createDefaultRoomId,
  createEmptyRoomSession,
  getLocalCollaborationServiceInfo,
  getPreferredLocalWsUrl,
  loadCollaborationProfile,
  normalizeRoomServerUrl,
  RoomClient,
  RoomSessionState,
  saveCollaborationProfile,
  type CollaborationProfile,
  type RoomActivity,
} from './utils/collaboration';
import { describeReconnectAttempt } from './utils/roomConnection';

// 五大工作模块按需拆包：进入对应模块时才加载其代码（tiptap/白板画布等重依赖不进主包）
const BrainstormBoard = lazy(() => import('./components/Brainstorm/Board').then((m) => ({ default: m.BrainstormBoard })));
const TeamManager = lazy(() => import('./components/Team/TeamManager').then((m) => ({ default: m.TeamManager })));
const Docs = lazy(() => import('./components/Docs/Docs').then((m) => ({ default: m.Docs })));
const UIManager = lazy(() => import('./components/UIPrototype/UIManager').then((m) => ({ default: m.UIManager })));
const Settings = lazy(() => import('./components/Settings/Settings').then((m) => ({ default: m.Settings })));

type ModuleType = 'brainstorm' | 'docs' | 'team' | 'ui' | 'settings';

function moduleStatusLabel(module: ModuleType) {
  switch (module) {
    case 'brainstorm':
      return '正在整理白板';
    case 'docs':
      return '正在编辑文档';
    case 'team':
      return '正在查看房间';
    case 'ui':
      return '正在调整 UI 原型';
    case 'settings':
      return '正在查看设置';
    default:
      return '在线';
  }
}

function appendActivity(list: RoomActivity[], activity: RoomActivity) {
  const next = [activity, ...list.filter((entry) => entry.id !== activity.id)];
  return next.slice(0, 30);
}

function App() {
  const [currentProject, setCurrentProject] = useState<ProjectMeta | null>(null);
  const [projectContent, setProjectContent] = useState<ProjectContent | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [activeModule, setActiveModule] = useState<ModuleType>('brainstorm');
  const [collaboration, setCollaboration] = useState<RoomSessionState>(createEmptyRoomSession);
  const [profile, setProfile] = useState<CollaborationProfile>(() => loadCollaborationProfile());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const roomClientRef = useRef<RoomClient | null>(null);
  const projectContentRef = useRef<ProjectContent | null>(null);
  const lastBroadcastSnapshotRef = useRef('');
  const suppressNextBroadcastRef = useRef(false);
  const presenceTimerRef = useRef<number | null>(null);
  const queuedPresenceRef = useRef<{ status: string; focusedItemId?: string | null } | null>(null);

  const defaultRoomId = currentProject ? createDefaultRoomId(currentProject.id) : '';

  useEffect(() => {
    projectContentRef.current = projectContent;
  }, [projectContent]);

  useEffect(() => {
    saveCollaborationProfile(profile);
  }, [profile]);

  useEffect(() => {
    let disposed = false;

    getLocalCollaborationServiceInfo().then((serviceInfo) => {
      if (!disposed) {
        setCollaboration((prev) => ({ ...prev, serviceInfo }));
      }
    });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      roomClientRef.current?.disconnect();
      roomClientRef.current = null;
    };
  }, []);

  const refreshServiceInfo = async () => {
    const serviceInfo = await getLocalCollaborationServiceInfo();
    setCollaboration((prev) => ({ ...prev, serviceInfo }));
    return serviceInfo;
  };

  const disconnectRoom = useCallback((preserveServiceInfo = true) => {
    roomClientRef.current?.disconnect();
    roomClientRef.current = null;
    lastBroadcastSnapshotRef.current = '';
    suppressNextBroadcastRef.current = false;
    if (presenceTimerRef.current) {
      window.clearTimeout(presenceTimerRef.current);
      presenceTimerRef.current = null;
    }
    queuedPresenceRef.current = null;

    setCollaboration((prev) => ({
      ...createEmptyRoomSession(),
      serviceInfo: preserveServiceInfo ? prev.serviceInfo : null,
    }));
  }, []);

  const schedulePresenceUpdate = useCallback((status: string, focusedItemId?: string | null) => {
    if (collaboration.connectionState !== 'connected') return;

    queuedPresenceRef.current = { status, focusedItemId };
    if (presenceTimerRef.current) return;

    presenceTimerRef.current = window.setTimeout(() => {
      presenceTimerRef.current = null;
      const payload = queuedPresenceRef.current;
      queuedPresenceRef.current = null;
      if (!payload) return;

      roomClientRef.current?.sendPresenceUpdate({
        activeModule,
        status: payload.status,
        focusedItemId: payload.focusedItemId ?? null,
      });
    }, 120);
  }, [collaboration.connectionState, activeModule]);

  const publishActivity = (activity: {
    kind: string;
    message: string;
    itemId?: string | null;
    focusedItemId?: string | null;
    status?: string;
  }) => {
    if (collaboration.connectionState !== 'connected') return;

    roomClientRef.current?.sendActivity({
      module: activeModule,
      kind: activity.kind,
      message: activity.message,
      itemId: activity.itemId || null,
      focusedItemId: activity.focusedItemId ?? null,
      status: activity.status,
    });
  };

  const connectToRoom = async (mode: 'host' | 'guest', serverUrl: string, roomId: string) => {
    if (!currentProject || !projectContent) return;

    const normalizedUrl = normalizeRoomServerUrl(serverUrl);
    const sanitizedProfile = {
      ...profile,
      name: profile.name.trim() || `玩家${profile.id.slice(0, 4)}`,
    };
    if (!normalizedUrl) {
      setCollaboration((prev) => ({
        ...prev,
        connectionState: 'error',
        error: '房间地址不能为空',
      }));
      return;
    }

    setProfile(sanitizedProfile);
    disconnectRoom();

    setCollaboration((prev) => ({
      ...prev,
      connectionState: 'connecting',
      mode,
      serverUrl: normalizedUrl,
      roomId,
      error: null,
    }));

    const client = new RoomClient(normalizedUrl, {
      onJoined: (payload) => {
        setCollaboration((prev) => ({
          ...prev,
          connectionState: 'connected',
          mode,
          serverUrl: normalizedUrl,
          roomId: payload.roomId,
          revision: payload.revision,
          error: null,
          selfConnectionId: payload.connectionId,
          participants: payload.participants,
          activityLog: payload.activityLog || [],
          serviceInfo: payload.service || prev.serviceInfo,
        }));

        if (payload.snapshot) {
          const remoteRaw = JSON.stringify(payload.snapshot);
          lastBroadcastSnapshotRef.current = remoteRaw;
          if (remoteRaw !== JSON.stringify(projectContentRef.current)) {
            suppressNextBroadcastRef.current = true;
            setProjectContent(payload.snapshot);
          }
        }
      },
      onPresence: (payload) => {
        setCollaboration((prev) => ({
          ...prev,
          participants: payload.participants,
          revision: payload.revision,
        }));
      },
      onContent: (payload) => {
        setCollaboration((prev) => ({
          ...prev,
          revision: payload.revision,
        }));

        if (payload.actorId === client.connectionId) {
          return;
        }

        const remoteRaw = JSON.stringify(payload.snapshot);
        lastBroadcastSnapshotRef.current = remoteRaw;
        suppressNextBroadcastRef.current = true;
        setProjectContent(payload.snapshot);
      },
      onActivity: (activity) => {
        setCollaboration((prev) => ({
          ...prev,
          activityLog: appendActivity(prev.activityLog, activity),
        }));
      },
      onError: (message) => {
        setCollaboration((prev) => ({
          ...prev,
          connectionState: 'error',
          error: message,
        }));
      },
      onReconnecting: ({ attempt, maxAttempts }) => {
        setCollaboration((prev) => ({
          ...prev,
          connectionState: 'connecting',
          error: describeReconnectAttempt(attempt, maxAttempts),
        }));
      },
      getLatestSnapshot: () => projectContentRef.current ?? undefined,
      onDisconnected: (reason) => {
        if (roomClientRef.current === client) {
          roomClientRef.current = null;
        }
        setCollaboration((prev) => ({
          ...prev,
          connectionState: 'idle',
          error: reason || '连接已断开',
          selfConnectionId: null,
          participants: [],
        }));
      },
    });

    roomClientRef.current = client;

    try {
      await client.connect({
        roomId,
        user: sanitizedProfile,
        isHost: mode === 'host',
        snapshot: mode === 'host' ? projectContent : undefined,
        projectId: currentProject.id,
        projectName: currentProject.name,
        activeModule,
        status: mode === 'host' ? '正在主持房间' : moduleStatusLabel(activeModule),
      });
    } catch (error) {
      if (roomClientRef.current === client) {
        roomClientRef.current = null;
      }
      client.disconnect();
      setCollaboration((prev) => ({
        ...prev,
        connectionState: 'error',
        error: error instanceof Error ? error.message : '连接房间失败',
      }));
    }
  };

  const hostRoom = async (roomId: string) => {
    const serviceInfo = collaboration.serviceInfo?.ready
      ? collaboration.serviceInfo
      : await refreshServiceInfo();
    const localUrl = getPreferredLocalWsUrl(serviceInfo);

    if (!localUrl) {
      setCollaboration((prev) => ({
        ...prev,
        connectionState: 'error',
        error: serviceInfo.error || '本地房间服务未启动',
      }));
      return;
    }

    await connectToRoom('host', localUrl, roomId);
  };

  const joinRoom = async (serverUrl: string, roomId: string) => {
    await connectToRoom('guest', serverUrl, roomId);
  };

  const openProject = (project: ProjectMeta) => {
    disconnectRoom();
    setCurrentProject(project);
    setProjectContent(loadProjectContent(project.id));
    setActiveModule('brainstorm');
  };

  const closeProject = useCallback(() => {
    if (currentProject && projectContent) {
      saveProjectContent(currentProject.id, projectContent);
    }
    disconnectRoom();
    setCurrentProject(null);
    setProjectContent(null);
  }, [currentProject, projectContent, disconnectRoom]);

  useEffect(() => {
    if (!currentProject || !projectContent) return;
    setSaveStatus('unsaved');

    const timer = window.setTimeout(() => {
      setSaveStatus('saving');
      saveProjectContent(currentProject.id, projectContent);
      window.setTimeout(() => setSaveStatus('saved'), 500);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [currentProject, projectContent]);

  const saveNow = useCallback(() => {
    if (currentProject && projectContent) {
      setSaveStatus('saving');
      saveProjectContent(currentProject.id, projectContent);
      window.setTimeout(() => setSaveStatus('saved'), 500);
      toast.success('项目已保存');
    }
  }, [currentProject, projectContent]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNow();
        return;
      }
      if (!currentProject) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setHelpOpen(false);
        setPaletteOpen((prev) => !prev);
        return;
      }
      if (e.key === '?' && !isTypingTarget(e.target) && !paletteOpen) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProject, paletteOpen, saveNow]);

  useEffect(() => {
    if (collaboration.connectionState !== 'connected' || !projectContent) return;

    const rawSnapshot = JSON.stringify(projectContent);
    if (suppressNextBroadcastRef.current) {
      suppressNextBroadcastRef.current = false;
      lastBroadcastSnapshotRef.current = rawSnapshot;
      return;
    }

    if (lastBroadcastSnapshotRef.current === rawSnapshot) return;

    const timer = window.setTimeout(() => {
      lastBroadcastSnapshotRef.current = rawSnapshot;
      roomClientRef.current?.sendContentUpdate({
        snapshot: JSON.parse(rawSnapshot),
        activeModule,
        status: moduleStatusLabel(activeModule),
        focusedItemId: null,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [projectContent, collaboration.connectionState, activeModule]);

  useEffect(() => {
    if (collaboration.connectionState !== 'connected') return;
    schedulePresenceUpdate(moduleStatusLabel(activeModule), null);
  }, [activeModule, collaboration.connectionState, schedulePresenceUpdate]);

  const handleBrainstormChange = (newItems: BrainstormItem[], newConnections: BrainstormConnection[]) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, brainstorm: { items: newItems, connections: newConnections } };
    });
  };

  const handleUpdateMembers = (newMembers: TeamMember[]) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, members: newMembers };
    });
    publishActivity({ kind: 'members:update', message: `${profile.name} 更新了团队成员` });
  };

  const handleUpdateTodos = (newTodos: TodoItem[]) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, todos: newTodos };
    });
  };

  const handleUpdateDocs = (newDocs: DocItem[]) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, docs: newDocs };
    });
  };

  const handleUpdateUI = (newUIData: ProjectContent['ui']) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, ui: newUIData };
    });
  };

  const teamParticipants = useMemo(
    () => collaboration.participants.filter((participant) => participant.connectionId !== collaboration.selfConnectionId),
    [collaboration.participants, collaboration.selfConnectionId],
  );

  const paletteActions = useMemo<CommandAction[]>(() => {
    if (!currentProject) return [];
    return [
      ...MODULES.map((m) => ({
        id: `goto-${m.id}`,
        label: `跳转：${m.label}`,
        hint: m.hint,
        keywords: m.id,
        perform: () => setActiveModule(m.id),
      })),
      { id: 'goto-settings', label: '跳转：设置', hint: 'AI 服务配置', keywords: 'settings', perform: () => setActiveModule('settings') },
      { id: 'save', label: '保存项目', hint: 'Ctrl+S', keywords: 'save', perform: saveNow },
      {
        id: 'toggle-theme',
        label: '切换深色 / 浅色主题',
        hint: '外观',
        keywords: 'theme dark light 主题',
        perform: () => setTheme(getTheme() === 'light' ? 'dark' : 'light'),
      },
      { id: 'back-home', label: '返回项目大厅', hint: '自动保存后退出', keywords: 'back home dashboard', perform: closeProject },
      { id: 'shortcut-help', label: '查看快捷键', hint: '?', keywords: 'shortcut help keyboard', perform: () => setHelpOpen(true) },
    ];
  }, [currentProject, closeProject, saveNow]);

  if (!currentProject) return <Dashboard onOpenProject={openProject} />;
  if (!projectContent) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-bg text-content">
        <Loader2 size={28} className="animate-spin text-brand-400" />
        <span className="text-sm text-muted">正在载入项目…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-content md:flex-row">
      <ProjectEditorLayout
        project={currentProject}
        content={projectContent}
        activeModule={activeModule}
        saveStatus={saveStatus}
        onBack={closeProject}
        onSetActiveModule={setActiveModule}
        onBrainstormChange={handleBrainstormChange}
        onUpdateMembers={handleUpdateMembers}
        onUpdateTodos={handleUpdateTodos}
        onUpdateDocs={handleUpdateDocs}
        onUpdateUI={handleUpdateUI}
        collaboration={collaboration}
        profile={profile}
        defaultRoomId={defaultRoomId}
        onUpdateProfile={setProfile}
        onHostRoom={hostRoom}
        onJoinRoom={joinRoom}
        onLeaveRoom={() => disconnectRoom()}
        onRefreshServiceInfo={refreshServiceInfo}
        onPresenceChange={schedulePresenceUpdate}
        onActivity={publishActivity}
        remoteParticipants={teamParticipants}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

interface ProjectEditorLayoutProps {
  project: ProjectMeta;
  content: ProjectContent;
  activeModule: ModuleType;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  collaboration: RoomSessionState;
  profile: CollaborationProfile;
  defaultRoomId: string;
  remoteParticipants: RoomSessionState['participants'];
  onBack: () => void;
  onSetActiveModule: (module: ModuleType) => void;
  onBrainstormChange: (items: BrainstormItem[], connections: BrainstormConnection[]) => void;
  onUpdateMembers: (members: TeamMember[]) => void;
  onUpdateTodos: (todos: TodoItem[]) => void;
  onUpdateDocs: (docs: DocItem[]) => void;
  onUpdateUI: (uiData: ProjectContent['ui']) => void;
  onUpdateProfile: (profile: CollaborationProfile) => void;
  onHostRoom: (roomId: string) => Promise<void>;
  onJoinRoom: (serverUrl: string, roomId: string) => Promise<void>;
  onLeaveRoom: () => void;
  onRefreshServiceInfo: () => Promise<unknown>;
  onPresenceChange: (status: string, focusedItemId?: string | null) => void;
  onActivity: (activity: {
    kind: string;
    message: string;
    itemId?: string | null;
    focusedItemId?: string | null;
    status?: string;
  }) => void;
}

const MODULES: { id: ModuleType; label: string; icon: JSX.Element; hint: string }[] = [
  { id: 'brainstorm', label: '灵感白板', icon: <Lightbulb size={18} />, hint: '整理创意与关联' },
  { id: 'team', label: '房间联机', icon: <Users size={18} />, hint: '多人实时协作' },
  { id: 'docs', label: '策划文档', icon: <FileText size={18} />, hint: '撰写设计方案' },
  { id: 'ui', label: 'UI 原型', icon: <Layout size={18} />, hint: '搭建界面草图' },
];

function ProjectEditorLayout({
  project,
  content,
  activeModule,
  saveStatus,
  collaboration,
  profile,
  defaultRoomId,
  remoteParticipants,
  onBack,
  onSetActiveModule,
  onBrainstormChange,
  onUpdateMembers,
  onUpdateTodos,
  onUpdateDocs,
  onUpdateUI,
  onUpdateProfile,
  onHostRoom,
  onJoinRoom,
  onLeaveRoom,
  onRefreshServiceInfo,
  onPresenceChange,
  onActivity,
}: ProjectEditorLayoutProps) {
  const isConnected = collaboration.connectionState === 'connected';
  const activeMeta = MODULES.find((m) => m.id === activeModule);
  const activeTitle = activeModule === 'settings' ? '设置' : activeMeta?.label ?? '';

  const renderModule = () => {
    switch (activeModule) {
      case 'brainstorm':
        return (
          <BrainstormBoard
            key={`${project.id}-brainstorm`}
            initialItems={content.brainstorm?.items || []}
            initialConnections={content.brainstorm?.connections || []}
            onDataChange={onBrainstormChange}
            participants={collaboration.participants}
            selfConnectionId={collaboration.selfConnectionId}
            isConnected={collaboration.connectionState === 'connected'}
            onPresenceChange={onPresenceChange}
            onActivity={onActivity}
          />
        );
      case 'team':
        return (
          <TeamManager
            projectName={project.name}
            members={content.members || []}
            todos={content.todos || []}
            collaboration={collaboration}
            profile={profile}
            defaultRoomId={defaultRoomId}
            onUpdateMembers={onUpdateMembers}
            onUpdateTodos={onUpdateTodos}
            onUpdateProfile={onUpdateProfile}
            onHostRoom={onHostRoom}
            onJoinRoom={onJoinRoom}
            onLeaveRoom={onLeaveRoom}
            onRefreshServiceInfo={onRefreshServiceInfo}
            onActivity={onActivity}
          />
        );
      case 'docs':
        return <Docs initialDocs={content.docs || []} onUpdate={onUpdateDocs} />;
      case 'ui':
        return <UIManager data={content.ui || { pages: [] }} onUpdate={onUpdateUI} />;
      case 'settings':
        return <Settings />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* ===== Desktop sidebar ===== */}
      <aside className="z-50 hidden w-64 shrink-0 flex-col border-r border-line bg-surface/80 backdrop-blur-xl md:flex">
        {/* Header */}
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-3">
          <button
            onClick={onBack}
            title="返回项目大厅"
            aria-label="返回项目大厅"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-content"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-tight text-content">{project.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-400" />
              游戏策划工作台
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">
            工作模块
          </div>
          {MODULES.map((m) => (
            <SidebarBtn
              key={m.id}
              icon={m.icon}
              label={m.label}
              hint={m.hint}
              isActive={activeModule === m.id}
              onClick={() => onSetActiveModule(m.id)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="space-y-2 border-t border-line p-3">
          <SidebarBtn
            icon={<SettingsIcon size={18} />}
            label="设置"
            isActive={activeModule === 'settings'}
            onClick={() => onSetActiveModule('settings')}
          />
          <StatusPill
            isConnected={isConnected}
            peopleCount={remoteParticipants.length + 1}
            saveStatus={saveStatus}
          />
        </div>
      </aside>

      {/* ===== Mobile top bar ===== */}
      <div
        className="flex shrink-0 items-end justify-between border-b border-line bg-surface/90 px-3 pb-2.5 backdrop-blur-xl md:hidden"
        style={{
          height: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <button onClick={onBack} title="返回项目大厅" aria-label="返回项目大厅" className="grid h-9 w-9 place-items-center rounded-lg text-muted active:bg-surface-3">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 px-2 text-center">
          <div className="truncate text-sm font-semibold text-content">{project.name}</div>
          <div className="truncate text-[11px] text-subtle">{activeTitle}</div>
        </div>
        <button
          onClick={() => onSetActiveModule('settings')}
          title="设置"
          aria-label="设置"
          className={`grid h-9 w-9 place-items-center rounded-lg active:bg-surface-3 ${
            activeModule === 'settings' ? 'text-brand-400' : 'text-muted'
          }`}
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      {/* ===== Content ===== */}
      <main className="relative flex-1 overflow-hidden bg-bg pb-16 md:pb-0">
        <ModuleBoundary>{renderModule()}</ModuleBoundary>
      </main>

      {/* ===== Mobile bottom nav ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] flex h-16 items-center justify-around border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {MODULES.map((m) => (
          <MobileNavBtn
            key={m.id}
            icon={m.icon}
            label={m.label}
            isActive={activeModule === m.id}
            onClick={() => onSetActiveModule(m.id)}
          />
        ))}
      </div>
    </>
  );
}

interface SidebarBtnProps {
  icon: JSX.Element;
  label: string;
  hint?: string;
  isActive: boolean;
  onClick: () => void;
}

function SidebarBtn({ icon, label, hint, isActive, onClick }: SidebarBtnProps) {
  return (
    <button onClick={onClick} className={`nav-item ${isActive ? 'nav-item-active' : ''}`}>
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-400" />
      )}
      <span className={isActive ? 'text-brand-300' : 'text-muted'}>{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate leading-tight">{label}</span>
        {hint && (
          <span className={`truncate text-[11px] font-normal leading-tight ${isActive ? 'text-brand-200/70' : 'text-subtle'}`}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

function MobileNavBtn({ icon, label, isActive, onClick }: Omit<SidebarBtnProps, 'hint'>) {
  return (
    <button
      onClick={onClick}
      className={`flex h-full w-full flex-col items-center justify-center gap-1 transition-colors ${
        isActive ? 'text-brand-400' : 'text-subtle active:text-muted'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function StatusPill({
  isConnected,
  peopleCount,
  saveStatus,
}: {
  isConnected: boolean;
  peopleCount: number;
  saveStatus: 'saved' | 'saving' | 'unsaved';
}) {
  if (isConnected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brand-500/25 bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-300">
        <Users size={14} />
        房间中 · {peopleCount} 人在线
      </div>
    );
  }

  const map = {
    saving: { icon: <Loader2 size={14} className="animate-spin" />, text: '正在保存…', cls: 'text-amber-300' },
    unsaved: { icon: <CircleDot size={14} />, text: '有未保存改动', cls: 'text-subtle' },
    saved: { icon: <Check size={14} />, text: '已保存', cls: 'text-muted' },
  }[saveStatus];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs font-medium">
      <span className={map.cls}>{map.icon}</span>
      <span className="text-muted">{map.text}</span>
    </div>
  );
}

export default App;
