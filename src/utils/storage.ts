// src/utils/storage.ts

// ==========================================
// 1. 核心类型定义
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

// === 自定义资产结构 (新增) ===
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

// === 项目详细内容 (更新) ===
export interface ProjectContent {
  brainstorm: { items: any[]; connections: any[] };
  members: TeamMember[];
  todos: TodoItem[];
  docs: DocItem[];
  // 新增：项目中自定义的资产列表
  assets: CustomAsset[]; 
  ui: {
    pages: UIPage[];
    startPageId?: string;
  };
}

// ==========================================
// 2. 数据存储逻辑
// ==========================================

const LIST_KEY = 'gp_projects_list';

export const getProjectsList = (): ProjectMeta[] => {
  const data = localStorage.getItem(LIST_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveProjectsList = (list: ProjectMeta[]) => {
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
};

export const loadProjectContent = (projectId: string): ProjectContent => {
  const key = `gp_project_${projectId}`;
  const data = localStorage.getItem(key);
  
  // 默认空结构
  const emptyContent: ProjectContent = { 
    brainstorm: { items: [], connections: [] }, 
    members: [], 
    todos: [],
    docs: [], 
    assets: [], // 初始化为空数组
    ui: { pages: [] }, 
  };

  if (!data) return emptyContent;

  try {
    const parsed = JSON.parse(data);

    // === 数据清洗与补全 ===
    if (!parsed.assets) parsed.assets = []; // 补全 assets 字段

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
    console.error("Failed to load project content:", e);
    return emptyContent;
  }
};

export const saveProjectContent = (projectId: string, content: ProjectContent) => {
  const key = `gp_project_${projectId}`;
  localStorage.setItem(key, JSON.stringify(content));
  
  const list = getProjectsList();
  const index = list.findIndex(p => p.id === projectId);
  if (index !== -1) {
    list[index].lastModified = Date.now();
    saveProjectsList(list);
  }
};