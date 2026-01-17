import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
// 只引用 getProjectsList 和 saveProjectsList，不再引用 getWorkspaceData
import { getProjectsList, saveProjectsList, ProjectMeta } from '../../utils/storage';

interface DashboardProps {
  onOpenProject: (project: ProjectMeta) => void;
}

export function Dashboard({ onOpenProject }: DashboardProps) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, targetId: string }>({ 
    visible: false, x: 0, y: 0, targetId: '' 
  });

  useEffect(() => {
    setProjects(getProjectsList());
    const handleClickOutside = () => setContextMenu({ ...contextMenu, visible: false });
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
  };

  // 右键逻辑
  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: id });
  };

  // 封面上传
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && contextMenu.targetId) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newList = projects.map(p => p.id === contextMenu.targetId ? { ...p, cover: ev.target?.result as string } : p);
        setProjects(newList);
        saveProjectsList(newList);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // 改名
  const updateName = (id: string, name: string) => {
    const newList = projects.map(p => p.id === id ? { ...p, name } : p);
    setProjects(newList);
    saveProjectsList(newList);
  };

  // 删除
  const deleteProject = () => {
    if (confirm("确定删除项目？")) {
      const newList = projects.filter(p => p.id !== contextMenu.targetId);
      setProjects(newList);
      saveProjectsList(newList);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-200 p-10 overflow-hidden relative">
      <input type="file" ref={fileInputRef} onChange={handleCoverUpload} className="hidden" accept="image/*"/>

      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-2">Game Planner <span className="text-emerald-500 text-sm align-top">Pro</span></h1>
        <p className="text-slate-400">项目管理大厅</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 content-start pb-20">
          <div onClick={createProject} className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500 hover:bg-slate-800/50 flex flex-col items-center justify-center cursor-pointer transition-all group">
            <div className="text-4xl text-slate-600 group-hover:text-emerald-500 mb-2 transition-colors">+</div>
            <span className="text-slate-500 font-medium">创建新项目</span>
          </div>

          {projects.map(project => (
            <div 
              key={project.id} 
              onClick={() => onOpenProject(project)}
              onContextMenu={(e) => handleContextMenu(e, project.id)}
              className="group relative aspect-[4/3] bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500 hover:shadow-xl transition-all cursor-pointer flex flex-col overflow-hidden"
            >
              <div className="flex-1 bg-slate-900 relative pointer-events-none">
                 {project.cover ? <img src={project.cover} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-700 text-4xl">🎮</div>}
              </div>
              <div className="h-12 bg-slate-800 border-t border-slate-700 flex items-center px-2" onClick={e => e.stopPropagation()}>
                 <input 
                   value={project.name} 
                   onChange={e => updateName(project.id, e.target.value)} 
                   className="bg-transparent font-bold text-slate-200 w-full text-center outline-none focus:bg-slate-900 rounded px-1"
                 />
              </div>
            </div>
          ))}
        </div>
      </div>

      {contextMenu.visible && (
        <div className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 w-32 flex flex-col" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
           <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-left text-sm text-slate-200 hover:bg-emerald-600">🖼️ 换封面</button>
           <button onClick={deleteProject} className="px-4 py-2 text-left text-sm text-red-400 hover:bg-red-600 hover:text-white">🗑️ 删除</button>
        </div>
      )}
    </div>
  );
}
