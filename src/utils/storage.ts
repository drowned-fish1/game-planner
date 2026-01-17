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
  ui: any[];
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
      docs: [], // 初始为空
      ui: [] 
    };
  }
  return JSON.parse(data);
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
