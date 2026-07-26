import { useState, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Plus,
  Search,
  Gamepad2,
  Image as ImageIcon,
  Trash2,
  Clock,
  MoreVertical,
  ArrowUpDown,
  Copy,
} from 'lucide-react';
// 只引用 getProjectsList 和 saveProjectsList，不再引用 getWorkspaceData
import { getProjectsList, saveProjectsList, loadProjectContent, saveProjectContent, ProjectMeta } from '../../utils/storage';
import { toast } from '../../utils/toast';
import { confirmDialog } from '../../utils/confirm';

interface DashboardProps {
  onOpenProject: (project: ProjectMeta) => void;
}

type SortMode = 'recent' | 'name';

function relativeTime(ts?: number): string {
  if (!ts) return '尚未编辑';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const date = new Date(ts);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export function Dashboard({ onOpenProject }: DashboardProps) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>(
    () => ((localStorage.getItem('gp_dash_sort') as SortMode) || 'recent'),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; targetId: string }>({
    visible: false,
    x: 0,
    y: 0,
    targetId: '',
  });

  useEffect(() => {
    setProjects(getProjectsList());
    const handleClickOutside = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // 新建项目
  const createProject = () => {
    const newProject: ProjectMeta = {
      id: uuidv4(),
      name: '未命名新项目',
      cover: '',
      lastModified: Date.now(),
    };
    const newList = [newProject, ...projects];
    setProjects(newList);
    saveProjectsList(newList);
    toast.success('已创建新项目');
  };

  // 记住排序偏好
  useEffect(() => {
    localStorage.setItem('gp_dash_sort', sortMode);
  }, [sortMode]);

  // 快捷键：Ctrl/Cmd + N 新建项目
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        createProject();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [projects]);

  // 创建副本
  const duplicateProject = () => {
    const source = projects.find((p) => p.id === contextMenu.targetId);
    setContextMenu((prev) => ({ ...prev, visible: false }));
    if (!source) return;
    const newId = uuidv4();
    const cloned = JSON.parse(JSON.stringify(loadProjectContent(source.id)));
    const newMeta: ProjectMeta = {
      id: newId,
      name: `${source.name} 副本`,
      cover: source.cover,
      lastModified: Date.now(),
    };
    const newList = [newMeta, ...projects];
    setProjects(newList);
    saveProjectsList(newList); // 先写入列表，saveProjectContent 才能更新其修改时间
    saveProjectContent(newId, cloned);
    toast.success('已创建副本');
  };

  // 右键逻辑
  const openMenuAt = (x: number, y: number, id: string) => {
    // clamp so the menu stays on-screen
    const menuW = 160;
    const menuH = 132;
    const clampedX = Math.min(x, window.innerWidth - menuW - 8);
    const clampedY = Math.min(y, window.innerHeight - menuH - 8);
    setContextMenu({ visible: true, x: clampedX, y: clampedY, targetId: id });
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY, id);
  };

  // 封面上传
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && contextMenu.targetId) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newList = projects.map((p) =>
          p.id === contextMenu.targetId ? { ...p, cover: ev.target?.result as string } : p,
        );
        setProjects(newList);
        saveProjectsList(newList);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // 改名
  const updateName = (id: string, name: string) => {
    const newList = projects.map((p) => (p.id === id ? { ...p, name } : p));
    setProjects(newList);
    saveProjectsList(newList);
  };

  // 删除
  const deleteProject = async () => {
    const target = projects.find((p) => p.id === contextMenu.targetId);
    const targetId = contextMenu.targetId;
    setContextMenu((prev) => ({ ...prev, visible: false }));
    const ok = await confirmDialog({
      title: '确定删除项目？',
      message: target ? `“${target.name}” 及其所有内容将被永久删除，此操作无法撤销。` : '此操作无法撤销。',
      confirmText: '删除',
      danger: true,
    });
    if (ok) {
      const newList = projects.filter((p) => p.id !== targetId);
      setProjects(newList);
      saveProjectsList(newList);
      toast.success('已删除项目');
    }
  };

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects.slice();
    filtered.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN');
      return (b.lastModified || 0) - (a.lastModified || 0);
    });
    return filtered;
  }, [projects, query, sortMode]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-bg text-content">
      {/* Ambient background flourish */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -right-32 top-20 h-80 w-80 rounded-full bg-iris-500/10 blur-3xl" />
      </div>

      <input type="file" ref={fileInputRef} onChange={handleCoverUpload} className="hidden" accept="image/*" />

      {/* Header */}
      <header className="relative z-10 shrink-0 px-6 pt-8 md:px-10 md:pt-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-brand-500/30 bg-brand-500/10 text-brand-400 shadow-glow">
              <Gamepad2 size={24} />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
                Game Planner <span className="text-gradient-brand">Pro</span>
              </h1>
              <p className="mt-0.5 text-sm text-muted">项目管理大厅 · 共 {projects.length} 个项目</p>
            </div>
          </div>

          {/* Search + sort */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索项目…"
                className="input w-52 pl-9"
              />
            </div>
            <button
              onClick={() => setSortMode((m) => (m === 'recent' ? 'name' : 'recent'))}
              title="切换排序方式"
              className="btn-outline whitespace-nowrap"
            >
              <ArrowUpDown size={15} />
              {sortMode === 'recent' ? '最近编辑' : '名称'}
            </button>
          </div>
        </div>
        <div className="mt-6 h-px bg-gradient-to-r from-line via-line/50 to-transparent" />
      </header>

      {/* Grid */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-24 pt-6 md:px-10">
        <div className="grid grid-cols-2 content-start gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {/* Create card */}
          <button
            onClick={createProject}
            className="group flex aspect-[4/3] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-line-strong/70 bg-surface/40 transition-all hover:border-brand-500/70 hover:bg-surface-2/60"
          >
            <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-3 text-subtle transition-all group-hover:scale-110 group-hover:bg-brand-500/15 group-hover:text-brand-400">
              <Plus size={22} />
            </div>
            <span className="text-sm font-medium text-muted group-hover:text-content">创建新项目</span>
          </button>

          {/* Project cards */}
          {visibleProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => onOpenProject(project)}
              onContextMenu={(e) => handleContextMenu(e, project.id)}
              className="group relative flex aspect-[4/3] cursor-pointer animate-fade-in-up flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-elevated"
            >
              {/* Cover */}
              <div className="relative flex-1 overflow-hidden bg-gradient-to-br from-surface-2 to-bg">
                {project.cover ? (
                  <img
                    src={project.cover}
                    className="pointer-events-none h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    alt=""
                  />
                ) : (
                  <div className="pointer-events-none flex h-full w-full items-center justify-center">
                    <Gamepad2 size={40} className="text-line-strong" />
                  </div>
                )}
                {/* hover overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                {/* kebab menu button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    openMenuAt(rect.right, rect.bottom, project.id);
                  }}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-black/40 text-white/80 opacity-0 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white group-hover:opacity-100"
                >
                  <MoreVertical size={15} />
                </button>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2 border-t border-line bg-surface px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <div className="min-w-0 flex-1">
                  <input
                    value={project.name}
                    onChange={(e) => updateName(project.id, e.target.value)}
                    className="w-full truncate rounded bg-transparent text-sm font-semibold text-content outline-none focus:bg-surface-2 focus:px-1"
                  />
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-subtle">
                    <Clock size={11} />
                    {relativeTime(project.lastModified)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* First-run empty state */}
        {projects.length === 0 && (
          <div className="mt-14 flex flex-col items-center gap-3 text-center animate-fade-in-up">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface-2/60 text-subtle">
              <Gamepad2 size={30} />
            </div>
            <h2 className="text-lg font-semibold text-content">开始你的第一个游戏项目</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              点击上方「创建新项目」，或按 <kbd>Ctrl</kbd> + <kbd>N</kbd> 快速新建。
              灵感白板、策划文档、UI 原型，都从这里开始。
            </p>
          </div>
        )}

        {/* Empty state (no matches) */}
        {visibleProjects.length === 0 && query.trim() && (
          <div className="mt-16 flex flex-col items-center gap-2 text-center text-muted">
            <Search size={28} className="text-line-strong" />
            <p className="text-sm">没有找到匹配 “{query}” 的项目</p>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu.visible && (
        <div
          className="glass fixed z-[9999] w-40 animate-scale-in rounded-xl py-1 shadow-elevated"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-content transition-colors hover:bg-surface-3"
          >
            <ImageIcon size={15} className="text-muted" />
            更换封面
          </button>
          <button
            onClick={duplicateProject}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-content transition-colors hover:bg-surface-3"
          >
            <Copy size={15} className="text-muted" />
            创建副本
          </button>
          <button
            onClick={deleteProject}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
          >
            <Trash2 size={15} />
            删除项目
          </button>
        </div>
      )}
    </div>
  );
}
