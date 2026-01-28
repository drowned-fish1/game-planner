import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TodoItem, TeamMember } from '../../utils/storage';

interface TodoListProps {
  todos: TodoItem[];
  members: TeamMember[];
  onUpdate: (newTodos: TodoItem[]) => void;
}

export function TodoList({ todos, members, onUpdate }: TodoListProps) {
  const [newText, setNewText] = useState("");
  const [assignee, setAssignee] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    onUpdate([...todos, { id: uuidv4(), text: newText, done: false, assigneeId: assignee }]);
    setNewText("");
  };

  const toggle = (id: string) => {
    onUpdate(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const remove = (id: string) => {
    onUpdate(todos.filter(t => t.id !== id));
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="p-4 border-b border-slate-700 font-bold text-slate-200 flex justify-between items-center bg-slate-800">
        <span>✅ 项目待办</span>
        <span className="text-xs text-slate-500">{todos.filter(t => !t.done).length} 待完成</span>
      </div>
      
      {/* 列表区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-900/50 pb-32">
        {todos.map(todo => {
          const user = members.find(m => m.id === todo.assigneeId);
          return (
            <div key={todo.id} className="bg-slate-800 p-3 rounded border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex gap-3 items-start">
                <input type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} className="mt-1 w-4 h-4 accent-emerald-500 cursor-pointer" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm break-words ${todo.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{todo.text}</div>
                  {user && (
                    <div className="flex items-center gap-1.5 mt-2 bg-slate-900/80 w-fit px-2 py-0.5 rounded-full border border-slate-700">
                      {user.avatar ? (
                        <img src={user.avatar} className="w-4 h-4 rounded-full object-cover"/>
                      ) : (
                        <div className={`w-4 h-4 rounded-full ${user.color} text-[8px] flex items-center justify-center text-white`}>{user.name[0]}</div>
                      )}
                      <span className="text-xs text-slate-400">{user.name}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => remove(todo.id)} className="text-slate-500 hover:text-red-400 p-1">×</button>
              </div>
            </div>
          );
        })}
        {todos.length === 0 && <div className="text-center text-slate-500 text-sm mt-10">暂无任务</div>}
      </div>

      {/* 修复点：bottom-16 (手机抬高) md:bottom-0 (电脑贴底) */}
      <form onSubmit={add} className="absolute bottom-16 md:bottom-0 left-0 right-0 p-3 border-t border-slate-700 flex flex-col gap-2 bg-slate-800 shadow-2xl z-20">
        <input 
          value={newText} onChange={e => setNewText(e.target.value)} 
          className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
          placeholder="添加新任务..."
        />
        <div className="flex gap-2">
          <select value={assignee} onChange={e => setAssignee(e.target.value)} className="bg-slate-700 text-slate-300 text-xs rounded border border-slate-600 flex-1 outline-none px-2 h-9">
            <option value="">-- 指派给 --</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name} - {m.role}</option>)}
          </select>
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 rounded font-bold h-9">添加</button>
        </div>
      </form>
    </div>
  );
}