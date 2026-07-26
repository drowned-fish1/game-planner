import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  items: { keys: string[]; desc: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '全局',
    items: [
      { keys: ['Ctrl', 'K'], desc: '打开命令面板' },
      { keys: ['?'], desc: '打开快捷键帮助' },
      { keys: ['Esc'], desc: '关闭弹窗 / 菜单' },
    ],
  },
  {
    title: '项目大厅',
    items: [
      { keys: ['Ctrl', 'N'], desc: '新建项目' },
    ],
  },
  {
    title: '灵感白板',
    items: [
      { keys: ['鼠标中键拖动'], desc: '平移画布' },
      { keys: ['滚轮'], desc: '缩放画布' },
      { keys: ['点击连接点 ×2'], desc: '连接两张磁贴' },
    ],
  },
];

interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
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

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="快捷键帮助"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2 text-content">
            <Keyboard size={18} className="text-brand-400" />
            <span className="text-sm font-bold">快捷键</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-subtle transition-colors hover:text-content"
            title="关闭"
            aria-label="关闭快捷键帮助"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-5 custom-scrollbar">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">{group.title}</div>
              <div className="space-y-1.5">
                {group.items.map(item => (
                  <div key={item.desc} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted">{item.desc}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map(key => <kbd key={key}>{key}</kbd>)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
