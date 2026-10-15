import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  FileWarning,
  HardHat,
  Receipt,
  Settings2,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NotificationType, SystemReminderNotification } from '../types';
import { isQuietHours } from '../utils/installmentUtils';

/** Ask every mounted bell to open its panel (used by toasts). */
export const openNotificationsPanel = () => {
  window.dispatchEvent(new CustomEvent('nsc:open-notifications'));
};

const CATEGORY_ORDER: NotificationType[] = [
  'installment_overdue',
  'installment_due_soon',
  'installment_paid',
  'unpaid_purchase',
  'outstanding_debt',
  'missing_document',
  'project_inactivity',
  'general_financial',
];

const CATEGORY_ICON: Record<NotificationType, React.ReactNode> = {
  installment_overdue: <AlertTriangle className="w-4 h-4" />,
  installment_due_soon: <CalendarClock className="w-4 h-4" />,
  installment_paid: <CheckCheck className="w-4 h-4" />,
  unpaid_purchase: <Receipt className="w-4 h-4" />,
  outstanding_debt: <Wallet className="w-4 h-4" />,
  missing_document: <FileWarning className="w-4 h-4" />,
  project_inactivity: <Activity className="w-4 h-4" />,
  general_financial: <TrendingUp className="w-4 h-4" />,
};

const PRIORITY_STYLE: Record<number, string> = {
  1: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
  2: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
  3: 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800',
  4: 'bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800',
  5: 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800',
  6: 'bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700',
  7: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
};

function categoryLabel(type: NotificationType, tp: (en: string, fa: string, ps: string) => string): string {
  switch (type) {
    case 'installment_overdue': return tp('Overdue installments', 'اقساط معوقه', 'ځنډېدلي قسطونه');
    case 'installment_due_soon': return tp('Installments due soon', 'اقساط نزدیک‌سررسید', 'نېږدې قسطونه');
    case 'installment_paid': return tp('Installment paid', 'پرداخت قسط', 'د قسط ورکړه');
    case 'unpaid_purchase': return tp('Unpaid bills', 'بل‌های پرداخت‌نشده', 'ناورکړل شوي بلونه');
    case 'outstanding_debt': return tp('Contractor/supplier debt', 'بدهی قراردادی/تأمین‌کننده', 'قراردادي/عرضه پوروړی');
    case 'missing_document': return tp('Missing documents', 'اسناد ناقص', 'نیمګړي سندونه');
    case 'project_inactivity': return tp('Inactive projects', 'پروژه‌های غیرفعال', 'غیرفعالې پروژې');
    case 'general_financial': return tp('Budget overruns', 'تجاوز از بودجه', 'له بودجې اوښتل');
  }
}

function sortedForDisplay(list: SystemReminderNotification[]): SystemReminderNotification[] {
  return [...list]
    .filter(n => !n.dismissed)
    .sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
    });
}

/* ================= Bell + slide-over panel (mount in Navbar + Drawer) ================= */

export function NotificationBell({ className = '' }: { className?: string }) {
  const {
    tp, currentUser, notifications, unreadNotificationCount, notificationPrefs,
    markNotificationRead, dismissNotification, markAllNotificationsRead,
    clearReadNotifications, setNotificationPrefs, setCurrentProjectId,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('nsc:open-notifications', handler);
    return () => window.removeEventListener('nsc:open-notifications', handler);
  }, []);

  // Lock body scroll while the panel is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open ]);

  const visible = useMemo(() => sortedForDisplay(notifications), [notifications]);

  if (!currentUser) return null;

  const openNotification = (n: SystemReminderNotification) => {
    markNotificationRead(n.id);
    if (n.projectId) {
      try { setCurrentProjectId(n.projectId); } catch { /* keep current project */ }
    }
    if (n.actionTab) {
      window.dispatchEvent(new CustomEvent('nsc:goto-tab', { detail: { tab: n.actionTab } }));
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={tp('Notifications', 'اطلاع‌رسانی‌ها', 'خبرتیاوې')}
        aria-label={tp('Notifications', 'اطلاع‌رسانی‌ها', 'خبرتیاوې')}
        className={`relative ${className}`}
      >
        <Bell className="w-4 h-4" />
        {notificationPrefs.enabled && unreadNotificationCount > 0 && (
          <span className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center leading-none">
            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
          </span>
        )}
        {!notificationPrefs.enabled && (
          <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-slate-400 border border-white" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 end-0 w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <Bell className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex-1">
                {tp('Notifications', 'اطلاع‌رسانی‌ها', 'خبرتیاوې')}
                {unreadNotificationCount > 0 && (
                  <span className="ms-2 text-[11px] font-bold text-indigo-600">({unreadNotificationCount})</span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setShowPrefs(v => !v)}
                title={tp('Settings', 'تنظیمات', 'امستنې')}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tp('Close', 'بستن', 'بندول')}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preferences */}
            {showPrefs && (
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 space-y-3 shrink-0 max-h-[45%] overflow-y-auto bg-slate-50/60 dark:bg-slate-800/40">
                <label className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span>{tp('Enable notifications', 'فعال‌سازی اطلاع‌رسانی‌ها', 'خبرتیاوې فعالول')}</span>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.enabled}
                    onChange={e => setNotificationPrefs({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                  />
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {CATEGORY_ORDER.map(cat => (
                    <label key={cat} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        {CATEGORY_ICON[cat]}
                        {categoryLabel(cat, tp)}
                      </span>
                      <input
                        type="checkbox"
                        checked={notificationPrefs.categories[cat]}
                        onChange={e => setNotificationPrefs({ categories: { ...notificationPrefs.categories, [cat]: e.target.checked } })}
                        className="w-4 h-4 accent-indigo-600"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="flex-1">{tp('Quiet hours (no popups)', 'ساعات سکوت (بدون پاپ‌آپ)', 'چوپتیا ساعتونه')}</span>
                  <input
                    type="time"
                    value={notificationPrefs.quietStart}
                    onChange={e => setNotificationPrefs({ quietStart: e.target.value || '22:00' })}
                    className="px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                  />
                  <span>–</span>
                  <input
                    type="time"
                    value={notificationPrefs.quietEnd}
                    onChange={e => setNotificationPrefs({ quietEnd: e.target.value || '07:00' })}
                    className="px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <label className="flex items-center justify-between gap-1">
                    <span>{tp('Due-soon window (days)', 'مهلت یادآوری (روز)', 'یادونه (ورځې)')}</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={notificationPrefs.dueSoonDays}
                      onChange={e => setNotificationPrefs({ dueSoonDays: Math.max(1, Math.min(30, Number(e.target.value) || 7)) })}
                      className="w-14 px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-1">
                    <span>{tp('Inactivity (days)', 'رکود (روز)', 'سکوت (ورځې)')}</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={notificationPrefs.inactivityDays}
                      onChange={e => setNotificationPrefs({ inactivityDays: Math.max(1, Math.min(90, Number(e.target.value) || 14)) })}
                      className="w-14 px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {tp('Mark all read', 'همه خوانده شد', 'ټول ولوستل شول')}
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={clearReadNotifications}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {tp('Clear read', 'پاک کردن خوانده‌شده‌ها', 'لوستل شوي پاکول')}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scroll-touch p-3 space-y-2">
              {!notificationPrefs.enabled && (
                <p className="text-center text-xs text-slate-500 py-6">
                  {tp('Notifications are disabled. Enable them in Settings above.', 'اطلاع‌رسانی‌ها غیرفعال است. از تنظیمات بالا فعال کنید.', 'خبرتیاوې بندې دي. له پورتنو امستنو څخه یې فعالې کړئ.')}
                </p>
              )}
              {notificationPrefs.enabled && visible.length === 0 && (
                <p className="text-center text-xs text-slate-500 py-6">
                  {tp('🎉 All clear — no new notifications.', '🎉 همه‌چیز مرتب است — اطلاع‌رسانی جدیدی نیست.', '🎉 هرڅه سم دي — نوې خبرتیا نشته.')}
                </p>
              )}
              {visible.map(n => (
                <div
                  key={n.id}
                  className={`p-3 rounded-2xl border text-start transition-colors ${PRIORITY_STYLE[n.priority] || PRIORITY_STYLE[6]} ${n.read ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-300">{CATEGORY_ICON[n.type] || <HardHat className="w-4 h-4" />}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white leading-snug">{n.title}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-1">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {n.projectName ? `${n.projectName} • ` : ''}{n.date} {n.time}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissNotification(n.id)}
                      title={tp('Dismiss', 'نادیده گرفتن', 'له پامه غورځول')}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white/60 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {n.actionTab && (
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className="text-[11px] font-black text-indigo-600 hover:text-indigo-800"
                      >
                        {tp('View →', 'مشاهده →', 'کتنه →')}
                      </button>
                    )}
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                      >
                        {tp('Mark read', 'خوانده شد', 'ولوستل شو')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================= Urgent popups for NEW overdue items (mount ONCE in App) ================= */

export function NotificationToasts() {
  const { tp, currentUser, notifications, notificationPrefs } = useApp();
  const seenKeys = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [, forceRender] = useState(0);

  // Re-check quiet hours every minute so muted popups appear when silence ends.
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const quiet = isQuietHours(new Date(), notificationPrefs.quietStart, notificationPrefs.quietEnd);

  // New, unread, non-dismissed P1 items (overdue installments) — max 3.
  const urgent = notifications
    .filter(n => n.priority === 1 && !n.read && !n.dismissed && !seenKeys.current.has(n.reminderKey))
    .slice(0, 3);

  useEffect(() => {
    // Toasts only when enabled + online-friendly + out of quiet hours.
    if (!currentUser || !notificationPrefs.enabled || quiet) return;
    if (urgent.length === 0) return;
    for (const n of urgent) seenKeys.current.add(n.reminderKey);
    forceRender(x => x + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, notificationPrefs.enabled, quiet, tick, currentUser]);

  if (!currentUser || !notificationPrefs.enabled || quiet) return null;

  const shown = notifications
    .filter(n => n.priority === 1 && !n.read && !n.dismissed && seenKeys.current.has(n.reminderKey))
    .slice(-3);

  if (shown.length === 0) return null;

  return (
    <div className="fixed bottom-24 start-4 z-[95] space-y-2 max-w-[calc(100vw-2rem)]">
      {shown.map(n => (
        <button
          key={n.id}
          type="button"
          onClick={openNotificationsPanel}
          className="block w-80 max-w-full p-3 rounded-2xl bg-red-600 text-white text-start shadow-2xl"
        >
          <p className="text-xs font-black leading-snug">{n.title}</p>
          <p className="text-[11px] opacity-90 leading-relaxed mt-0.5 line-clamp-2">{n.message}</p>
          <p className="text-[10px] font-bold opacity-75 mt-1">
            {tp('Tap to view all', 'برای مشاهده همه بزنید', 'د ټولو لیدو لپاره ټک وکړئ')}
          </p>
        </button>
      ))}
    </div>
  );
}
