import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;      // 右侧小字提示，如所属模块或快捷键
  keywords?: string;  // 额外搜索关键词（拼音/英文等）
  perform: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

export function CommandPalette({ open, onClose, actions }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(a =>
      a.label.toLowerCase().includes(q)
      || (a.keywords || '').toLowerCase().includes(q)
      || (a.hint || '').toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // 等待渲染完成后聚焦
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const run = (action: CommandAction) => {
    onClose();
    action.perform();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const action = filtered[activeIndex];
      if (action) run(action);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center bg-black/60 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="搜索操作或跳转模块…"
            className="h-12 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-subtle"
            aria-label="搜索命令"
          />
          <kbd className="hidden shrink-0 md:inline-block">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2 custom-scrollbar">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-subtle">没有匹配的操作</div>
          )}
          {filtered.map((action, index) => (
            <button
              key={action.id}
              onClick={() => run(action)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                index === activeIndex ? 'bg-brand-500/15 text-content' : 'text-muted hover:text-content'
              }`}
            >
              <span className="truncate">{action.label}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-subtle">
                {action.hint}
                {index === activeIndex && <CornerDownLeft size={12} />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
