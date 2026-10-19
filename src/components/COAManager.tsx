import React, { useMemo, useState } from 'react';
import { Pencil, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getBudgetTradeGroups, nextLeafCode } from '../data/chartOfAccounts';

/**
 * Chart-of-Accounts manager (Wave 17): admin-only creation/rename/delete
 * of custom 6-digit sub-accounts under the 5xxx trades. System accounts
 * are immutable. All mutations are validated + role-checked in AppContext.
 */
interface COAManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormState = {
  parentCode: string;
  nameFa: string;
  nameEn: string;
  namePs: string;
  isBudgetMinor: boolean;
};

const EMPTY_FORM = (firstMain: string): FormState => ({
  parentCode: firstMain,
  nameFa: '',
  nameEn: '',
  namePs: '',
  isBudgetMinor: false,
});

export const COAManager: React.FC<COAManagerProps> = ({ isOpen, onClose }) => {
  const {
    tp, language, currentUser, customAccounts,
    addCustomAccount, updateCustomAccount, deleteCustomAccount,
    getAccountDisplayName,
  } = useApp();

  const mains = useMemo(() => getBudgetTradeGroups().map(g => g.main), []);
  const [editingCode, setEditingCode] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(() => EMPTY_FORM(mains[0]?.code || '5100'));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManage = currentUser?.role === 'admin' || !!currentUser?.isMasterSuperAdmin;

  if (!isOpen) return null;

  const errText = (code: string): string => {
    switch (code) {
      case 'forbidden': return tp('Only administrators can change the chart.', 'فقط ادمین می‌تواند چارت را تغییر دهد.', 'یوازې ادمین کولی شي چارټ بدل کړي.');
      case 'bad-parent': return tp('Parent must be a 5xxx trade account.', 'حساب مادر باید یک رشته 5xxx باشد.', 'مور حساب باید د 5xxx یو trade وي.');
      case 'bad-name': return tp('Account name (Dari) is required.', 'نام حساب (دری) الزامی است.', 'د حساب نوم (دري) اړین دی.');
      case 'code-full': return tp('No free code left under this trade (01–99 used).', 'کد آزاد زیر این رشته نمانده است.', 'د دې برخې لاندې وړیا کوډ پاتې نه شو.');
      case 'not-custom': return tp('Only user-created accounts can be changed.', 'فقط حساب‌های ساخته‌شده توسط کاربر قابل تغییر است.', 'یوازې د کارونکي جوړ شوي حسابونه بدلېدای شي.');
      case 'has-children': return tp('Cannot delete: it has sub-accounts.', 'حذف ممکن نیست: زیرحساب دارد.', 'ړنګول نشي کېدای: فرعي حسابونه لري.');
      case 'has-budgets': return tp('Cannot delete: budgets use this account.', 'حذف ممکن نیست: بودجه‌ها از این حساب استفاده می‌کنند.', 'ړنګول نشي کېدای: بودجې له دې حساب څخه کار اخلي.');
      case 'has-journals': return tp('Cannot delete: posted entries use this account.', 'حذف ممکن نیست: اسناد ثبت‌شده از این حساب استفاده می‌کنند.', 'ړنګول نشي کېدای: ثبت شوي سندونه له دې حساب څخه کار اخلي.');
      default: return code;
    }
  };

  const startAdd = () => {
    setEditingCode('new');
    setForm(EMPTY_FORM(mains[0]?.code || '5100'));
    setError(null);
    setNotice(null);
  };

  const startEdit = (code: string) => {
    const a = customAccounts.find(x => x.code === code);
    if (!a) return;
    setEditingCode(code);
    setForm({
      parentCode: a.parentCode || '',
      nameFa: a.nameFa,
      nameEn: a.nameEn === a.nameFa ? '' : a.nameEn,
      namePs: a.namePs === a.nameFa ? '' : a.namePs,
      isBudgetMinor: !!a.isBudgetMinor,
    });
    setError(null);
    setNotice(null);
  };

  const handleSave = () => {
    setError(null);
    setNotice(null);
    if (editingCode === 'new') {
      const res = addCustomAccount(form);
      if (!res.success) { setError(errText(res.error || 'forbidden')); return; }
      setNotice(tp(`Account ${res.account?.code} created.`, `حساب ${res.account?.code} ساخته شد.`, `حساب ${res.account?.code} جوړ شو.`));
      setEditingCode(null);
    } else if (editingCode) {
      const res = updateCustomAccount(editingCode, {
        nameFa: form.nameFa,
        nameEn: form.nameEn,
        namePs: form.namePs,
        isBudgetMinor: form.isBudgetMinor,
      });
      if (!res.success) { setError(errText(res.error || 'forbidden')); return; }
      setNotice(tp('Account updated.', 'حساب به‌روزشد.', 'حساب تازه شو.'));
      setEditingCode(null);
    }
  };

  const handleDelete = (code: string, name: string) => {
    setError(null);
    setNotice(null);
    const ok = window.confirm(
      tp(`Delete account ${code} "${name}"?`, `حساب ${code} «${name}» حذف شود؟`, `حساب ${code} «${name}» ړنګ شي؟`),
    );
    if (!ok) return;
    const res = deleteCustomAccount(code);
    if (!res.success) { setError(errText(res.error || 'forbidden')); return; }
    setNotice(tp('Account deleted.', 'حساب حذف شد.', 'حساب ړنګ شو.'));
  };

  const previewCode = editingCode === 'new' ? nextLeafCode(form.parentCode) : null;
  const sorted = [...customAccounts].sort((a, b) => (a.code < b.code ? -1 : 1));

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-line shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-black text-ink flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            {tp('Manage Chart of Accounts (Admin)', 'مدیریت چارت حساب‌ها (ادمین)', 'د حسابونو چارټ مدیریت (ادمین)')}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg" aria-label={tp('Close', 'بستن', 'بندول')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {!canManage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
              {errText('forbidden')}
            </div>
          )}

          {canManage && (
            <>
              {error && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">{error}</div>
              )}
              {notice && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">{notice}</div>
              )}

              {editingCode === null ? (
                <>
                  <button
                    type="button"
                    onClick={startAdd}
                    className="w-full py-2.5 border-2 border-dashed border-amber-300 hover:border-amber-500 text-amber-800 dark:text-amber-200 rounded-2xl font-bold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    {tp('Add sub-account under a trade', 'افزودن زیرحساب به یک رشته', 'یوې برخې ته فرعي حساب ورزياتول')}
                  </button>

                  {sorted.length === 0 && (
                    <p className="text-center text-slate-500 py-4">
                      {tp('No custom accounts yet. System accounts are locked and listed in the COA tab.', 'هنوز حساب دلخواهی ساخته نشده. حساب‌های سیستمی قفل‌اند و در تب چارت دیده می‌شوند.', 'تر اوسه دودیز حساب نه دی جوړ شوی. سیسټم حسابونه بند دي.')}
                    </p>
                  )}

                  <div className="space-y-2">
                    {sorted.map(a => (
                      <div key={a.code} className="flex items-center gap-2 p-3 rounded-2xl border border-line bg-slate-50/60 dark:bg-slate-800/50">
                        <span className="font-mono font-black text-amber-600 text-[11px] shrink-0">{a.code}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-ink truncate">{language === 'en' ? a.nameEn : language === 'ps' ? a.namePs : a.nameFa}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {tp('Under', 'زیر', 'لاندې')}: {getAccountDisplayName(a.parentCode || '', language)}
                            {a.isBudgetMinor ? ` • ${tp('small expense', 'مصرف کوچک', 'واړه لګښت')}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(a.code)}
                          className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg"
                          title={tp('Edit', 'ویرایش', 'سمون')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.code, a.nameFa)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"
                          title={tp('Delete', 'حذف', 'ړنګول')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {editingCode === 'new' ? (
                    <div>
                      <label className="block font-bold text-ink mb-1">{tp('Parent trade', 'رشته مادر', 'مور برخه')}</label>
                      <select
                        value={form.parentCode}
                        onChange={e => setForm({ ...form, parentCode: e.target.value })}
                        className="w-full px-3 py-2 border border-line rounded-xl bg-surface text-xs"
                      >
                        {mains.map(m => (
                          <option key={m.code} value={m.code}>
                            {m.code} — {getAccountDisplayName(m.code, language)}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {tp('New code', 'کد جدید', 'نوی کوډ')}: <span className="font-mono font-black text-amber-600">{previewCode || '—'}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      {tp('Code (fixed)', 'کد (ثابت)', 'کوډ (ثابت)')}: <span className="font-mono font-black text-amber-600">{editingCode}</span>
                    </p>
                  )}

                  <div>
                    <label className="block font-bold text-ink mb-1">
                      {tp('Name (Dari)', 'نام (دری)', 'نوم (دري)')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nameFa}
                      onChange={e => setForm({ ...form, nameFa: e.target.value })}
                      className="w-full px-3 py-2 border border-line rounded-xl bg-surface text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-ink mb-1">{tp('Name (English, optional)', 'نام (انگلیسی، اختیاری)', 'نوم (انګلیسي، اختیاري)')}</label>
                      <input
                        type="text"
                        value={form.nameEn}
                        onChange={e => setForm({ ...form, nameEn: e.target.value })}
                        className="w-full px-3 py-2 border border-line rounded-xl bg-surface text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-ink mb-1">{tp('Name (Pashto, optional)', 'نام (پشتو، اختیاری)', 'نوم (پښتو، اختیاري)')}</label>
                      <input
                        type="text"
                        value={form.namePs}
                        onChange={e => setForm({ ...form, namePs: e.target.value })}
                        className="w-full px-3 py-2 border border-line rounded-xl bg-surface text-xs"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.isBudgetMinor}
                      onChange={e => setForm({ ...form, isBudgetMinor: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    {tp('Small/optional expense in the budget sheet', 'مصرف کوچک/اختیاری در بجت‌شیت', 'په بجټ شیت کې واړه/اختیاري لګښت')}
                  </label>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!form.nameFa.trim()}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl font-bold transition"
                    >
                      {editingCode === 'new' ? tp('Create account', 'ساخت حساب', 'حساب جوړول') : tp('Save changes', 'ذخیره تغییرات', 'بدلونونه خوندي کول')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingCode(null); setError(null); }}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-2xl font-bold transition"
                    >
                      {tp('Cancel', 'انصراف', 'لغوه')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
