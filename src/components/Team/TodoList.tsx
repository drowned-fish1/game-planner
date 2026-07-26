import { useState } from 'react';
import { X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { TodoItem, TeamMember } from '../../utils/storage';

interface TodoListProps {
  todos: TodoItem[];
  members: TeamMember[];
  actorName?: string;
  onUpdate: (newTodos: TodoItem[]) => void;
  onActivity?: (activity: { kind: string; message: string; itemId?: string | null; focusedItemId?: string | null; status?: string }) => void;
}

export function TodoList({ todos, members, actorName = '有人', onUpdate, onActivity }: TodoListProps) {
  const [newText, setNewText] = useState('');
  const [assignee, setAssignee] = useState('');

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    const assigneeMember = members.find((member) => member.id === assignee);
    const nextTodo = { id: uuidv4(), text: newText, done: false, assigneeId: assignee };
    onUpdate([...todos, nextTodo]);
    onActivity?.({
      kind: 'todo:add',
      itemId: nextTodo.id,
      message: `${actorName} 添加了待办：${nextTodo.text}${assigneeMember ? `，指派给 ${assigneeMember.name}` : ''}`,
    });
    setNewText('');
  };

  const toggle = (id: string) => {
    const target = todos.find((todo) => todo.id === id);
    if (!target) return;

    onUpdate(todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
    onActivity?.({
      kind: 'todo:toggle',
      itemId: id,
      message: `${actorName}${target.done ? ' 重新打开了' : ' 完成了'}待办：${target.text}`,
    });
  };

  const remove = (id: string) => {
    const target = todos.find((todo) => todo.id === id);
    if (!target) return;

    onUpdate(todos.filter((todo) => todo.id !== id));
    onActivity?.({
      kind: 'todo:remove',
      itemId: id,
      message: `${actorName} 删除了待办：${target.text}`,
    });
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-line bg-surface p-4 font-bold text-content">
        <span>项目待办</span>
        <span className="text-xs text-subtle">{todos.filter((todo) => !todo.done).length} 项未完成</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-bg/50 p-3 pb-32">
        {todos.map((todo) => {
          const user = members.find((member) => member.id === todo.assigneeId);
          return (
            <div key={todo.id} className="rounded border border-line bg-surface p-3 transition-colors hover:border-brand-500/50">
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} className="mt-1 h-4 w-4 cursor-pointer accent-brand-500" />
                <div className="min-w-0 flex-1">
                  <div className={`break-words text-sm ${todo.done ? 'text-subtle line-through' : 'text-content'}`}>{todo.text}</div>
                  {user && (
                    <div className="mt-2 flex w-fit items-center gap-1.5 rounded-full border border-line bg-bg/80 px-2 py-0.5">
                      {user.avatar ? (
                        <img src={user.avatar} className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-white ${user.color}`}>{user.name[0]}</div>
                      )}
                      <span className="text-xs text-muted">{user.name}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(todo.id)}
                  title="删除待办"
                  aria-label="删除待办"
                  className="p-1 text-subtle transition-colors hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {todos.length === 0 && <div className="mt-10 text-center text-sm text-subtle">还没有待办任务</div>}
      </div>

      <form onSubmit={add} className="absolute bottom-16 left-0 right-0 z-20 flex flex-col gap-2 border-t border-line bg-surface p-3 shadow-2xl md:bottom-0">
        <input
          value={newText}
          onChange={(event) => setNewText(event.target.value)}
          className="rounded border border-line-strong bg-bg px-3 py-2 text-sm text-content outline-none transition-colors focus:border-brand-500"
          placeholder="添加新任务..."
        />
        <div className="flex gap-2">
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="h-9 flex-1 rounded border border-line-strong bg-surface-3 px-2 text-xs text-content outline-none">
            <option value="">-- 指派给 --</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.name} - {member.role}</option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded bg-brand-600 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-500">
            添加
          </button>
        </div>
      </form>
    </div>
  );
}
