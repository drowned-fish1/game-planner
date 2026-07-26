import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Promise-based in-app confirm dialog (replaces native confirm()).
 *
 * Usage:
 *   import { confirmDialog, ConfirmHost } from './utils/confirm';
 *   // mount <ConfirmHost /> once at the app root
 *   if (await confirmDialog({ title: '删除项目？', danger: true })) { ... }
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
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

function settle(value: boolean) {
  if (!pending) return;
  pending.resolve(value);
  pending = null;
  emit();
}

export function ConfirmHost() {
  const [current, setCurrent] = useState<PendingConfirm | null>(pending);

  useEffect(() => {
    const listener: Listener = (next) => setCurrent(next);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => settle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={current.title}
        className="w-full max-w-sm animate-scale-in rounded-2xl border border-line bg-surface p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              current.danger ? 'bg-red-500/12 text-red-400' : 'bg-brand-500/12 text-brand-400'
            }`}
          >
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-semibold text-content">{current.title}</h3>
            {current.message && <p className="mt-1 text-sm leading-relaxed text-muted">{current.message}</p>}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={() => settle(false)} className="btn-ghost">
            {current.cancelText || '取消'}
          </button>
          <button
            onClick={() => settle(true)}
            autoFocus
            className={current.danger ? 'btn-danger' : 'btn-primary'}
          >
            {current.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
