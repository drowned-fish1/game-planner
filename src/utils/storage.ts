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

// === 项目详细内容 ===
export interface ProjectContent {
  brainstorm: { items: any[]; connections: any[] };
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
  configs: any; // 预留给 AI 配置等
}

// 帮助函数：获取 Electron API
const getElectronAPI = () => {
  // @ts-ignore
  return window.electronAPI;
};

// --- 核心：加载整个数据库 ---
const loadGlobalStore = (): GlobalStore => {
  const api = getElectronAPI();
  let rawData: string | null = null;

  if (api && api.sendSync) {
    // Electron 环境：从硬盘同步读取
    try {
      rawData = api.sendSync('load-data-sync');
    } catch (e) {
      console.error("IPC Load Error", e);
    }
  } else {
    // 浏览器环境 fallback (仅用于调试)
    rawData = localStorage.getItem('gp_all_data');
  }

  if (!rawData) {
    return { projects: [], contents: {}, configs: {} };
  }

  try {
    return JSON.parse(rawData);
  } catch (e) {
    console.error("Data corrupted:", e);
    return { projects: [], contents: {}, configs: {} };
  }
};

// --- 核心：保存整个数据库 ---
const saveGlobalStore = (store: GlobalStore) => {
  const api = getElectronAPI();
  const rawData = JSON.stringify(store);

  if (api && api.sendSync) {
    // Electron 环境：写入硬盘
    api.sendSync('save-data-sync', rawData);
  } else {
    // 浏览器环境 fallback
    try {
      localStorage.setItem('gp_all_data', rawData);
    } catch (e) {
      console.error("LocalStorage quota exceeded");
    }
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
      parsed.ui.pages.forEach((page: any) => {
        if (!page.type) page.type = 'screen';
        if (!page.components) page.components = [];

        page.components.forEach((comp: any) => {
          if (!comp.interaction) comp.interaction = { type: 'none' };
          if (!comp.state) comp.state = { isVisible: true, isActive: false, isDisabled: false };
          if (typeof comp.zIndex !== 'number') comp.zIndex = 1;
          
          if (comp.type === 'fixed') {
             comp.type = 'sprite';
             comp.interaction = { type: 'none' };
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