/**
 * Promise-based in-app confirm dialog（store + API，替代原生 confirm()）。
 *
 * Usage:
 *   import { confirmDialog } from './utils/confirm';
 *   // mount <ConfirmHost /> (components/ConfirmHost) once at the app root
 *   if (await confirmDialog({ title: '删除项目？', danger: true })) { ... }
 *
 * 组件部分在 `components/ConfirmHost.tsx`，两者分文件以满足 Fast Refresh。
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface PendingConfirm extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
}

type Listener = (pending: PendingConfirm | null) => void;

let pending: PendingConfirm | null = null;
let listeners: Listener[] = [];
let seq = 1;

function emit() {
  for (const l of listeners) l(pending);
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // If one is already open, auto-cancel it first.
    if (pending) pending.resolve(false);
    pending = { id: seq++, resolve, ...options };
    emit();
  });
}

/** ConfirmHost 点击/按键后落定当前确认框 */
export function settleConfirm(value: boolean) {
  if (!pending) return;
  pending.resolve(value);
  pending = null;
  emit();
}

/** ConfirmHost 订阅入口：返回取消订阅函数 */
export function subscribeConfirm(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getPendingConfirm(): PendingConfirm | null {
  return pending;
}
