import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

/**
 * Lightweight, dependency-free toast system.
 *
 * Usage:
 *   import { toast, Toaster } from './utils/toast';
 *   // mount <Toaster /> once at the app root
 *   toast.success('已保存');
 *   toast.error('连接失败');
 */

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
}

type Listener = (toasts: ToastItem[]) => void;

const MAX_TOASTS = 4;

let toasts: ToastItem[] = [];
let listeners: Listener[] = [];
let seq = 1;

function emit() {
  for (const l of listeners) l(toasts);
}

function remove(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, duration = 2600): number {
  const id = seq++;
  // Cap the stack so a burst of events can't fill the screen.
  const trimmed = toasts.slice(Math.max(0, toasts.length - (MAX_TOASTS - 1)));
  toasts = [...trimmed, { id, kind, message, duration }];
  emit();
  if (duration > 0) {
    // window.setTimeout is safe in the renderer
    window.setTimeout(() => remove(id), duration);
  }
  return id;
}

export const toast = {
  show: (message: string, duration?: number) => push('info', message, duration),
  success: (message: string, duration?: number) => push('success', message, duration),
  error: (message: string, duration?: number) => push('error', message, duration ?? 3600),
  info: (message: string, duration?: number) => push('info', message, duration),
  warning: (message: string, duration?: number) => push('warning', message, duration),
  dismiss: (id: number) => remove(id),
};

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
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    const listener: Listener = (next) => setItems([...next]);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
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
