import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Activity,
  Copy,
  DoorOpen,
  Network,
  PlugZap,
  RefreshCw,
  Search,
  Server,
  Users,
  Wifi,
} from 'lucide-react';
import { TeamMember, TodoItem } from '../../utils/storage';
import {
  buildPeerServerUrl,
  discoverLanRooms,
  getShareableAddresses,
  type CollaborationProfile,
  type LanDiscoveredPeer,
  type RoomSessionState,
} from '../../utils/collaboration';
import { TodoList } from './TodoList';

interface TeamManagerProps {
  projectName: string;
  members: TeamMember[];
  todos: TodoItem[];
  collaboration: RoomSessionState;
  profile: CollaborationProfile;
  defaultRoomId: string;
  onUpdateMembers: (newMembers: TeamMember[]) => void;
  onUpdateTodos: (newTodos: TodoItem[]) => void;
  onUpdateProfile: (profile: CollaborationProfile) => void;
  onHostRoom: (roomId: string) => Promise<void>;
  onJoinRoom: (serverUrl: string, roomId: string) => Promise<void>;
  onLeaveRoom: () => void;
  onRefreshServiceInfo: () => Promise<unknown>;
  onActivity: (activity: { kind: string; message: string; itemId?: string | null; focusedItemId?: string | null; status?: string }) => void;
}

type MobileTab = 'room' | 'members' | 'todos';

export function TeamManager({
  projectName,
  members,
  todos,
  collaboration,
  profile,
  defaultRoomId,
  onUpdateMembers,
  onUpdateTodos,
  onUpdateProfile,
  onHostRoom,
  onJoinRoom,
  onLeaveRoom,
  onRefreshServiceInfo,
  onActivity,
}: TeamManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>('room');
  const [roomIdInput, setRoomIdInput] = useState(collaboration.roomId || defaultRoomId);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [copiedText, setCopiedText] = useState('');
  const [lanPeers, setLanPeers] = useState<LanDiscoveredPeer[]>([]);
  const [lanLoading, setLanLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; memberId: string }>({
    visible: false,
    x: 0,
    y: 0,
    memberId: '',
  });
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'rename' | 'role';
    inputValue: string;
    targetId?: string;
  }>({
    isOpen: false,
    type: 'add',
    inputValue: '',
  });

  const shareableAddresses = useMemo(
    () => getShareableAddresses(collaboration.serviceInfo),
    [collaboration.serviceInfo],
  );

  const lanRooms = useMemo(
    () => lanPeers.flatMap((peer) => peer.rooms.map((room) => ({ peer, room }))),
    [lanPeers],
  );

  useEffect(() => {
    setRoomIdInput(collaboration.roomId || defaultRoomId);
  }, [collaboration.roomId, defaultRoomId]);

  useEffect(() => {
    const closeMenu = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedText(value);
      window.setTimeout(() => setCopiedText(''), 1800);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const connectionLabel = {
    idle: '未连接',
    connecting: '连接中',
    connected: collaboration.mode === 'host' ? '主持中' : '已加入',
    error: '连接失败',
  }[collaboration.connectionState];

  const scanLanRooms = async () => {
    setLanLoading(true);
    try {
      const peers = await discoverLanRooms();
      setLanPeers(peers.filter((peer) => peer.rooms.length > 0));
    } catch (error) {
      console.error('LAN discovery failed:', error);
      setLanPeers([]);
    } finally {
      setLanLoading(false);
    }
  };

  const handleModalSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = modal.inputValue.trim();
    if (!value) return;

    if (modal.type === 'add') {
      const colors = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-yellow-500', 'bg-orange-500', 'bg-pink-500'];
      const newMember: TeamMember = {
        id: uuidv4(),
        name: value,
        role: '策划',
        color: colors[Math.floor(Math.random() * colors.length)],
      };
      onUpdateMembers([...members, newMember]);
      onActivity({ kind: 'member:add', message: `${profile.name} 添加了成员 ${newMember.name}` });
    }

    if (modal.type === 'rename' && modal.targetId) {
      const target = members.find((member) => member.id === modal.targetId);
      onUpdateMembers(members.map((member) => (
        member.id === modal.targetId ? { ...member, name: value } : member
      )));
      if (target) {
        onActivity({ kind: 'member:rename', message: `${profile.name} 修改了成员 ${target.name} 的名字` });
      }
    }

    if (modal.type === 'role' && modal.targetId) {
      const target = members.find((member) => member.id === modal.targetId);
      onUpdateMembers(members.map((member) => (
        member.id === modal.targetId ? { ...member, role: value } : member
      )));
      if (target) {
        onActivity({ kind: 'member:role', message: `${profile.name} 更新了 ${target.name} 的职责` });
      }
    }

    setModal((prev) => ({ ...prev, isOpen: false }));
  };

  const openRenameModal = () => {
    const member = members.find((entry) => entry.id === contextMenu.memberId);
    if (!member) return;
    setModal({ isOpen: true, type: 'rename', inputValue: member.name, targetId: member.id });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const openRoleModal = () => {
    const member = members.find((entry) => entry.id === contextMenu.memberId);
    if (!member) return;
    setModal({ isOpen: true, type: 'role', inputValue: member.role, targetId: member.id });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleContextMenu = (event: React.MouseEvent, memberId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 260),
      memberId,
    });
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !contextMenu.memberId) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      onUpdateMembers(members.map((member) => (
        member.id === contextMenu.memberId ? { ...member, avatar: loadEvent.target?.result as string } : member
      )));
      onActivity({ kind: 'member:avatar', message: `${profile.name} 更新了成员头像` });
    };
    reader.readAsDataURL(file);

    setContextMenu((prev) => ({ ...prev, visible: false }));
    event.target.value = '';
  };

  const handleDelete = () => {
    const target = members.find((member) => member.id === contextMenu.memberId);
    if (!target) return;
    if (!confirm(`确定移除成员 ${target.name} 吗？`)) return;

    onUpdateMembers(members.filter((member) => member.id !== contextMenu.memberId));
    onActivity({ kind: 'member:remove', message: `${profile.name} 移除了成员 ${target.name}` });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const roomPanel = (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="space-y-6 p-4 md:p-6 xl:p-8">
        <section className="rounded-2xl border border-slate-700 bg-slate-800/90 p-5 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                <Wifi size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">联机房间</h2>
                <p className="text-sm text-slate-400">{projectName} 的实时协作入口</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void onRefreshServiceInfo()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-emerald-500 hover:text-white"
              >
                <RefreshCw size={16} />
                刷新端口
              </button>
              {collaboration.connectionState === 'connected' && (
                <button
                  onClick={onLeaveRoom}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500"
                >
                  <DoorOpen size={16} />
                  离开房间
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">本地服务</div>
                <div className={`rounded-full px-2 py-1 text-xs ${collaboration.serviceInfo?.ready ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                  {connectionLabel}
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">本地端口</div>
                  <div className="mt-1 flex items-center gap-2 text-base font-semibold text-white">
                    <Server size={16} className="text-emerald-400" />
                    {collaboration.serviceInfo?.port || '未启动'}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    这个端口既可以给 FRP TCP 转发，也可以给同局域网的设备直接加入。
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-slate-500">可分享地址</div>
                  {shareableAddresses.length > 0 ? (
                    shareableAddresses.map((entry) => (
                      <button
                        key={entry.wsUrl}
                        onClick={() => void copyText(entry.wsUrl)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-left transition-colors hover:border-emerald-500"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm text-white">{entry.wsUrl}</div>
                          <div className="text-xs text-slate-500">{entry.httpUrl}</div>
                        </div>
                        <Copy size={14} className="shrink-0 text-slate-400" />
                      </button>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">
                      还没有拿到可用地址，先点上面的“刷新端口”。
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <PlugZap size={16} className="text-amber-400" />
                房间信息
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">你的显示名称</span>
                  <input
                    value={profile.name}
                    onChange={(event) => onUpdateProfile({ ...profile, name: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                    placeholder="输入房间昵称"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">房间号</span>
                  <input
                    value={roomIdInput}
                    onChange={(event) => setRoomIdInput(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                    placeholder={defaultRoomId}
                  />
                </label>

                <button
                  onClick={() => void onHostRoom(roomIdInput.trim() || defaultRoomId)}
                  disabled={collaboration.connectionState === 'connecting'}
                  className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  主持当前项目房间
                </button>

                {collaboration.connectionState === 'connected' && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    当前房间：{collaboration.roomId} · {collaboration.mode === 'host' ? '你是房主' : '你已加入远程房间'}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <DoorOpen size={16} className="text-sky-400" />
                加入远程房间
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">远程地址</span>
                  <input
                    value={serverUrlInput}
                    onChange={(event) => setServerUrlInput(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                    placeholder="frp-off.com:19077 或 ws://frp-off.com:19077/ws"
                  />
                </label>

                <button
                  onClick={() => void onJoinRoom(serverUrlInput.trim(), roomIdInput.trim() || defaultRoomId)}
                  disabled={collaboration.connectionState === 'connecting'}
                  className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  加入房间并同步项目
                </button>

                <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs leading-5 text-slate-400">
                  支持 `frp-off.com:19077`、`ws://host:port/ws`、`http://host:port`。桌面端会通过主进程代理连接，所以 TCP 隧道也能用。
                </div>

                {collaboration.error && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {collaboration.error}
                  </div>
                )}

                {copiedText && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    已复制地址：{copiedText}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Network size={16} className="text-emerald-400" />
                局域网房间
              </div>
              <button
                onClick={() => void scanLanRooms()}
                disabled={lanLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {lanLoading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                扫描局域网
              </button>
            </div>

            <div className="space-y-3">
              {lanRooms.map(({ peer, room }) => {
                const peerUrl = buildPeerServerUrl(peer);
                return (
                  <div key={`${peer.address}-${room.id}`} className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-950/60 p-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{room.projectName || room.id}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        设备 {peer.deviceName} · 地址 {peer.address}:{peer.service?.port || '-'} · 房间号 {room.id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {room.participantCount} 人在线 · 修订 {room.revision}
                      </div>
                    </div>
                    <button
                      onClick={() => void onJoinRoom(peerUrl, room.id)}
                      disabled={!peerUrl || collaboration.connectionState === 'connecting'}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      直接加入
                    </button>
                  </div>
                );
              })}

              {!lanLoading && lanRooms.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
                  还没有发现局域网中的房间。确保对方也打开了应用，并主持了一个房间后再扫描。
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Users size={18} className="text-emerald-400" />
                  在线协作者
                </h3>
                <p className="mt-1 text-sm text-slate-400">显示大家正在看的模块和最近状态</p>
              </div>
              <div className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">
                {collaboration.participants.length} 人在线
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {collaboration.participants.map((participant) => (
                <div key={participant.connectionId} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: participant.color }}
                      >
                        {participant.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">
                          {participant.name}
                          {participant.connectionId === collaboration.selfConnectionId ? ' (你)' : ''}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {participant.isHost ? '房主' : '协作者'} · {participant.presence.activeModule}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-300">
                      在线
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                    {participant.presence.status || '在线待命'}
                  </div>
                </div>
              ))}

              {collaboration.participants.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                  还没有人在房间里。先主持一个房间，或者加入一个局域网 / 远程房间。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <Activity size={18} className="text-amber-400" />
              最近活动
            </div>

            <div className="space-y-3">
              {collaboration.activityLog.map((activityItem) => (
                <div key={activityItem.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activityItem.color }} />
                    {activityItem.actorName}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">{activityItem.message}</div>
                  <div className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">{activityItem.module}</div>
                </div>
              ))}

              {collaboration.activityLog.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                  房间活动会显示在这里，比如谁加入、谁改了磁贴、谁更新了任务。
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  const membersPanel = (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 pb-4 pt-4 md:px-8">
        <div>
          <h2 className="text-xl font-bold text-white md:text-3xl">团队成员</h2>
          <p className="mt-1 text-xs text-slate-400 md:text-sm">右键成员卡片可以改名、改职责或换头像</p>
        </div>
        <button
          onClick={() => setModal({ isOpen: true, type: 'add', inputValue: '' })}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-500"
        >
          <span>+</span>
          <span className="hidden md:inline">添加成员</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {members.map((member) => (
            <div
              key={member.id}
              onClick={(event) => window.innerWidth < 768 && handleContextMenu(event, member.id)}
              onContextMenu={(event) => handleContextMenu(event, member.id)}
              className="group relative flex cursor-pointer select-none flex-col items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4 transition-all hover:-translate-y-1 hover:border-emerald-500 hover:shadow-xl md:p-6"
            >
              <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-slate-700 text-2xl font-bold text-white shadow-inner md:h-20 md:w-20 md:text-3xl ${member.color}`}>
                {member.avatar ? <img src={member.avatar} className="h-full w-full object-cover" /> : member.name[0]}
              </div>
              <div className="w-full text-center">
                <h3 className="truncate px-2 text-base font-bold text-white md:text-lg">{member.name}</h3>
                <div className="mt-1 inline-block max-w-full truncate rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-emerald-400 md:text-xs">
                  {member.role}
                </div>
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <div className="col-span-full rounded-xl border-2 border-dashed border-slate-800 py-10 text-center text-slate-500">
              还没有成员，先添加几个一起协作。
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const todosPanel = (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <TodoList todos={todos} members={members} onUpdate={onUpdateTodos} onActivity={onActivity} actorName={profile.name} />
    </div>
  );

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-900">
      <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />

      <div className="flex shrink-0 border-b border-slate-700 bg-slate-800 md:hidden">
        <MobileTabButton label="房间" active={activeTab === 'room'} onClick={() => setActiveTab('room')} />
        <MobileTabButton label="成员" active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
        <MobileTabButton label="待办" active={activeTab === 'todos'} onClick={() => setActiveTab('todos')} />
      </div>

      <div className="hidden min-h-0 flex-1 overflow-hidden md:grid md:grid-rows-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-h-0 overflow-hidden border-b border-slate-800">{roomPanel}</div>
        <div className="grid min-h-0 overflow-hidden grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-h-0 overflow-hidden">{membersPanel}</div>
          <div className="min-h-0 overflow-hidden border-l border-slate-800">{todosPanel}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 md:hidden">
        {activeTab === 'room' && roomPanel}
        {activeTab === 'members' && membersPanel}
        {activeTab === 'todos' && todosPanel}
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={() => setModal((prev) => ({ ...prev, isOpen: false }))}>
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-4 text-xl font-bold text-white">
              {modal.type === 'add' ? '添加新成员' : modal.type === 'rename' ? '修改名字' : '修改职责'}
            </h3>
            <form onSubmit={handleModalSubmit}>
              <input
                autoFocus
                value={modal.inputValue}
                onChange={(event) => setModal((prev) => ({ ...prev, inputValue: event.target.value }))}
                placeholder={modal.type === 'role' ? '例如：主程 / 数值 / 关卡策划' : '请输入内容'}
                className="mb-6 w-full rounded border border-slate-600 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModal((prev) => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-slate-400 transition-colors hover:text-white">
                  取消
                </button>
                <button type="submit" className="rounded bg-emerald-600 px-6 py-2 font-bold text-white shadow-lg transition-colors hover:bg-emerald-500">
                  确认
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contextMenu.visible && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))} />
          <div
            className="fixed z-[9999] flex w-44 flex-col rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-2xl"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="border-b border-slate-700 bg-slate-900/50 px-4 py-2 text-xs font-bold text-slate-500">
              管理：{members.find((member) => member.id === contextMenu.memberId)?.name}
            </div>
            <button onClick={openRenameModal} className="px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-emerald-600 hover:text-white">
              修改名字
            </button>
            <button onClick={openRoleModal} className="px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-emerald-600 hover:text-white">
              修改职责
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-emerald-600 hover:text-white">
              更换头像
            </button>
            <div className="mx-2 my-1 h-px bg-slate-700" />
            <button onClick={handleDelete} className="rounded-b-lg px-4 py-3 text-left text-sm text-red-400 transition-colors hover:bg-red-600 hover:text-white">
              移除成员
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MobileTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-bold transition-colors ${active ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-slate-400'}`}
    >
      {label}
    </button>
  );
}
