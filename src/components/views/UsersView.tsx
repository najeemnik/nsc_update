import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  Mail,
  Phone,
  Key,
  UserCheck,
  UserX,
  Pencil,
  CalendarClock,
  Star,
  RefreshCw,
  CloudUpload,
} from 'lucide-react';
import { User } from '../../types';
import type { ProjectGrant } from '../../types';
import { AccessMatrix } from '../AccessMatrix';
import { presetGrants } from '../../utils/permissions';

type EmployeeRole = 'accountant' | 'viewer';

const emptyGrants = (): ProjectGrant[] => presetGrants('entry', ['*']);

export const UsersView: React.FC = () => {
  const {
    users, currentUser, addUser, updateUser, deleteUser, toggleUserActive,
    projects, can, t, tp, language,
    serverSync, refreshServerSyncStatus, syncAllUsersToServer,
    syncReceipts, retryUserPush,
  } = useApp();
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  useEffect(() => { refreshServerSyncStatus().catch(() => {}); }, []);

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<EmployeeRole>('accountant');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [grants, setGrants] = useState<ProjectGrant[]>(emptyGrants);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const [editing, setEditing] = useState<User | null>(null);
  const [editFields, setEditFields] = useState({ name: '', phone: '', email: '', password: '', expiresAt: '' });
  const [editGrants, setEditGrants] = useState<ProjectGrant[]>([]);
  const [editRole, setEditRole] = useState<EmployeeRole>('accountant');

  const canCreate = can('users', 'create');
  const canEdit = can('users', 'edit');
  const canDel = can('users', 'del');

  // Same visibility as before: every non-master account; master additionally sees all.
  // (Local single-company mode never partitioned accounts; ownerAdminId links new staff to their owner.)
  const team = users.filter(u => currentUser?.isMasterSuperAdmin === true || !u.isMasterSuperAdmin);

  const resetForm = () => {
    setName(''); setUsername(''); setPassword(''); setPhone(''); setEmail('');
    setExpiresAt(''); setRole('accountant'); setGrants(emptyGrants());
    setFormError(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    if (!name.trim() || !username.trim() || !password.trim()) {
      setFormError(tp('Please fill name, username and password', 'لطفاً نام، نام کاربری و رمز را وارد کنید', 'مهرباني وکړئ نوم، کارن نوم او پټ نوم ولیکئ'));
      return;
    }
    const finalGrants = grants.length > 0 ? grants : presetGrants(role === 'viewer' ? 'view' : 'entry', ['*']);
    const res = addUser({
      name: name.trim(),
      username: username.trim(),
      password,
      role,
      phone: phone.trim(),
      email: email.trim(),
      active: true,
      ownerAdminId: currentUser?.isMasterSuperAdmin ? undefined : currentUser?.id,
      companyName: currentUser?.companyName,
      projectGrants: finalGrants,
      accessExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      permissions: {
        allowedTabs: role === 'viewer'
          ? ['dashboard', 'projects', 'apartments', 'budget', 'accounting', 'documents', 'reports']
          : ['dashboard', 'projects', 'steel', 'concrete', 'expenses', 'contractors', 'suppliers', 'payments', 'budget', 'accounting', 'documents', 'reports'],
      },
    });
    if (!res.success) {
      setFormError(res.error === 'access-denied'
        ? tp('You do not have permission to create staff.', 'شما اجازه ساخت کارمند را ندارید.', 'تاسې د کارکوونکي جوړولو اجازه نه لرئ.')
        : (res.error || 'Error'));
      return;
    }
    setFormOk(tp(`Staff account "${username.trim()}" created.`, `حساب کارمند «${username.trim()}» ساخته شد.`, `د کارکوونکي «${username.trim()}» حساب جوړ شو.`));
    resetForm();
    setIsAdding(false);
    setTimeout(() => setFormOk(null), 5000);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setEditFields({
      name: u.name,
      phone: u.phone || '',
      email: u.email || '',
      password: '',
      expiresAt: u.accessExpiresAt ? u.accessExpiresAt.split('T')[0] : '',
    });
    setEditGrants(u.projectGrants && u.projectGrants.length > 0 ? u.projectGrants : []);
    setEditRole(u.role === 'viewer' ? 'viewer' : 'accountant');
    setFormError(null);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const updates: Partial<User> = {
      name: editFields.name.trim(),
      phone: editFields.phone.trim(),
      email: editFields.email.trim(),
      role: editing.role === 'admin' ? 'admin' : editRole,
      accessExpiresAt: editFields.expiresAt ? new Date(editFields.expiresAt).toISOString() : undefined,
      projectGrants: editGrants,
    };
    if (editFields.password.trim()) updates.password = editFields.password;
    updateUser(editing.id, updates);
    setEditing(null);
    setFormOk(tp('Staff account updated.', 'حساب کارمند به‌روزرسانی شد.', 'د کارکوونکي حساب تازه شو.'));
    setTimeout(() => setFormOk(null), 4000);
  };

  const handleDelete = (id: string, userName: string) => {
    if (id === currentUser?.id) {
      setFormError(tp('You cannot delete your own account while logged in', 'نمی‌توانید حساب خودتان را هنگام ورود حذف کنید', 'تاسې خپل حساب د ننوتلو پر مهال نشئ ړنګولی'));
      setTimeout(() => setFormError(null), 5000);
      return;
    }
    if (confirm(tp(`Delete staff account "${userName}"? This cannot be undone.`, `حساب کارمند «${userName}» حذف شود؟ این عمل برگشت‌ناپذیر است.`, `د کارکوونکي «${userName}» حساب ړنګ شي؟ دا کړنه بېرته نه ګرځي.`))) {
      deleteUser(id);
    }
  };

  const expiryBadge = (u: User) => {
    if (!u.accessExpiresAt) return null;
    const ms = new Date(u.accessExpiresAt).getTime();
    if (Number.isNaN(ms)) return null;
    const days = Math.ceil((ms - Date.now()) / 86400000);
    if (days < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300">
          <CalendarClock className="w-3 h-3" />
          {tp('Expired', 'منقضی', 'پای ته رسېدلی')}
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${days <= 14 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-slate-500/10 text-slate-500'}`}>
        <CalendarClock className="w-3 h-3" />
        {tp(`${days} days left`, `${days} روز باقی‌مانده`, `${days} ورځې پاتې`)}
      </span>
    );
  };

  const projectsSummary = (u: User) => {
    if (u.role === 'admin' || u.isMasterSuperAdmin) {
      return tp('Full access — all projects', 'دسترسی کامل — همه پروژه‌ها', 'بشپړ لاسرسی — ټولې پروژې');
    }
    const g = u.projectGrants;
    if (!g || g.length === 0) return tp('Legacy access (all projects)', 'دسترسی قدیمی (همه پروژه‌ها)', 'زوړ لاسرسی (ټولې پروژې)');
    if (g.some(x => x.projectId === '*')) {
      return tp('All projects (current + future)', 'همه پروژه‌ها (فعلی و آینده)', 'ټولې پروژې (اوسنۍ او راتلونکې)');
    }
    const names = g.map(x => projects.find(p => p.id === x.projectId)?.name || '?');
    return names.join(language === 'en' ? ', ' : '، ');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {formError && (
        <div className="text-xs font-bold px-4 py-2.5 rounded-xl border bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
          {formError}
        </div>
      )}
      {formOk && (
        <div className="text-xs font-bold px-4 py-2.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
          {formOk}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>{t('staffManagement') || 'Staff & User Access Management'}</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            {t('staffManagementDesc') || 'Control roles, permissions, accountants, site engineers, and viewers'}
            {' • '}
            {tp(`${team.length} accounts`, `${team.length} حساب`, `${team.length} حسابونه`)}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => { setIsAdding(!isAdding); setFormError(null); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{isAdding ? t('cancel') || 'Cancel' : t('addUser') || 'New Staff Member'}</span>
          </button>
        )}
      </div>

      {/* Wave 41: server sync status — users must log in on every device */}
      {canEdit && (
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              serverSync.status === 'ok' ? 'bg-emerald-500' :
              serverSync.status === 'checking' ? 'bg-slate-400 animate-pulse' :
              serverSync.status === 'offline' ? 'bg-amber-500' : 'bg-rose-500'
            }`} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink">
                {serverSync.status === 'ok' && tp('Server sync is ON — staff can log in on every device', 'سینک سرور فعال است — کارمندان در همه دستگاه‌ها وارد می‌شوند', 'د سرور همغږي فعاله ده — کارمندان په ټولو دستګاوو کې ننوځي')}
                {serverSync.status === 'checking' && tp('Checking server…', 'بررسی سرور…', 'سرور کتل…')}
                {serverSync.status === 'unknown' && tp('Sync status unknown — press check', 'وضعیت سینک نامشخص — بررسی را بزنید', 'د همغږۍ حالت نامعلوم — کتل کېکاږئ')}
                {serverSync.status === 'no-token' && tp('No server session — log out and log in once', 'نشست سرور نیست — یک‌بار خارج و دوباره وارد شوید', 'د سرور ناسته نشته — یو ځل ووځئ او بیا ننوځئ')}
                {serverSync.status === 'outdated' && tp('Server files are outdated — upload api/auth.php from the patch', 'فایل‌های سرور قدیمی است — api/auth.php را از پچ آپلود کنید', 'د سرور فایلونه زاړه دي — api/auth.php له پچ څخه پورته کړئ')}
                {serverSync.status === 'offline' && tp('Offline — changes stay queued', 'آفلاین — تغییرات در صف می‌ماند', 'آفلاین — بدلونونه په کتار کې پاتې کېږي')}
              </p>
              <p className="text-[11px] text-ink-muted truncate">
                {serverSync.pendingCount > 0 && tp(`${serverSync.pendingCount} queued`, `${serverSync.pendingCount} در صف`, `${serverSync.pendingCount} په کتار کې`) }
                {serverSync.pendingCount > 0 && (serverSync.lastError || syncMsg) ? ' • ' : ''}
                {serverSync.lastError === 'server-500'
                  ? tp('Server error 500 — check config.php and the database on the host', 'خطای ۵۰۰ سرور — config.php و دیتابیس هاست را بررسی کنید', 'د سرور ۵۰۰ تېروتنه — په هوسټ کې config.php او ډیټابېس وګورئ')
                  : serverSync.lastError === 'no-response'
                    ? tp('Server not responding', 'سرور جواب نمی‌دهد', 'سرور ځواب نه ورکوي')
                    : (serverSync.lastError || syncMsg || '')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setSyncMsg(null); refreshServerSyncStatus().catch(() => {}); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-ink text-[11px] font-bold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{tp('Check', 'بررسی', 'کتل')}</span>
            </button>
            <button
              disabled={syncBusy}
              onClick={async () => {
                setSyncBusy(true); setSyncMsg(null);
                try {
                  const r = await syncAllUsersToServer();
                  setSyncMsg(tp(
                    `Sent ${r.pushed} new, skipped ${r.skipped} existing, received ${r.pulledNew} new + ${r.pulledUpdated} updated, cleaned ${r.deduped} dups, queued ${r.queued}, failed ${r.failed}`,
                    `ارسال شد ${r.pushed} جدید، رد شد ${r.skipped} موجود، دریافت ${r.pulledNew} جدید + ${r.pulledUpdated} به‌روز، پاک شد ${r.deduped} تکراری، در صف ${r.queued}، ناموفق ${r.failed}`,
                    `ولېږل شول ${r.pushed} نوي، تېر شول ${r.skipped} شته، ترلاسه شول ${r.pulledNew} نوي + ${r.pulledUpdated} تازه، پاک شول ${r.deduped} نقلونه، په کتار کې ${r.queued}، ناکام ${r.failed}`,
                  ) + (r.failed > 0 && r.firstError ? ` — ${r.firstError}` : ''));
                } catch { setSyncMsg(tp('Sync failed', 'سینک ناموفق بود', 'همغږي ناکامه شوه')); }
                setSyncBusy(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold transition"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{syncBusy ? tp('Syncing…', 'در حال سینک…', 'همغږي کېږي…') : tp('Sync all users', 'سینک همه کاربران', 'ټول کاروونکي همغږي کړئ')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add User Form */}
      {isAdding && canCreate && (
        <form onSubmit={handleAdd} className="p-6 rounded-3xl bg-surface border border-line shadow-lg space-y-4">
          <h3 className="font-bold text-sm text-ink mb-2">{t('createNewUser') || 'Create New Staff Account'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('fullName') || 'Full Name'} *</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ahmad Tariq" className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('username') || 'Username (Login)'} *</label>
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. tariq_nik" className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('password') || 'Password'} *</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('role') || 'System Role'}</label>
              <select value={role} onChange={e => setRole(e.target.value as EmployeeRole)} className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs">
                <option value="accountant">{t('accountant') || 'Accountant / Site Engineer'}</option>
                <option value="viewer">{t('viewer') || 'Viewer (Read-only)'}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('phone') || 'Phone'}</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+93 70..." className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('email') || 'Email'}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@gmail.com" className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {tp('Access expires on (optional)', 'پایان دسترسی (اختیاری)', 'د لاسرسي پای (اختیاري)')}
              </label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
            </div>
          </div>

          <div className="pt-2">
            <h4 className="font-bold text-xs text-ink mb-2 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-500" />
              {tp('Project access + per-section permissions', 'دسترسی پروژه‌ها + دسترسی هر بخش', 'د پروژو لاسرسی + د هرې برخې لاسرسی')}
            </h4>
            <AccessMatrix grants={grants} onChange={setGrants} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setIsAdding(false); resetForm(); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold">
              {t('cancel')}
            </button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700">
              {t('saveUser') || 'Save User'}
            </button>
          </div>
        </form>
      )}

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {team.map(u => (
          <div key={u.id} className="p-6 rounded-3xl bg-surface border border-line shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${u.role === 'admin' ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600'}`}>
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-ink flex items-center gap-1.5 flex-wrap">
                      <span>{u.name}</span>
                      {u.isMasterSuperAdmin && (
                        <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">Owner</span>
                      )}
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                          {tp('You', 'شما', 'تاسې')}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">@{u.username}</p>
                    {/* Wave 60: server-delivery receipt per account. */}
                    {(() => {
                      const r = syncReceipts[u.id];
                      if (r && r.status === 'synced') {
                        return (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CloudUpload className="w-3 h-3" />
                            {tp('On server', 'در سرور', 'په سرور کې')}
                          </span>
                        );
                      }
                      if (!r || r.status === 'pending') {
                        return (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            {tp('Sending…', 'در حال ارسال…', 'استول کېږي…')}
                          </span>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => retryUserPush(u.id)}
                          title={r.error || ''}
                          className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {tp('Not sent — tap to retry', 'ارسال نشد — برای تلاش بزنید', 'ونه استول شو — د هڅې لپاره ووهئ')}
                        </button>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {canEdit && !u.isMasterSuperAdmin && u.id !== currentUser?.id && (
                    <>
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        title={tp('Edit access', 'ویرایش دسترسی', 'لاسرسی سمول')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleUserActive(u.id)}
                        className={`p-1.5 rounded-lg transition ${u.active !== false ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800' : 'text-amber-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800'}`}
                        title={u.active !== false ? tp('Deactivate', 'غیرفعال', 'غیر فعالول') : tp('Activate', 'فعال', 'فعالول')}
                      >
                        {u.active !== false ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </>
                  )}
                  {canDel && !u.isMasterSuperAdmin && u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      title={tp('Delete', 'حذف', 'ړنګول')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs text-ink-muted mb-4">
                <div className="flex justify-between">
                  <span>{t('role')}:</span>
                  <span className="font-bold capitalize text-slate-700 dark:text-slate-200">{u.role}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0">{tp('Projects:', 'پروژه‌ها:', 'پروژې:')}</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300 text-end flex items-center gap-1 justify-end">
                    {u.projectGrants?.some(g => g.projectId === '*') && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    {projectsSummary(u)}
                  </span>
                </div>
                {u.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{u.phone}</span>
                  </div>
                )}
                {u.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate">{u.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-line flex justify-between items-center text-[11px]">
              <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full ${u.active !== false ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${u.active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {u.active !== false ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
              </span>
              {expiryBadge(u)}
            </div>
          </div>
        ))}
      </div>

      {team.length === 0 && (
        <p className="text-center text-xs text-slate-400 py-8">
          {tp('No staff accounts yet.', 'هنوز حساب کارمندی ساخته نشده است.', 'تر اوسه د کارکوونکي حساب نه دی جوړ شوی.')}
        </p>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <form
            onSubmit={handleEditSave}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto bg-surface rounded-3xl border border-line shadow-2xl p-6 space-y-4"
          >
            <h3 className="font-black text-sm text-ink flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-500" />
              {tp(`Edit access — ${editing.name}`, `ویرایش دسترسی — ${editing.name}`, `لاسرسی سمول — ${editing.name}`)}
            </h3>
            {editing.role === 'admin' && !editing.isMasterSuperAdmin && (
              <p className="text-[11px] font-bold px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
                {tp('This is a co-admin account with full access. The matrix below only applies if the role is changed.',
                  'این حساب ادمین همکار با دسترسی کامل است. ماتریس زیر فقط در صورت تغییر نقش اعمال می‌شود.',
                  'دا د همکار ادمین حساب دی چې بشپړ لاسرسی لري. لاندې ماټرېکس یوازې د رول په بدلولو کې پلي کېږي.')}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('fullName') || 'Full Name'}</label>
                <input type="text" value={editFields.name} onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('phone') || 'Phone'}</label>
                <input type="text" value={editFields.phone} onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('email') || 'Email'}</label>
                <input type="email" value={editFields.email} onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {tp('New password (leave empty to keep)', 'رمز جدید (خالی = بدون تغییر)', 'نوی پټ نوم (تش = بې بدلونه)')}
                </label>
                <input type="password" value={editFields.password} onChange={e => setEditFields(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
              </div>
              {editing.role !== 'admin' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('role') || 'Role'}</label>
                  <select value={editRole} onChange={e => setEditRole(e.target.value as EmployeeRole)} className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs">
                    <option value="accountant">{t('accountant') || 'Accountant'}</option>
                    <option value="viewer">{t('viewer') || 'Viewer'}</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {tp('Access expires on', 'پایان دسترسی', 'د لاسرسي پای')}
                </label>
                <input type="date" value={editFields.expiresAt} onChange={e => setEditFields(f => ({ ...f, expiresAt: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs" />
              </div>
            </div>
            {editing.role !== 'admin' && (
              <div>
                <h4 className="font-bold text-xs text-ink mb-2 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-500" />
                  {tp('Project access + per-section permissions', 'دسترسی پروژه‌ها + دسترسی هر بخش', 'د پروژو لاسرسی + د هرې برخې لاسرسی')}
                </h4>
                <AccessMatrix grants={editGrants} onChange={setEditGrants} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold">
                {t('cancel')}
              </button>
              <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700">
                {tp('Save changes', 'ذخیره تغییرات', 'بدلونونه خوندي کول')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
