// src/utils/storage.ts

// ==========================================
// 1. 核心类型定义 (保持不变)
// ==========================================

export interface ProjectMeta {
  id: string;
  name: string;
  cover: string;
  lastModified: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  avatar?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  assigneeId?: string;
}

export interface DocItem {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  expanded?: boolean;
}

// === 自定义资产结构 ===
export interface CustomAsset {
  id: string;       // 唯一ID
  label: string;    // 资产名
  imageUrl?: string;// 图片源 (Base64 或 路径)
  x: number;        // 源切片 X
  y: number;        // 源切片 Y
  w: number;        // 源切片 W
  h: number;        // 源切片 H
}

// === UI 原型机相关类型 ===
export type PageType = 'screen' | 'modal_center' | 'modal_bottom' | 'sidebar_left' | 'sidebar_right' | 'toast' | 'fullscreen_modal';

export type InteractionType = 
  | 'none' | 'navigate' | 'open_modal' | 'close_modal' 
  | 'back' | 'toggle' | 'increment' | 'trigger_cond';

export interface ComponentState {
  isDisabled?: boolean;
  isActive?: boolean;
  isExpanded?: boolean;
  isChecked?: boolean;
  isVisible?: boolean;
}

export interface UIComponent {
  id: string;
  name: string;
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code' | 'sprite';
  src?: string; // 对应 CustomAsset.id
  text?: string;
  
  // 几何属性
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  customScale?: number;

  // 状态与逻辑
  state: ComponentState;
  interaction: {
    type: InteractionType;
    targetId?: string;
    param?: string;
  };
}

export interface UIPage {
  id: string;
  name: string;
  type: PageType;
  width: number;
  height: number;
  backgroundColor: string;
  components: UIComponent[];
}

// === 白板（Brainstorm）相关类型 ===
export type BrainstormItemType =
  | 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code' | 'ai' | 'note' | 'drawing';

export type BrainstormHandle = 'top' | 'right' | 'bottom' | 'left';

export interface BrainstormItem {
  id: string;
  type: BrainstormItemType;
  content: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface BrainstormConnection {
  id: string;
  start: string;
  end: string;
  startHandle?: BrainstormHandle;
  endHandle?: BrainstormHandle;
}

// === 项目详细内容 ===
export interface ProjectContent {
  brainstorm: { items: BrainstormItem[]; connections: BrainstormConnection[] };
  members: TeamMember[];
  todos: TodoItem[];
  docs: DocItem[];
  assets: CustomAsset[];
  ui: {
    pages: UIPage[];
    startPageId?: string;
  };
}

// ==========================================
// 2. 硬盘存储逻辑 (核心修改)
// ==========================================

// 定义全量数据结构 (所有项目存同一个文件)
interface GlobalStore {
  projects: ProjectMeta[];
  contents: Record<string, ProjectContent>; // key是projectId
  configs: Record<string, unknown>; // 预留给 AI 配置等
}

// 帮助函数：获取 Electron API
const getElectronAPI = () => {
  return window.electronAPI;
};

const STORE_KEY = 'gp_all_data';
// 浏览器端滚动备份键（Electron 端备份由主进程 storage-guard 负责）
const STORE_BACKUP_KEY = 'gp_all_data_backup';
const BROWSER_BACKUP_EVERY_N_SAVES = 20;

// 进程内原始串缓存：autosave 每 2 秒触发多次 load→改→save，
// 缓存后免去每次同步 IPC 读盘/localStorage 读取；语义与旧实现一致
// （每次 load 仍重新 JSON.parse，调用方拿到的是独立对象，无别名风险）。
// 注意：若未来出现多窗口同时写库，需改为失效通知机制。
let rawCache: string | null = null;
let cacheReady = false;
let browserSavesSinceBackup = 0;
// 「损坏已从备份恢复」的一次性通知（浏览器端路径；Electron 端由主进程提供）
let recoveryNotice: string | null = null;
// 恢复备份流程中冻结写入：防止「恢复写盘 → reload 前挂起的 autosave 定时器
// 把内存里的旧数据整库写回」这一竞态覆盖恢复结果（E2E 实测踩到过）
let writesFrozen = false;

/** 恢复备份前调用：丢弃 reload 前的一切写入 */
export const freezeStorageWrites = () => {
  writesFrozen = true;
};

/** 恢复失败时调用：解除冻结恢复正常保存 */
export const unfreezeStorageWrites = () => {
  writesFrozen = false;
};

/** 测试专用：清空模块级缓存状态 */
export const resetStorageCacheForTests = () => {
  rawCache = null;
  cacheReady = false;
  browserSavesSinceBackup = 0;
  recoveryNotice = null;
  writesFrozen = false;
};

/** 取出并清空一次性的「已从备份恢复」通知（App 启动时展示给用户） */
export const consumeStorageRecoveryNotice = (): string | null => {
  const notice = recoveryNotice;
  recoveryNotice = null;
  return notice;
};

const parseStore = (raw: string): GlobalStore | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed
      || typeof parsed !== 'object'
      || Array.isArray(parsed)
      || !Array.isArray((parsed as Partial<GlobalStore>).projects)
      || !(parsed as Partial<GlobalStore>).contents
      || typeof (parsed as Partial<GlobalStore>).contents !== 'object'
      || Array.isArray((parsed as Partial<GlobalStore>).contents)
    ) {
      return null;
    }

    const candidate = parsed as Partial<GlobalStore>;
    if (
      candidate.configs !== undefined
      && (
        !candidate.configs
        || typeof candidate.configs !== 'object'
        || Array.isArray(candidate.configs)
      )
    ) {
      return null;
    }

    return {
      projects: candidate.projects as ProjectMeta[],
      contents: candidate.contents as Record<string, ProjectContent>,
      configs: candidate.configs ?? {},
    };
  } catch {
    return null;
  }
};

const readRawFromBackend = (): string | null => {
  const api = getElectronAPI();
  if (api && api.sendSync) {
    // Electron 环境：主进程 storage-guard 负责损坏检测与备份回退
    try {
      return api.sendSync('load-data-sync') as string | null;
    } catch (e) {
      console.error("IPC Load Error", e);
      return null;
    }
  }

  // 浏览器环境 fallback；隐私模式等场景下 getItem 也可能抛错
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch (e) {
    console.error("LocalStorage Load Error", e);
    return null;
  }

  if (raw !== null && parseStore(raw) === null) {
    // 主键损坏：尝试浏览器备份键；决不能返回空库让下次保存覆盖真实数据
    console.error("Data corrupted, trying browser backup key");
    let backup: string | null = null;
    try {
      backup = localStorage.getItem(STORE_BACKUP_KEY);
    } catch { /* 备份键读取失败按无备份处理 */ }

    if (backup !== null && parseStore(backup) !== null) {
      try {
        localStorage.setItem(STORE_KEY, backup);
      } catch { /* 回写失败不影响本次恢复使用 */ }
      recoveryNotice = '主数据损坏，已从本地备份恢复';
      return backup;
    }
    // 无可用备份：保留损坏原文到备份键位（人工可抢救），返回 null 走空库
    try {
      localStorage.setItem(`${STORE_KEY}_corrupt`, raw);
    } catch { /* 抢救现场失败可忽略 */ }
    recoveryNotice = '主数据损坏且无可用备份，已重置（损坏原文保留在 gp_all_data_corrupt）';
    return null;
  }

  return raw;
};

// --- 核心：加载整个数据库 ---
const loadGlobalStore = (): GlobalStore => {
  if (!cacheReady) {
    rawCache = readRawFromBackend();
    cacheReady = true;
  }

  if (!rawCache) {
    return { projects: [], contents: {}, configs: {} };
  }

  const parsed = parseStore(rawCache);
  if (!parsed) {
    // 缓存内容异常（理论不可达：写入侧已校验），防御性返回空库但不落盘
    console.error("Cached store unparsable");
    return { projects: [], contents: {}, configs: {} };
  }
  return parsed;
};

// --- 核心：保存整个数据库 ---
const saveGlobalStore = (store: GlobalStore) => {
  if (writesFrozen) {
    console.warn('Storage write dropped: restore in progress');
    return;
  }

  const api = getElectronAPI();
  const rawData = JSON.stringify(store);

  // 无论后端写入是否成功，内存缓存都以最新内容为准（会话内数据不回退）
  rawCache = rawData;
  cacheReady = true;

  if (api && api.sendSync) {
    // Electron 环境：主进程原子写入+备份轮换；IPC 失败不应让保存调用方崩溃
    try {
      api.sendSync('save-data-sync', rawData);
    } catch (e) {
      console.error("IPC Save Error", e);
    }
  } else {
    // 浏览器环境 fallback
    try {
      localStorage.setItem(STORE_KEY, rawData);
      browserSavesSinceBackup += 1;
      if (browserSavesSinceBackup >= BROWSER_BACKUP_EVERY_N_SAVES) {
        localStorage.setItem(STORE_BACKUP_KEY, rawData);
        browserSavesSinceBackup = 0;
      }
    } catch (e) {
      console.error("LocalStorage quota exceeded", e);
    }
  }
};

/** 浏览器端手动备份当前数据到备份键；Electron 端请走主进程 storage:snapshot-now */
export const backupNowInBrowser = (): boolean => {
  const store = loadGlobalStore();
  try {
    localStorage.setItem(STORE_BACKUP_KEY, JSON.stringify(store));
    browserSavesSinceBackup = 0;
    return true;
  } catch (e) {
    console.error("Browser backup failed", e);
    return false;
  }
};

/** 浏览器端备份信息（无备份返回 null） */
export const getBrowserBackupInfo = (): { size: number } | null => {
  try {
    const backup = localStorage.getItem(STORE_BACKUP_KEY);
    if (backup === null || parseStore(backup) === null) return null;
    return { size: backup.length };
  } catch {
    return null;
  }
};

/** 浏览器端从备份键恢复（覆盖当前数据）；成功后调用方应刷新页面 */
export const restoreBrowserBackup = (): boolean => {
  try {
    const backup = localStorage.getItem(STORE_BACKUP_KEY);
    if (backup === null || parseStore(backup) === null) return false;
    localStorage.setItem(STORE_KEY, backup);
    rawCache = backup;
    cacheReady = true;
    return true;
  } catch (e) {
    console.error("Browser restore failed", e);
    return false;
  }
};

// ==========================================
// 3. 导出 API (接口保持不变，底层已换)
// ==========================================

export const getProjectsList = (): ProjectMeta[] => {
  const store = loadGlobalStore();
  return store.projects || [];
};

export const saveProjectsList = (list: ProjectMeta[]) => {
  const store = loadGlobalStore();
  store.projects = list;
  saveGlobalStore(store);
};

export const loadProjectContent = (projectId: string): ProjectContent => {
  const store = loadGlobalStore();
  const content = store.contents[projectId];
  
  // 默认空项目结构
  const emptyContent: ProjectContent = { 
    brainstorm: { items: [], connections: [] }, 
    members: [], 
    todos: [],
    docs: [], 
    assets: [], 
    ui: { pages: [] }, 
  };

  // 如果没有内容，返回空的
  if (!content) return emptyContent;

  // === 数据清洗与补全 (保留你原有的逻辑) ===
  try {
    // 浅拷贝一份以防止直接修改引用
    const parsed = { ...content };

    if (!parsed.assets) parsed.assets = []; 

    if (parsed.ui && Array.isArray(parsed.ui.pages)) {
      parsed.ui.pages.forEach((page) => {
        if (!page.type) page.type = 'screen';
        if (!page.components) page.components = [];

        page.components.forEach((comp) => {
          // 旧版本存档里组件可能缺字段、type 还可能是已废弃的 'fixed'
          const legacy = comp as Omit<UIComponent, 'type'> & { type: UIComponent['type'] | 'fixed' };
          if (!legacy.interaction) legacy.interaction = { type: 'none' };
          if (!legacy.state) legacy.state = { isVisible: true, isActive: false, isDisabled: false };
          if (typeof legacy.zIndex !== 'number') legacy.zIndex = 1;

          if (legacy.type === 'fixed') {
            legacy.type = 'sprite';
            legacy.interaction = { type: 'none' };
          }
        });
      });
    }
    return parsed;
  } catch (e) {
    console.error("Failed to parse project content structure:", e);
    return emptyContent;
  }
};

export const saveProjectContent = (projectId: string, content: ProjectContent) => {
  const store = loadGlobalStore();
  store.contents[projectId] = content;

  // 同时更新列表里的修改时间
  const idx = store.projects.findIndex(p => p.id === projectId);
  if (idx !== -1) {
    store.projects[idx].lastModified = Date.now();
  }

  saveGlobalStore(store);
};

// ==========================================
// 4. 项目导入 / 导出
// ==========================================

export interface ProjectExportFile {
  format: 'game-planner-project';
  version: 1;
  exportedAt: number;
  meta: ProjectMeta;
  content: ProjectContent;
}

export const exportProject = (projectId: string): ProjectExportFile | null => {
  const store = loadGlobalStore();
  const meta = store.projects.find(p => p.id === projectId);
  if (!meta) return null;
  return {
    format: 'game-planner-project',
    version: 1,
    exportedAt: Date.now(),
    meta: { ...meta },
    content: loadProjectContent(projectId),
  };
};

// 解析导出文件并作为新项目导入（新 id、深拷贝内容）。格式不对时抛出中文错误信息。
export const importProject = (raw: string): ProjectMeta => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }

  // 未验证前按候选形状处理，逐字段校验后再收敛为具体类型
  const data = parsed as {
    format?: unknown;
    version?: unknown;
    meta?: { name?: unknown; cover?: unknown };
    content?: unknown;
  } | null;

  if (
    !data
    || typeof data !== 'object'
    || data.format !== 'game-planner-project'
    || data.version !== 1
    || !data.meta
    || !data.content
  ) {
    throw new Error('文件不是 Game Planner 的项目导出文件');
  }

  const newMeta: ProjectMeta = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: typeof data.meta.name === 'string' && data.meta.name.trim() ? data.meta.name : '导入的项目',
    cover: typeof data.meta.cover === 'string' ? data.meta.cover : '',
    lastModified: Date.now(),
  };

  const content = JSON.parse(JSON.stringify(data.content)) as ProjectContent;

  const store = loadGlobalStore();
  store.projects = [newMeta, ...store.projects];
  store.contents[newMeta.id] = content;
  saveGlobalStore(store);
  return newMeta;
};
