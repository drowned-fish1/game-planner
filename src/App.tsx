import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { BrainstormBoard } from './components/Brainstorm/Board';
import { TeamManager } from './components/Team/TeamManager';
import { ProjectMeta, ProjectContent, loadProjectContent, saveProjectContent } from './utils/storage';
import { Docs } from './components/Docs/Docs'; // 引入 Docs 组件


type ModuleType = 'brainstorm' | 'docs' | 'ui-designer' | 'team';

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
    <div className="flex h-screen w-screen bg-slate-900 text-slate-200 overflow-hidden">
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


  return (
    <>
      <aside className="w-64 shrink-0 flex flex-col bg-slate-800 border-r border-slate-700 z-50">
        <div className="h-14 flex items-center px-4 border-b border-slate-700 gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">←</button>
          <div className="font-bold text-white truncate flex-1">{project.name}</div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarBtn label="💡 灵感白板" isActive={activeModule === 'brainstorm'} onClick={() => setActiveModule('brainstorm')} />
          <SidebarBtn label="👥 团队管理" isActive={activeModule === 'team'} onClick={() => setActiveModule('team')} />
          <SidebarBtn label="📝 策划文档" isActive={activeModule === 'docs'} onClick={() => setActiveModule('docs')} />
          <SidebarBtn label="🎨 UI 原型机" isActive={activeModule === 'ui-designer'} onClick={() => setActiveModule('ui-designer')} />
        </nav>
        <div className="p-4 text-xs border-t border-slate-700 text-center">
           {saveStatus === 'saving' ? '💾 保存中...' : '✔ 已保存'}
        </div>
      </aside>

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

        {activeModule === 'ui-designer' && <div className="flex items-center justify-center h-full text-slate-500">[ UI 模块 ]</div>}
      </main>
    </>
  );
}

function SidebarBtn({ label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-md transition-all ${isActive ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'}`}>
      {label}
    </button>
  );
}

export default App;
