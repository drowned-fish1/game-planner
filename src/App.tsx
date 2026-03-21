import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings as SettingsIcon,
  Lightbulb,
  Users,
  FileText,
  Layout,
  ChevronLeft,
} from 'lucide-react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { BrainstormBoard } from './components/Brainstorm/Board';
import { TeamManager } from './components/Team/TeamManager';
import { Docs } from './components/Docs/Docs';
import { UIManager } from './components/UIPrototype/UIManager';
import { Settings } from './components/Settings/Settings';
import { loadProjectContent, ProjectContent, ProjectMeta, saveProjectContent } from './utils/storage';
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

  const disconnectRoom = (preserveServiceInfo = true) => {
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
  };

  const schedulePresenceUpdate = (status: string, focusedItemId?: string | null) => {
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
  };

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

  const closeProject = () => {
    if (currentProject && projectContent) {
      saveProjectContent(currentProject.id, projectContent);
    }
    disconnectRoom();
    setCurrentProject(null);
    setProjectContent(null);
  };

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentProject && projectContent) {
          setSaveStatus('saving');
          saveProjectContent(currentProject.id, projectContent);
          window.setTimeout(() => setSaveStatus('saved'), 500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProject, projectContent]);

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
  }, [activeModule, collaboration.connectionState]);

  const handleBrainstormChange = (newItems: any[], newConnections: any[]) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, brainstorm: { items: newItems, connections: newConnections } };
    });
  };

  const handleUpdateMembers = (newMembers: any[]) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, members: newMembers };
    });
    publishActivity({ kind: 'members:update', message: `${profile.name} 更新了团队成员` });
  };

  const handleUpdateTodos = (newTodos: any[]) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, todos: newTodos };
    });
  };

  const handleUpdateDocs = (newDocs: any[]) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, docs: newDocs };
    });
  };

  const handleUpdateUI = (newUIData: any) => {
    setProjectContent((prev) => {
      if (!prev) return null;
      return { ...prev, ui: newUIData };
    });
  };

  const teamParticipants = useMemo(
    () => collaboration.participants.filter((participant) => participant.connectionId !== collaboration.selfConnectionId),
    [collaboration.participants, collaboration.selfConnectionId],
  );

  if (!currentProject) return <Dashboard onOpenProject={openProject} />;
  if (!projectContent) {
    return <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">Loading project...</div>;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-900 text-slate-200 md:flex-row">
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
  onBrainstormChange: (items: any[], connections: any[]) => void;
  onUpdateMembers: (members: any[]) => void;
  onUpdateTodos: (todos: any[]) => void;
  onUpdateDocs: (docs: any[]) => void;
  onUpdateUI: (uiData: any) => void;
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
      <aside className="z-50 hidden w-64 shrink-0 flex-col border-r border-slate-700 bg-slate-800 md:flex">
        <div className="flex h-14 items-center gap-3 border-b border-slate-700 px-4">
          <button onClick={onBack} className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 truncate font-bold text-white">{project.name}</div>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          <SidebarBtn icon={<Lightbulb size={18} />} label="灵感白板" isActive={activeModule === 'brainstorm'} onClick={() => onSetActiveModule('brainstorm')} />
          <SidebarBtn icon={<Users size={18} />} label="房间联机" isActive={activeModule === 'team'} onClick={() => onSetActiveModule('team')} />
          <SidebarBtn icon={<FileText size={18} />} label="策划文档" isActive={activeModule === 'docs'} onClick={() => onSetActiveModule('docs')} />
          <SidebarBtn icon={<Layout size={18} />} label="UI 原型" isActive={activeModule === 'ui'} onClick={() => onSetActiveModule('ui')} />

          <div className="my-2 h-px bg-slate-700" />

          <button
            onClick={() => onSetActiveModule('settings')}
            className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-all ${
              activeModule === 'settings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            <SettingsIcon size={18} />
            设置
          </button>
        </nav>

        <div className="border-t border-slate-700 p-4 text-center text-xs text-slate-500">
          {collaboration.connectionState === 'connected'
            ? `房间中 · ${remoteParticipants.length + 1} 人`
            : saveStatus === 'saving'
              ? 'Saving...'
              : 'Saved'}
        </div>
      </aside>

      <div
        className="flex shrink-0 items-end justify-between border-b border-slate-700 bg-slate-800 px-4 pb-3 md:hidden"
        style={{
          height: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <button onClick={onBack} className="p-1 text-slate-300">
          <ChevronLeft size={24} />
        </button>
        <span className="mb-1 font-bold text-white">{project.name}</span>
        <button onClick={() => onSetActiveModule('settings')} className="p-1 text-slate-300">
          <SettingsIcon size={20} />
        </button>
      </div>

      <main className="relative flex-1 overflow-hidden bg-slate-900 pb-16 md:pb-0">{renderModule()}</main>

      <div className="fixed bottom-0 left-0 right-0 z-[9999] flex h-16 items-center justify-around border-t border-slate-700 bg-slate-800 pb-[env(safe-area-inset-bottom)] md:hidden">
        <MobileNavBtn icon={<Lightbulb size={20} />} label="白板" isActive={activeModule === 'brainstorm'} onClick={() => onSetActiveModule('brainstorm')} />
        <MobileNavBtn icon={<Users size={20} />} label="房间" isActive={activeModule === 'team'} onClick={() => onSetActiveModule('team')} />
        <MobileNavBtn icon={<FileText size={20} />} label="文档" isActive={activeModule === 'docs'} onClick={() => onSetActiveModule('docs')} />
      </div>
    </>
  );
}

function SidebarBtn({ icon, label, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-all ${
        isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileNavBtn({ icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex h-full w-full flex-col items-center justify-center gap-1 ${isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

export default App;
