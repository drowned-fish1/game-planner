import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { getToasts, subscribeToasts, toast, type ToastItem, type ToastKind } from '../utils/toast';

const ICONS: Record<ToastKind, JSX.Element> = {
  success: <CheckCircle2 size={18} className="text-brand-400" />,
  error: <XCircle size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-amber-400" />,
  info: <Info size={18} className="text-iris-400" />,
};

const ACCENT: Record<ToastKind, string> = {
  success: 'border-brand-500/30',
  error: 'border-red-500/30',
  warning: 'border-amber-500/30',
  info: 'border-iris-500/30',
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(getToasts());

  useEffect(() => {
    const unsubscribe = subscribeToasts((next) => setItems([...next]));
    // 兜住「渲染之后、订阅之前」窗口内推入的 toast（如 App 启动 effect 的恢复提示，
    // 其 effect 先于本组件的订阅 effect 执行）
    setItems([...getToasts()]);
    return unsubscribe;
  }, []);

  return (
    <div
      className="pointer-events-none fixed bottom-5 left-1/2 z-[10050] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col items-center gap-2.5"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((t) => (
        <div key={t.id} className={`toast animate-toast-in w-full ${ACCENT[t.kind]}`} role="status">
          <span className="shrink-0">{ICONS[t.kind]}</span>
          <span className="min-w-0 flex-1 break-words leading-snug">{t.message}</span>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="shrink-0 rounded-md p-1 text-subtle transition-colors hover:bg-surface-3 hover:text-content"
            aria-label="关闭"
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
