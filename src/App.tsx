import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { BrainstormBoard } from './components/Brainstorm/Board';
import { TeamManager } from './components/Team/TeamManager';
import { ProjectMeta, ProjectContent, loadProjectContent, saveProjectContent } from './utils/storage';
import { Docs } from './components/Docs/Docs'; // 引入 Docs 组件
import { UIManager } from './components/UIPrototype/UIManager';
<<<<<<< Updated upstream


type ModuleType = 'brainstorm' | 'docs' | 'ui-designer' | 'team' | 'ui';
=======
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

type ModuleType = 'brainstorm' | 'docs' | 'ui-designer' | 'team' | 'ui' | 'settings';
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
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

=======
>>>>>>> Stashed changes
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

  const handleBrainstormChange = (newItems: any[], newConnections: any[]) => {
    setContent((prev: any) => { if (!prev) return null; return { ...prev, brainstorm: { items: newItems, connections: newConnections } }; });
  };
  const handleUpdateMembers = (newMembers: any[]) => {
    setContent((prev: any) => { if (!prev) return null; return { ...prev, members: newMembers }; });
  };
  const handleUpdateTodos = (newTodos: any[]) => {
    setContent((prev: any) => { if (!prev) return null; return { ...prev, todos: newTodos }; });
  };
  const handleUpdateDocs = (newDocs: any[]) => {
<<<<<<< Updated upstream
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

=======
    setContent((prev: any) => { if (!prev) return null; return { ...prev, docs: newDocs }; });
  };
  const handleUpdateUI = (newUIData: any) => {
    setContent((prev: any) => { if (!prev) return null; return { ...prev, ui: newUIData }; });
  };

  // 模块渲染映射
  const renderModule = () => {
    switch(activeModule) {
      case 'brainstorm': return <BrainstormBoard key={project.id + '-brainstorm'} initialItems={content.brainstorm?.items || []} initialConnections={content.brainstorm?.connections || []} onDataChange={handleBrainstormChange} />;
      case 'team': return <TeamManager members={content.members || []} todos={content.todos || []} onUpdateMembers={handleUpdateMembers} onUpdateTodos={handleUpdateTodos} />;
      case 'docs': return <Docs initialDocs={content.docs || []} onUpdate={handleUpdateDocs} />;
      case 'ui': return <UIManager data={content.ui || { pages: [] }} onUpdate={handleUpdateUI} />;
      case 'settings': return <Settings />;
      default: return null;
    }
  };
>>>>>>> Stashed changes

  return (
    <>
      {/* === 桌面端侧边栏 (MD以上显示，手机隐藏) === */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-slate-800 border-r border-slate-700 z-50">
        <div className="h-14 flex items-center px-4 border-b border-slate-700 gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="font-bold text-white truncate flex-1">{project.name}</div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
<<<<<<< Updated upstream
          <SidebarBtn label="💡 灵感白板" isActive={activeModule === 'brainstorm'} onClick={() => setActiveModule('brainstorm')} />
          <SidebarBtn label="👥 团队管理" isActive={activeModule === 'team'} onClick={() => setActiveModule('team')} />
          <SidebarBtn label="📝 策划文档" isActive={activeModule === 'docs'} onClick={() => setActiveModule('docs')} />
          <SidebarBtn label="🎨 UI 原型机" isActive={activeModule === 'ui'} onClick={() => setActiveModule('ui')} />
=======
          <SidebarBtn icon={<Lightbulb size={18}/>} label="灵感白板" isActive={activeModule === 'brainstorm'} onClick={() => setActiveModule('brainstorm')} />
          <SidebarBtn icon={<Users size={18}/>} label="团队管理" isActive={activeModule === 'team'} onClick={() => setActiveModule('team')} />
          <SidebarBtn icon={<FileText size={18}/>} label="策划文档" isActive={activeModule === 'docs'} onClick={() => setActiveModule('docs')} />
          <SidebarBtn icon={<Layout size={18}/>} label="UI 原型机" isActive={activeModule === 'ui'} onClick={() => setActiveModule('ui')} />
          
          <div className="h-px bg-slate-700 my-2"></div>
          
          <button onClick={() => setActiveModule('settings')} className={`w-full text-left px-4 py-3 rounded-md transition-all flex items-center gap-3 ${activeModule === 'settings' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'}`}>
             <SettingsIcon size={18} /> 设置
          </button>
>>>>>>> Stashed changes
        </nav>
        <div className="p-4 text-xs border-t border-slate-700 text-center">
           {saveStatus === 'saving' ? '💾 保存中...' : '✔ 已保存'}
        </div>
      </aside>

<<<<<<< Updated upstream
      <main className="flex-1 relative overflow-hidden bg-slate-900">
        {activeModule === 'brainstorm' && (
          <BrainstormBoard 
             key={project.id + '-brainstorm'} 
             initialItems={content.brainstorm.items || []}
             initialConnections={content.brainstorm.connections || []}
             onDataChange={handleBrainstormChange}
          />
        )}
        {activeModule === 'team' && (
          <TeamManager 
             members={content.members || []}
             todos={content.todos || []}
             onUpdateMembers={handleUpdateMembers}
             onUpdateTodos={handleUpdateTodos}
          />
        )}
        {activeModule === 'docs' && (
          <Docs 
            initialDocs={content.docs || []}
            onUpdate={handleUpdateDocs}
          />
        )}

       {activeModule === 'ui' && (
          <UIManager 
            data={content.ui || { pages: [] }} // 确保不为空
            onUpdate={handleUpdateUI}
          />
        )}
=======
      {/* === 移动端顶部栏 (手机显示，桌面隐藏) === */}
      <div className="md:hidden h-12 bg-slate-800 border-b border-slate-700 flex items-center px-4 justify-between shrink-0">
          <button onClick={onBack} className="text-slate-300"><ChevronLeft size={24}/></button>
          <span className="font-bold text-white">{project.name}</span>
          <button onClick={() => setActiveModule('settings')} className="text-slate-300"><SettingsIcon size={20}/></button>
      </div>

      {/* === 主内容区 === */}
      <main className="flex-1 relative overflow-hidden bg-slate-900 pb-16 md:pb-0"> 
        {/* pb-16 是为了给底部导航栏留出空间 */}
        {renderModule()}
>>>>>>> Stashed changes
      </main>

      {/* === 移动端底部导航栏 (手机显示，桌面隐藏) === */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-800 border-t border-slate-700 flex justify-around items-center z-[9999]">
          <MobileNavBtn icon={<Lightbulb size={20}/>} label="白板" isActive={activeModule === 'brainstorm'} onClick={() => setActiveModule('brainstorm')} />
          <MobileNavBtn icon={<Users size={20}/>} label="团队" isActive={activeModule === 'team'} onClick={() => setActiveModule('team')} />
          <MobileNavBtn icon={<FileText size={20}/>} label="文档" isActive={activeModule === 'docs'} onClick={() => setActiveModule('docs')} />
          <MobileNavBtn icon={<Layout size={20}/>} label="原型" isActive={activeModule === 'ui'} onClick={() => setActiveModule('ui')} />
      </div>
    </>
  );
}

// 桌面侧边栏按钮
function SidebarBtn({ icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-md transition-all flex items-center gap-3 ${isActive ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

// 移动端底部按钮
function MobileNavBtn({ icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

export default App;
