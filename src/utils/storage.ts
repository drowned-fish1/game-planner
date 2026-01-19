// src/utils/storage.ts

// === 基础元数据 ===
export interface ProjectMeta {
  id: string;
  name: string;
  cover: string;
  lastModified: number;
}

// === 团队成员结构 ===
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  avatar?: string;
}

// === 待办事项结构 ===
export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  assigneeId?: string;
}

// === 新增：文档结构 ===
export interface DocItem {
  id: string;
  title: string;
  content: string; // HTML 格式的内容
  parentId: string | null; // 用于树状结构，null 表示根节点
  expanded?: boolean; // 目录是否展开
}

// === 项目详细内容 ===
export interface ProjectContent {
  brainstorm: { items: any[]; connections: any[] };
  members: TeamMember[];
  todos: TodoItem[];
  // 修改：这里使用具体的 DocItem[] 类型，而不是 any[]
  docs: DocItem[];
  ui: {
    pages: UIPage[];
    startPageId?: string; // 预览时从哪个页面开始
  };
}

const LIST_KEY = 'gp_projects_list';

// === 项目列表管理 ===
export const getProjectsList = (): ProjectMeta[] => {
  const data = localStorage.getItem(LIST_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveProjectsList = (list: ProjectMeta[]) => {
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
};

// === 单个项目内容管理 ===
export const loadProjectContent = (projectId: string): ProjectContent => {
  const key = `gp_project_${projectId}`;
  const data = localStorage.getItem(key);
  if (!data) {
    return { 
      brainstorm: { items: [], connections: [] }, 
      members: [], 
      todos: [],
      docs: [], 
      ui: { pages: [] }, // 修正初始值
    };
  }
  // 兼容旧数据的补丁（防止报错）
  const parsed = JSON.parse(data);
  // ... 在 JSON.parse(data) 之后 ...

    // 2. 数据清洗与迁移
    if (parsed.ui && Array.isArray(parsed.ui.pages)) {
      parsed.ui.pages.forEach((page: any) => {
        // === 新增修复：给页面补上 type 字段 ===
        if (!page.type) {
          page.type = 'screen'; // 默认为 PC 标准屏
        }

        // 确保 components 存在
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
// ... 原有的 TeamMember, TodoItem, DocItem 保持不变 ...

// === UI 原型机数据结构 ===

// 1. 组件行为类型
// ... 前面的 TeamMember, TodoItem, DocItem 保持不变 ...

// === UI 原型机核心数据结构 v2.0 ===

// 页面类型预设
export type PageType = 'screen' | 'modal_center' | 'modal_bottom' | 'sidebar_left' | 'sidebar_right' | 'toast' | 'fullscreen_modal';

// 组件交互动作
export type InteractionType = 
  | 'none'          // 无
  | 'navigate'      // 跳转页面
  | 'open_modal'    // 打开弹窗 (叠加)
  | 'close_modal'   // 关闭当前弹窗 (叉掉)
  | 'back'          // 返回上一页
  | 'toggle'        // 开关切换
  | 'increment'     // 数值增加 (数字跳动)
  | 'trigger_cond'; // 条件触发

// 组件视觉状态
export interface ComponentState {
  isDisabled?: boolean;   // 禁用 (置灰, 不可点)
  isActive?: boolean;     // 激活 (高亮)
  isExpanded?: boolean;   // 展开/收起
  isChecked?: boolean;    // 开关开启状态
  isVisible?: boolean;    // 是否可见
}

// 单个 UI 组件
export interface UIComponent {
  id: string;
  name: string;
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code' | 'sprite'; // 增加 sprite 类型
  src?: string; // 精灵图 ID
  text?: string;
  
  // 几何属性
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number; // 层级 (新)
  customScale?: number;

  // 状态与逻辑
  state: ComponentState; // 默认状态
  interaction: {
    type: InteractionType;
    targetId?: string; // 目标页面ID 或 弹窗ID
    param?: string;    // 额外参数 (如增加的数值, 或提示文本)
  };
}

// 单个 UI 页面
export interface UIPage {
  id: string;
  name: string;
  type: PageType; // 页面类型 (新)
  width: number;
  height: number;
  backgroundColor: string;
  components: UIComponent[];
}

export interface ProjectContent {
  brainstorm: { items: any[]; connections: any[] };
  members: TeamMember[];
  todos: TodoItem[];
  docs: DocItem[];
  ui: {
    pages: UIPage[];
    startPageId?: string;
  }; 
}

// ... load/save 函数保持不变 ...