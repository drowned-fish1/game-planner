import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getPendingConfirm, settleConfirm, subscribeConfirm, type PendingConfirm } from '../utils/confirm';
import { useLocale } from '../i18n/LocaleContext';

export function ConfirmHost() {
  const [current, setCurrent] = useState<PendingConfirm | null>(getPendingConfirm());
  const { t } = useLocale();

  useEffect(() => subscribeConfirm((next) => setCurrent(next)), []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settleConfirm(false);
      if (e.key === 'Enter') settleConfirm(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => settleConfirm(false)}
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
          <button onClick={() => settleConfirm(false)} className="btn-ghost">
            {current.cancelText || t((m) => m.common.cancel)}
          </button>
          <button
            onClick={() => settleConfirm(true)}
            autoFocus
            className={current.danger ? 'btn-danger' : 'btn-primary'}
          >
            {current.confirmText || t((m) => m.common.confirm)}
          </button>
        </div>
      </div>
    </div>
  );
}
