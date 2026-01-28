// src/App.tsx
import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { BrainstormBoard } from './components/Brainstorm/Board';
import { TeamManager } from './components/Team/TeamManager';
import { ProjectMeta, ProjectContent, loadProjectContent, saveProjectContent } from './utils/storage';
import { Docs } from './components/Docs/Docs';
import { UIManager } from './components/UIPrototype/UIManager';
import { Settings } from './components/Settings/Settings';
import { 
  Settings as SettingsIcon, 
  Lightbulb, 
  Users, 
  FileText, 
  Layout, 
  ChevronLeft,
  Menu
} from 'lucide-react'; 

// 定义模块类型
type ModuleType = 'brainstorm' | 'docs' | 'ui-designer' | 'team' | 'ui' | 'settings';

function App() {
  const [currentProject, setCurrentProject] = useState<ProjectMeta | null>(null);
  const [projectContent, setProjectContent] = useState<ProjectContent | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const openProject = (project: ProjectMeta) => {
    setCurrentProject(project);
    setProjectContent(loadProjectContent(project.id));
  };

  const closeProject = () => {
    if (currentProject && projectContent) saveProjectContent(currentProject.id, projectContent);
    setCurrentProject(null);
    setProjectContent(null);
  };

  // 自动保存逻辑
  useEffect(() => {
    if (!currentProject || !projectContent) return;
    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      saveProjectContent(currentProject.id, projectContent);
      setTimeout(() => setSaveStatus('saved'), 500);
    }, 2000);
    return () => clearTimeout(timer);
  }, [projectContent]);

  // Ctrl+S 快捷键保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentProject && projectContent) {
          setSaveStatus('saving');
          saveProjectContent(currentProject.id, projectContent);
          setTimeout(() => setSaveStatus('saved'), 500);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProject, projectContent]);

  if (!currentProject) return <Dashboard onOpenProject={openProject} />;
  if (!projectContent) return <div className="h-screen w-screen bg-slate-900 text-white flex items-center justify-center">加载数据中...</div>;

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-200 overflow-hidden flex-col md:flex-row">
       <ProjectEditorLayout 
         project={currentProject} 
         content={projectContent} 
         setContent={setProjectContent}
         onBack={closeProject}
         saveStatus={saveStatus}
       />
    </div>
  );
}

function ProjectEditorLayout({ project, content, setContent, onBack, saveStatus }: any) {
  const [activeModule, setActiveModule] = useState<ModuleType>('brainstorm');

  // === 数据更新处理函数 (保留完整逻辑) ===
  const handleBrainstormChange = (newItems: any[], newConnections: any[]) => {
    setContent((prev: any) => {
      if (!prev) return null;
      return { ...prev, brainstorm: { items: newItems, connections: newConnections } };
    });
  };

  const handleUpdateMembers = (newMembers: any[]) => {
    setContent((prev: any) => {
      if (!prev) return null;
      return { ...prev, members: newMembers };
    });
  };

  const handleUpdateTodos = (newTodos: any[]) => {
    setContent((prev: any) => {
      if (!prev) return null;
      return { ...prev, todos: newTodos };
    });
  };

  const handleUpdateDocs = (newDocs: any[]) => {
    setContent((prev: any) => {
      if (!prev) return null;
      return { ...prev, docs: newDocs };
    });
  };

  const handleUpdateUI = (newUIData: any) => {
    setContent((prev: any) => {
      if (!prev) return null;
      return { ...prev, ui: newUIData };
    });
  };

  // 渲染当前激活的模块
  const renderModule = () => {
    switch(activeModule) {
      case 'brainstorm': 
        return <BrainstormBoard key={project.id + '-brainstorm'} initialItems={content.brainstorm?.items || []} initialConnections={content.brainstorm?.connections || []} onDataChange={handleBrainstormChange} />;
      case 'team': 
        return <TeamManager members={content.members || []} todos={content.todos || []} onUpdateMembers={handleUpdateMembers} onUpdateTodos={handleUpdateTodos} />;
      case 'docs': 
        return <Docs initialDocs={content.docs || []} onUpdate={handleUpdateDocs} />;
      case 'ui': 
        return <UIManager data={content.ui || { pages: [] }} onUpdate={handleUpdateUI} />;
      case 'settings': 
        return <Settings />;
      default: 
        return null;
    }
  };

  return (
    <>
      {/* === 桌面端侧边栏 (MD及以上显示) === */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-slate-800 border-r border-slate-700 z-50">
        <div className="h-14 flex items-center px-4 border-b border-slate-700 gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="font-bold text-white truncate flex-1">{project.name}</div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarBtn icon={<Lightbulb size={18}/>} label="灵感白板" isActive={activeModule === 'brainstorm'} onClick={() => setActiveModule('brainstorm')} />
          <SidebarBtn icon={<Users size={18}/>} label="团队管理" isActive={activeModule === 'team'} onClick={() => setActiveModule('team')} />
          <SidebarBtn icon={<FileText size={18}/>} label="策划文档" isActive={activeModule === 'docs'} onClick={() => setActiveModule('docs')} />
          <SidebarBtn icon={<Layout size={18}/>} label="UI 原型机" isActive={activeModule === 'ui'} onClick={() => setActiveModule('ui')} />
          
          <div className="h-px bg-slate-700 my-2"></div>
          
          <button 
             onClick={() => setActiveModule('settings')}
             className={`w-full text-left px-4 py-3 rounded-md transition-all flex items-center gap-3 ${activeModule === 'settings' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
             <SettingsIcon size={18} /> 设置
          </button>
        </nav>

        <div className="p-4 text-xs border-t border-slate-700 text-center text-slate-500">
           {saveStatus === 'saving' ? '💾 保存中...' : '✔ 已保存'}
        </div>
      </aside>

      {/* === 移动端顶部栏 (MD以下显示) === */}
      <div 
        className="md:hidden bg-slate-800 border-b border-slate-700 flex items-end px-4 justify-between shrink-0 pb-3"
        style={{ 
          height: 'calc(3.5rem + env(safe-area-inset-top))', // 适配全面屏顶部
          paddingTop: 'env(safe-area-inset-top)' 
        }}
      >
          <button onClick={onBack} className="text-slate-300 p-1"><ChevronLeft size={24}/></button>
          <span className="font-bold text-white mb-1">{project.name}</span>
          <button onClick={() => setActiveModule('settings')} className="text-slate-300 p-1"><SettingsIcon size={20}/></button>
      </div>

      {/* === 主内容区 === */}
      <main className="flex-1 relative overflow-hidden bg-slate-900 pb-16 md:pb-0"> 
        {renderModule()}
      </main>

      {/* === 移动端底部导航栏 (MD以下显示) === */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-800 border-t border-slate-700 flex justify-around items-center z-[9999] pb-[env(safe-area-inset-bottom)]">
          <MobileNavBtn icon={<Lightbulb size={20}/>} label="白板" isActive={activeModule === 'brainstorm'} onClick={() => setActiveModule('brainstorm')} />
          <MobileNavBtn icon={<Users size={20}/>} label="团队" isActive={activeModule === 'team'} onClick={() => setActiveModule('team')} />
          <MobileNavBtn icon={<FileText size={20}/>} label="文档" isActive={activeModule === 'docs'} onClick={() => setActiveModule('docs')} />
          {/* UI 原型机在手机端操作不便，暂不放入底部导航，可通过侧边栏或后续添加 */}
      </div>
    </>
  );
}

// 桌面端侧边栏按钮组件
function SidebarBtn({ icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-md transition-all flex items-center gap-3 ${isActive ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

// 移动端底部导航按钮组件
function MobileNavBtn({ icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

export default App;