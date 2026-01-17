import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TeamMember, TodoItem } from '../../utils/storage';
import { TodoList } from './TodoList';

interface TeamManagerProps {
  members: TeamMember[];
  todos: TodoItem[];
  onUpdateMembers: (newMembers: TeamMember[]) => void;
  onUpdateTodos: (newTodos: TodoItem[]) => void;
}

export function TeamManager({ members, todos, onUpdateMembers, onUpdateTodos }: TeamManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, memberId: string }>({ 
    visible: false, x: 0, y: 0, memberId: '' 
  });

  // === 统一的编辑弹窗状态 ===
  const [modal, setModal] = useState<{ 
    isOpen: boolean; 
    type: 'add' | 'rename' | 'role'; // 弹窗类型：添加 | 改名 | 改职位
    inputValue: string; 
    targetId?: string; 
  }>({ 
    isOpen: false, type: 'add', inputValue: '' 
  });

  // 点击任意处关闭右键菜单
  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // === 提交逻辑 (新增 或 修改) ===
  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal.inputValue.trim()) return;

    if (modal.type === 'add') {
      // 添加新成员
      const colors = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-yellow-500', 'bg-orange-500', 'bg-pink-500'];
      const newMember: TeamMember = {
        id: uuidv4(),
        name: modal.inputValue.trim(),
        role: '策划',
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      onUpdateMembers([...members, newMember]);
    } else if (modal.type === 'rename' && modal.targetId) {
      // 修改名字
      onUpdateMembers(members.map(m => m.id === modal.targetId ? { ...m, name: modal.inputValue.trim() } : m));
    } else if (modal.type === 'role' && modal.targetId) {
      // 修改职位
      onUpdateMembers(members.map(m => m.id === modal.targetId ? { ...m, role: modal.inputValue.trim() } : m));
    }

    setModal({ ...modal, isOpen: false }); // 关闭弹窗
  };

  // === 打开弹窗的辅助函数 ===
  const openAddModal = () => {
    setModal({ isOpen: true, type: 'add', inputValue: '' });
  };

  const openRenameModal = () => {
    const member = members.find(m => m.id === contextMenu.memberId);
    if (member) {
      setModal({ isOpen: true, type: 'rename', inputValue: member.name, targetId: member.id });
      setContextMenu(prev => ({ ...prev, visible: false })); // 关闭菜单
    }
  };

  const openRoleModal = () => {
    const member = members.find(m => m.id === contextMenu.memberId);
    if (member) {
      setModal({ isOpen: true, type: 'role', inputValue: member.role, targetId: member.id });
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  // 右键菜单触发
  const handleContextMenu = (e: React.MouseEvent, memberId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 250);
    setContextMenu({ visible: true, x, y, memberId });
  };

  // 头像上传
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

  // 删除成员
  const handleDelete = () => {
    if (confirm("确定要移除这位成员吗？")) {
      onUpdateMembers(members.filter(m => m.id !== contextMenu.memberId));
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  return (
    <div className="flex h-full w-full bg-slate-900 overflow-hidden relative">
      <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />

      {/* 左/中：成员列表 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-8 pb-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-bold text-white">👥 团队管理</h2>
            <p className="text-slate-400 text-sm mt-1">管理你的梦之队</p>
          </div>
          <button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2">
            <span>+</span> 添加成员
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {members.map(member => (
              <div 
                key={member.id}
                onContextMenu={(e) => handleContextMenu(e, member.id)}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col items-center gap-4 hover:border-emerald-500 hover:shadow-xl hover:-translate-y-1 transition-all group relative cursor-pointer select-none"
              >
                <div className={`w-20 h-20 rounded-full border-4 border-slate-700 flex items-center justify-center text-3xl text-white font-bold overflow-hidden shadow-inner ${member.color}`}>
                  {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" /> : member.name[0]}
                </div>
                <div className="text-center w-full">
                  <h3 className="text-lg font-bold text-white truncate px-2">{member.name}</h3>
                  <div className="mt-1 inline-block px-2 py-0.5 bg-slate-900 rounded text-xs text-emerald-400 border border-slate-700 max-w-full truncate">{member.role}</div>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500">⋮</div>
              </div>
            ))}
            {members.length === 0 && <div className="col-span-full py-10 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">暂无成员，点击右上角添加</div>}
          </div>
        </div>
      </div>

      {/* 右：待办事项 */}
      <TodoList todos={todos} members={members} onUpdate={onUpdateTodos} />

      {/* === 通用编辑弹窗 (Modal) === */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/70 z-[10000] flex items-center justify-center backdrop-blur-sm" onClick={() => setModal({ ...modal, isOpen: false })}>
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl w-96 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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

      {/* === 右键菜单 === */}
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
