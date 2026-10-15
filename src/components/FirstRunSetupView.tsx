import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, User, AtSign, Mail, Building2, KeyRound, Rocket } from 'lucide-react';

/**
 * Wave 37 go-live: first-run setup. Shown only when the production database
 * is completely empty (fresh host / after factory reset). Creates the ONE
 * master owner; nothing else exists before this step.
 */
export const FirstRunSetupView: React.FC = () => {
  const { bootstrapMasterAdmin, tp, setLanguage, language } = useApp();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== repeat) {
      setError(tp('Passwords do not match.', 'تکرار رمز مطابقت ندارد.', 'پټ نومونه سمون نه خوري.'));
      return;
    }
    setBusy(true);
    const res = bootstrapMasterAdmin({ name, username, email, password, companyName });
    setBusy(false);
    if (!res.success) setError(res.error || 'Failed.');
  };

  const inputCls =
    'w-full ps-10 pe-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950">
      <div className="w-full max-w-md bg-surface border border-line rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-ink">
              {tp('Welcome — set up your system', 'خوش آمدید — سیستم را راه‌اندازی کنید', 'ښه راغلاست — خپل سیسټم برابر کړئ')}
            </h1>
            <p className="text-xs text-ink-muted">
              {tp('Create your master owner account. This will be the only user.', 'حساب مالک ارشد خود را بسازید. این تنها کاربر سیستم خواهد بود.', 'د خپل مشر خاوند حساب جوړ کړئ. دا به د سیسټم یوازینی کاروونکی وي.')}
            </p>
          </div>
        </div>

        <div className="flex gap-2 text-[11px] font-bold">
          {(['en', 'fa', 'ps'] as const).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={`flex-1 py-1.5 rounded-lg border transition ${language === l ? 'bg-amber-600 text-white border-amber-600' : 'bg-surface-2 text-ink-muted border-line'}`}
            >
              {l === 'en' ? 'English' : l === 'fa' ? 'دری' : 'پښتو'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
              {error}
            </div>
          )}
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input required value={name} onChange={e => setName(e.target.value)} placeholder={tp('Full name', 'نام کامل', 'بشپړ نوم') as string} className={inputCls} />
          </div>
          <div className="relative">
            <AtSign className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input required value={username} onChange={e => setUsername(e.target.value)} placeholder={tp('Username (latin, min 3 chars)', 'نام کاربری (لاتین، حداقل ۳ حرف)', 'کارن نوم (لاتین، لږ تر لږه ۳ توري)') as string} autoComplete="username" className={`${inputCls} font-mono`} dir="ltr" />
          </div>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={tp('Email', 'ایمیل', 'برېښلیک') as string} autoComplete="email" className={`${inputCls} font-mono`} dir="ltr" />
          </div>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={tp('Company name', 'نام شرکت', 'د شرکت نوم') as string} className={inputCls} />
          </div>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={tp('Password (min 6 chars)', 'رمز (حداقل ۶ کاراکتر)', 'پټ نوم (لږ تر لږه ۶ توري)') as string} autoComplete="new-password" className={`${inputCls} font-mono`} dir="ltr" />
          </div>
          <div className="relative">
            <ShieldCheck className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input required type="password" value={repeat} onChange={e => setRepeat(e.target.value)} placeholder={tp('Repeat password', 'تکرار رمز', 'پټ نوم تکرار کړه') as string} autoComplete="new-password" className={`${inputCls} font-mono`} dir="ltr" />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm shadow-lg shadow-amber-500/25 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            <span>{busy ? tp('Creating…', 'در حال ساخت…', 'په جوړېدو کې…') : tp('Create master account', 'ساخت حساب مالک', 'د خاوند حساب جوړول')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
