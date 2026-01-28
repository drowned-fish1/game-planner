import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TeamMember, TodoItem } from '../../utils/storage';
import { TodoList } from './TodoList';
import { Users, CheckSquare } from 'lucide-react';

interface TeamManagerProps {
  members: TeamMember[];
  todos: TodoItem[];
  onUpdateMembers: (newMembers: TeamMember[]) => void;
  onUpdateTodos: (newTodos: TodoItem[]) => void;
}

export function TeamManager({ members, todos, onUpdateMembers, onUpdateTodos }: TeamManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 移动端 Tab 状态: 'members' | 'todos'
  const [activeTab, setActiveTab] = useState<'members' | 'todos'>('members');

  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, memberId: string }>({ 
    visible: false, x: 0, y: 0, memberId: '' 
  });

  const [modal, setModal] = useState<{ 
    isOpen: boolean; 
    type: 'add' | 'rename' | 'role'; 
    inputValue: string; 
    targetId?: string; 
  }>({ 
    isOpen: false, type: 'add', inputValue: '' 
  });

  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal.inputValue.trim()) return;

    if (modal.type === 'add') {
      const colors = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-yellow-500', 'bg-orange-500', 'bg-pink-500'];
      const newMember: TeamMember = {
        id: uuidv4(),
        name: modal.inputValue.trim(),
        role: '策划',
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      onUpdateMembers([...members, newMember]);
    } else if (modal.type === 'rename' && modal.targetId) {
      onUpdateMembers(members.map(m => m.id === modal.targetId ? { ...m, name: modal.inputValue.trim() } : m));
    } else if (modal.type === 'role' && modal.targetId) {
      onUpdateMembers(members.map(m => m.id === modal.targetId ? { ...m, role: modal.inputValue.trim() } : m));
    }
    setModal({ ...modal, isOpen: false });
  };

  const openAddModal = () => setModal({ isOpen: true, type: 'add', inputValue: '' });
  
  const openRenameModal = () => {
    const member = members.find(m => m.id === contextMenu.memberId);
    if (member) {
      setModal({ isOpen: true, type: 'rename', inputValue: member.name, targetId: member.id });
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const openRoleModal = () => {
    const member = members.find(m => m.id === contextMenu.memberId);
    if (member) {
      setModal({ isOpen: true, type: 'role', inputValue: member.role, targetId: member.id });
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const handleContextMenu = (e: React.MouseEvent, memberId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 250);
    setContextMenu({ visible: true, x, y, memberId });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && contextMenu.memberId) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onUpdateMembers(members.map(m => m.id === contextMenu.memberId ? { ...m, avatar: ev.target?.result as string } : m));
      };
      reader.readAsDataURL(file);
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
    e.target.value = '';
  };

  const handleDelete = () => {
    if (confirm("确定要移除这位成员吗？")) {
      onUpdateMembers(members.filter(m => m.id !== contextMenu.memberId));
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-slate-900 overflow-hidden relative">
      <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />

      {/* === 移动端 Tab 切换 === */}
      <div className="md:hidden flex shrink-0 border-b border-slate-700 bg-slate-800">
        <button 
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors ${activeTab === 'members' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400'}`}
        >
          <Users size={16} /> 成员列表
        </button>
        <button 
          onClick={() => setActiveTab('todos')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors ${activeTab === 'todos' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400'}`}
        >
          <CheckSquare size={16} /> 任务板
        </button>
      </div>

      {/* 左/中：成员列表 (移动端受 Tab 控制，PC 端常驻) */}
      <div className={`flex-1 flex-col min-w-0 ${activeTab === 'members' ? 'flex' : 'hidden md:flex'}`}>
        <div className="p-4 md:p-8 pb-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-white">👥 团队管理</h2>
            <p className="text-slate-400 text-xs md:text-sm mt-1">管理你的梦之队</p>
          </div>
          <button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2 text-sm">
            <span>+</span> <span className="hidden md:inline">添加成员</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {members.map(member => (
              <div 
                key={member.id}
                onClick={(e) => window.innerWidth < 768 && handleContextMenu(e, member.id)} // 移动端点击触发菜单
                onContextMenu={(e) => handleContextMenu(e, member.id)}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-6 flex flex-col items-center gap-3 md:gap-4 hover:border-emerald-500 hover:shadow-xl hover:-translate-y-1 transition-all group relative cursor-pointer select-none"
              >
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-slate-700 flex items-center justify-center text-2xl md:text-3xl text-white font-bold overflow-hidden shadow-inner ${member.color}`}>
                  {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" /> : member.name[0]}
                </div>
                <div className="text-center w-full">
                  <h3 className="text-base md:text-lg font-bold text-white truncate px-2">{member.name}</h3>
                  <div className="mt-1 inline-block px-2 py-0.5 bg-slate-900 rounded text-[10px] md:text-xs text-emerald-400 border border-slate-700 max-w-full truncate">{member.role}</div>
                </div>
              </div>
            ))}
            {members.length === 0 && <div className="col-span-full py-10 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">暂无成员，点击右上角添加</div>}
          </div>
        </div>
      </div>

      {/* 右：待办事项 (移动端受 Tab 控制，PC 端作为侧边栏) */}
      <div className={`md:w-80 bg-slate-800 md:border-l border-slate-700 flex-col shrink-0 h-full ${activeTab === 'todos' ? 'flex w-full' : 'hidden md:flex'}`}>
         <TodoList todos={todos} members={members} onUpdate={onUpdateTodos} />
      </div>

      {/* 编辑弹窗 */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/70 z-[10000] flex items-center justify-center backdrop-blur-sm px-4" onClick={() => setModal({ ...modal, isOpen: false })}>
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">
              {modal.type === 'add' ? '添加新伙伴' : modal.type === 'rename' ? '修改名字' : '修改职位'}
            </h3>
            <form onSubmit={handleModalSubmit}>
              <input 
                autoFocus
                value={modal.inputValue}
                onChange={e => setModal({ ...modal, inputValue: e.target.value })}
                placeholder={modal.type === 'role' ? '例如: 主程, 关卡策划...' : '请输入...'}
                className="w-full bg-slate-900 border border-slate-600 rounded px-4 py-3 text-white outline-none focus:border-emerald-500 mb-6"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModal({ ...modal, isOpen: false })} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">取消</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-bold shadow-lg">确认</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 右键/点击 菜单 */}
      {contextMenu.visible && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(prev => ({ ...prev, visible: false }))}></div>
          <div 
            className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 w-44 flex flex-col animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-700 font-bold bg-slate-900/50">
              管理: {members.find(m => m.id === contextMenu.memberId)?.name}
            </div>
            <button onClick={openRenameModal} className="px-4 py-3 text-left text-slate-200 hover:bg-emerald-600 hover:text-white flex items-center gap-3 transition-colors text-sm"><span>✏️</span> 修改名字</button>
            <button onClick={openRoleModal} className="px-4 py-3 text-left text-slate-200 hover:bg-emerald-600 hover:text-white flex items-center gap-3 transition-colors text-sm"><span>💼</span> 修改职位</button>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-3 text-left text-slate-200 hover:bg-emerald-600 hover:text-white flex items-center gap-3 transition-colors text-sm"><span>🖼️</span> 更换头像</button>
            <div className="h-[1px] bg-slate-700 my-1 mx-2"></div>
            <button onClick={handleDelete} className="px-4 py-3 text-left text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-3 transition-colors text-sm rounded-b-lg"><span>🗑️</span> 移除成员</button>
          </div>
        </>
      )}
    </div>
  );
}