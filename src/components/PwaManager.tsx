import React, { useCallback, useEffect, useRef, useState } from 'react';
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

  // Wave 58: FULLY automatic outbox flush — no button needed. One shared
  // flusher (ref-guarded so overlapping triggers never double-send), fired
  // by: queue changes (debounced), reconnect, window focus, and a 45s retry
  // timer. "Send now" stays as an instant-force action but is rarely needed.
  const tpRef = useRef(tp);
  tpRef.current = tp;
  const flushingRef = useRef(false);
  const flushQueue = useCallback(async (announce: boolean): Promise<void> => {
    if (flushingRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    flushingRef.current = true;
    setSyncing(true);
    try {
      const r = await backendApi.syncOfflineQueue();
      if (announce && (r.sent > 0 || r.failed > 0)) {
        const t = tpRef.current;
        setSyncMsg(
          r.failed > 0
            ? t(
                `Sent ${r.sent}, ${r.failed} failed \u2014 will retry automatically.`,
                `${r.sent} \u0627\u0631\u0633\u0627\u0644 \u0634\u062f\u060c ${r.failed} \u0646\u0627\u0645\u0648\u0641\u0642 \u2014 \u0628\u0647\u200c\u0635\u0648\u0631\u062a \u0627\u062a\u0648\u0645\u0627\u062a \u062a\u0644\u0627\u0634 \u0645\u062c\u062f\u062f \u0645\u06cc\u200c\u0634\u0648\u062f.`,
                `${r.sent} \u0648\u0627\u0633\u062a\u0648\u0644 \u0634\u0648\u0644\u060c ${r.failed} \u0646\u0627\u06a9\u0627\u0645 \u2014 \u067e\u0647 \u0627\u062a\u0648\u0645\u0627\u062a \u0689\u0648\u0644 \u0628\u0647 \u0628\u06cc\u0627 \u0647\u0685\u0647 \u0648\u0634\u064a.`,
              )
            : t(
                `${r.sent} queued change(s) sent to the server.`,
                `${r.sent} \u062a\u063a\u06cc\u06cc\u0631 \u0630\u062e\u06cc\u0631\u0647\u200c\u0634\u062f\u0647 \u0628\u0647 \u0633\u0631\u0648\u0631 \u0627\u0631\u0633\u0627\u0644 \u0634\u062f.`,
                `${r.sent} \u062e\u0648\u0646\u062f\u064a \u0634\u0648\u064a \u0628\u062f\u0644\u0648\u0646\u0648\u0646\u0647 \u0633\u0631\u0648\u0631 \u062a\u0647 \u0648\u0627\u0633\u062a\u0648\u0644 \u0634\u0648\u0644.`,
              ),
        );
        window.setTimeout(() => setSyncMsg(null), 5000);
      }
    } catch { /* stays queued \u2014 the timer retries */ }
    finally { flushingRef.current = false; setSyncing(false); }
  }, []);

  // Debounced flush whenever items land in the queue while online.
  useEffect(() => {
    if (!online || pending === 0) return undefined;
    const t = window.setTimeout(() => { flushQueue(false).catch(() => {}); }, 2500);
    return () => window.clearTimeout(t);
  }, [online, pending, flushQueue]);

  // Retry timer + refocus flush (silent unless the button asked).
  useEffect(() => {
    const kick = () => {
      backendApi.getOfflinePendingCount().then(n => { if (n > 0) flushQueue(false).catch(() => {}); }).catch(() => {});
    };
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      kick();
    }, 45000);
    window.addEventListener('focus', kick);
    return () => { window.clearInterval(id); window.removeEventListener('focus', kick); };
  }, [flushQueue]);

  const syncNow = () => {
    if (!online) return;
    flushQueue(true).catch(() => {});
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
