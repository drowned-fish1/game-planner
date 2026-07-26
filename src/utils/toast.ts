/**
 * Lightweight, dependency-free toast system (store + API).
 *
 * Usage:
 *   import { toast } from './utils/toast';
 *   // mount <Toaster /> (components/Toaster) once at the app root
 *   toast.success('已保存');
 *   toast.error('连接失败');
 *
 * 组件部分在 `components/Toaster.tsx`，两者分文件以满足 Fast Refresh
 * （组件文件只导出组件）。
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

/** Toaster 组件订阅入口：返回取消订阅函数 */
export function subscribeToasts(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getToasts(): ToastItem[] {
  return toasts;
}
