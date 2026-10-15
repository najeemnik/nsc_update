import React, { useEffect, useState } from 'react';
import { CloudUpload, RefreshCw, WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { backendApi } from '../services/backendApi';

/**
 * PWA shell UI (Wave 10) + offline-sync status (Wave 11).
 * - Offline banner when the device loses connectivity
 * - Pending-mutations pill with manual "sync now"
 * - "New version ready" prompt when the service worker updates
 */
export function PwaManager() {
  const { tp } = useApp();
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);
  const [updateReady, setUpdateReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const unsub = backendApi.onOfflineQueueChange(setPending);
    backendApi.getOfflinePendingCount().then(setPending).catch(() => {});

    // Opportunistic sync on boot.
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      backendApi.syncOfflineQueue().catch(() => {});
    }

    const onControllerChange = () => setUpdateReady(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.ready
        .then(reg => { reg.update().catch(() => {}); })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsub();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, []);

  // Auto-sync when connectivity returns.
  useEffect(() => {
    if (!online || pending === 0 || syncing) return;
    setSyncing(true);
    backendApi
      .syncOfflineQueue()
      .then(r => {
        if (r.sent > 0) {
          setSyncMsg(
            tp(
              `${r.sent} queued change(s) sent to the server.`,
              `${r.sent} تغییر ذخیره‌شده به سرور ارسال شد.`,
              `${r.sent} خوندي شوي بدلونونه سرور ته واستول شول.`,
            ),
          );
          window.setTimeout(() => setSyncMsg(null), 5000);
        }
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const syncNow = () => {
    if (syncing || !online) return;
    setSyncing(true);
    backendApi
      .syncOfflineQueue()
      .then(r => {
        setSyncMsg(
          r.failed > 0
            ? tp(
                `Sent ${r.sent}, ${r.failed} failed — will retry automatically.`,
                `${r.sent} ارسال شد، ${r.failed} ناموفق — به‌صورت اتومات تلاش مجدد می‌شود.`,
                `${r.sent} واستول شول، ${r.failed} ناکام — په اتومات ډول به بیا هڅه وشي.`,
              )
            : tp(
                `${r.sent} queued change(s) sent to the server.`,
                `${r.sent} تغییر ذخیره‌شده به سرور ارسال شد.`,
                `${r.sent} خوندي شوي بدلونونه سرور ته واستول شول.`,
              ),
        );
        window.setTimeout(() => setSyncMsg(null), 5000);
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
  };

  return (
    <>
      {/* Offline banner */}
      {!online && (
        <div className="fixed top-0 inset-x-0 z-[100] px-4 py-2.5 bg-amber-500 text-white text-center text-xs sm:text-sm font-bold shadow-lg flex items-center justify-center gap-2" role="alert">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            {tp(
              'Offline — changes are saved on this device and will be sent automatically.',
              'آفلاین — تغییرات در همین دستگاه ذخیره و به‌صورت اتومات ارسال می‌شود.',
              'آفلاین — بدلونونه په همدې وسیله کې خوندي کېږي او په اتومات ډول به واستول شي.',
            )}
            {pending > 0 && (
              <span className="ms-2 px-2 py-0.5 rounded-full bg-white/25 text-[11px]">
                {tp(`${pending} pending`, `${pending} در انتظار`, `${pending} په تمه`)}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Pending-sync pill (online but unsent items) */}
      {online && pending > 0 && (
        <div className="fixed bottom-20 end-4 z-[100] flex items-center gap-2 ps-3 pe-2 py-2 rounded-2xl bg-slate-900/95 text-white text-xs font-bold shadow-xl border border-white/10">
          <CloudUpload className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{tp(`${pending} change(s) not yet sent`, `${pending} تغییر هنوز ارسال نشده`, `${pending} بدلونونه لا نه دي استول شوي`)}</span>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-[11px] font-black transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {tp('Send now', 'ارسال هم‌اکنون', 'اوس استول')}
          </button>
        </div>
      )}

      {/* Sync result toast */}
      {syncMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-xl whitespace-nowrap">
          {syncMsg}
        </div>
      )}

      {/* Service-worker update prompt */}
      {updateReady && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-indigo-700 text-white text-xs font-bold shadow-xl">
          <span>
            {tp('A new version is ready.', 'نسخه جدید آماده است.', 'نوې نسخه چمتو ده.')}
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-xl bg-white text-indigo-700 text-[11px] font-black"
          >
            {tp('Refresh', 'تازه‌سازی', 'تازه کول')}
          </button>
        </div>
      )}
    </>
  );
}
