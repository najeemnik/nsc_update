import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeftRight, X, CheckCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { backendApi } from '../../services/backendApi';
import { transferTotals } from '../../utils/partnerFinance';
import type { InterProjectTransfer } from '../../types';

interface AddTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSourceProjectId?: string;
}

const KIND_LABEL: Record<InterProjectTransfer['kind'], [string, string, string]> = {
  funds: ['Cash / Funds', 'وجوه نقدی (Funds)', 'نغدې پیسې (Funds)'],
  materials: ['Materials', 'مصالح ساختمانی (Materials)', 'ساختماني مصالح (Materials)'],
  equipment: ['Equipment', 'ماشین‌آلات و تجهیزات (Equipment)', 'ماشینونه او تجهیزات (Equipment)'],
};

export const AddTransferModal: React.FC<AddTransferModalProps> = ({
  isOpen,
  onClose,
  defaultSourceProjectId,
}) => {
  const {
    currentProject, grantedProjects, formatNumber, t, tp,
    requestInterProjectTransfer, approveInterProjectTransfer, rejectInterProjectTransfer,
    interProjectTransfers, can,
  } = useApp();
  const [fromProjectId, setFromProjectId] = useState<string>(defaultSourceProjectId || currentProject?.id || (grantedProjects[0]?.id || ''));
  const [toProjectId, setToProjectId] = useState<string>('');
  const [transferNature, setTransferNature] = useState<'funds' | 'materials' | 'equipment'>('funds');
  const [amount, setAmount] = useState('50000');
  const [currency, setCurrency] = useState('AFN');
  const [materialDetail, setMaterialDetail] = useState('');
  const [fromAccount, setFromAccount] = useState('صندوق مرکزی کارگاه مبدأ');
  const [toAccount, setToAccount] = useState('حساب بانکی پروژه مقصد');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (defaultSourceProjectId) setFromProjectId(defaultSourceProjectId);
    else if (currentProject) setFromProjectId(currentProject.id);
    const other = grantedProjects.find(p => p.id !== (defaultSourceProjectId || currentProject?.id));
    if (other) setToProjectId(other.id);
    setTransferDate(new Date().toISOString().split('T')[0]);
    setFormError(null);
    setSuccessNotice(false);
  }, [isOpen, defaultSourceProjectId, currentProject, grantedProjects]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const canApprove = can('projects', 'approve');
  const grantedIds = new Set(grantedProjects.map(p => p.id));
  const visible = interProjectTransfers.filter(tr => grantedIds.has(tr.fromProjectId) || grantedIds.has(tr.toProjectId));
  const pending = visible.filter(tr => tr.status === 'pending');
  const history = visible.filter(tr => tr.status !== 'pending');
  const projName = (id: string) => grantedProjects.find(p => p.id === id)?.name || id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setFormError(tp('Please enter a valid transfer amount.', 'لطفاً مبلغ معتبر وارد کنید.', 'مهرباني وکړئ د انتقال سم مبلغ ولیکئ.'));
      return;
    }
    if (!fromProjectId || !toProjectId || fromProjectId === toProjectId) {
      setFormError(tp('Source and destination projects must be different.', 'پروژه مبدأ و مقصد نباید یکسان باشند.', 'سرچینه او منزل پروژه باید سره توپیر ولري.'));
      return;
    }
    if ((transferNature === 'materials' || transferNature === 'equipment') && !materialDetail.trim()) {
      setFormError(tp('Please describe the materials / equipment.', 'لطفاً مصالح یا تجهیزات را شرح دهید.', 'مهرباني وکړئ مصالح یا تجهیزات تشریح کړئ.'));
      return;
    }

    setIsSubmitting(true);
    const res = requestInterProjectTransfer({
      fromProjectId,
      toProjectId,
      kind: transferNature,
      amount: numAmt,
      currency,
      materialDetail: materialDetail.trim() || undefined,
      fromAccount: fromAccount.trim() || undefined,
      toAccount: toAccount.trim() || undefined,
      date: transferDate,
      reason: description.trim() || undefined,
    });
    // Best-effort server sync (local ledger is the source of truth).
    backendApi.interProjectTransfer({
      fromProjectId,
      toProjectId,
      transferNature,
      amount: numAmt,
      transferDate,
      approvedBy: '',
      description: description.trim() || undefined,
    }).catch(() => {});
    setIsSubmitting(false);

    if (!res.success) {
      setFormError(res.error === 'access-denied'
        ? tp('You do not have permission to request transfers.', 'شما مجوز ثبت حواله را ندارید.', 'تاسې د حوالې ثبتولو اجازه نه لرئ.')
        : (res.error || 'خطا در ثبت حواله'));
      return;
    }
    setSuccessNotice(true);
    setAmount('');
    setDescription('');
    setMaterialDetail('');
    setTimeout(() => setSuccessNotice(false), 4000);
  };

  const statusBadge = (s: InterProjectTransfer['status']) => s === 'approved' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
      <CheckCircle2 className="w-3 h-3" />{tp('Approved', 'تأییدشده', 'تایید شوی')}
    </span>
  ) : s === 'rejected' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300">
      <XCircle className="w-3 h-3" />{tp('Rejected', 'ردشده', 'رد شوی')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
      <Clock className="w-3 h-3" />{tp('Pending approval', 'در انتظار تأیید', 'د تایید په تمه')}
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-3xl bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-line bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-ink">
                {tp('Inter-Project Transfer', 'حواله و انتقال بین‌پروژه‌ای (Project Transfer)', 'بین پروژوي حواله او انتقال (Project Transfer)')}
              </h2>
              <p className="text-xs text-ink-muted">
                {tp('Transfer request → owner approval → recorded history', 'ثبت درخواست → تأیید مالک → تاریخچه دایمی', 'د غوښتنې ثبت → د مالک تایید → دایمي تاریخچه')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-ink rounded-xl hover:bg-surface-2 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
            {formError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold">
                {formError}
              </div>
            )}

            {successNotice && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>{tp('Transfer request recorded — waiting for owner approval.', 'درخواست حواله ثبت شد — در انتظار تأیید مالک.', 'د انتقال غوښتنه ثبت شوه — د مالک تایید ته انتظار.')}</span>
              </div>
            )}

            {/* Project Source ➔ Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tp('From Project (Source):', 'از پروژه (مبدأ ارسال):', 'له پروژې څخه (لېږونکې سرچینه):')}
                </label>
                <select
                  value={fromProjectId}
                  onChange={e => setFromProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-semibold"
                >
                  {grantedProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tp('To Project (Destination):', 'به پروژه (مقصد دریافت):', 'پروژې ته (ترلاسه کوونکی ځای):')}
                </label>
                <select
                  value={toProjectId}
                  onChange={e => setToProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-semibold"
                >
                  <option value="">-- انتخاب پروژه مقصد --</option>
                  {grantedProjects.filter(p => p.id !== fromProjectId).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Transfer Nature */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tp('Transfer Type', 'ماهیت انتقال', 'د انتقال ماهیت')}
                </label>
                <select
                  value={transferNature}
                  onChange={e => setTransferNature(e.target.value as 'funds' | 'materials' | 'equipment')}
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-semibold"
                >
                  <option value="funds">{tp(...KIND_LABEL.funds)}</option>
                  <option value="materials">{tp(...KIND_LABEL.materials)}</option>
                  <option value="equipment">{tp(...KIND_LABEL.equipment)}</option>
                </select>
              </div>

              {/* Amount / Value */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tp('Amount / Value', 'مبلغ یا ارزش تخمینی', 'مبلغ یا تخمیني ارزښت')}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-mono font-bold text-blue-600"
                  />
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="px-2 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-bold"
                  >
                    <option value="AFN">AFN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('date') || 'Date'}
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-mono"
                />
              </div>
            </div>

            {(transferNature === 'materials' || transferNature === 'equipment') && (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tp('Materials / equipment detail *', 'شرح مصالح / تجهیزات *', 'د مصالحو / تجهیزاتو شرح *')}
                </label>
                <input
                  type="text"
                  value={materialDetail}
                  onChange={e => setMaterialDetail(e.target.value)}
                  placeholder="مثال: ۱۲ تن سیخ ۱۴مم، یا: میکسر ۵۰۰ لیتری"
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tp('From account / store', 'از حساب / انبار', 'له حساب / ګدام څخه')}
                </label>
                <input
                  type="text"
                  value={fromAccount}
                  onChange={e => setFromAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-ink font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tp('To account / store', 'به حساب / انبار', 'حساب / ګدام ته')}
                </label>
                <input
                  type="text"
                  value={toAccount}
                  onChange={e => setToAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-ink font-semibold"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Reason / Description', 'علت حواله و توضیحات', 'د حوالې علت او توضیحات')}
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="دلیل انتقال وجه یا مصالح بین دو کارگاه ساختمانی..."
                className="w-full px-3.5 py-2 bg-surface-2 border border-line rounded-xl text-ink"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-surface-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-500/25 transition active:scale-95 disabled:opacity-50"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{isSubmitting ? 'در حال ثبت...' : tp('Record request', 'ثبت درخواست حواله', 'د حوالې غوښتنه ثبتول')}</span>
              </button>
            </div>
          </form>

          {/* Pending approvals */}
          <div className="px-5 sm:px-6 pb-2 text-xs">
            <h3 className="font-black text-ink mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              {tp(`Pending approvals (${pending.length})`, `در انتظار تأیید (${pending.length})`, `د تایید په تمه (${pending.length})`)}
            </h3>
            {pending.length === 0 ? (
              <p className="text-[11px] text-slate-400 pb-2">{tp('No pending requests.', 'درخواست معلقی وجود ندارد.', 'ځنډېدلې غوښتنه نشته.')}</p>
            ) : (
              <div className="space-y-2 pb-2">
                {pending.map(tr => (
                  <div key={tr.id} className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <div className="leading-relaxed">
                      <span className="font-black text-ink">{projName(tr.fromProjectId)}</span>
                      <span className="text-slate-400"> ← </span>
                      <span className="font-black text-ink">{projName(tr.toProjectId)}</span>
                      <span className="text-slate-400"> • {tp(...KIND_LABEL[tr.kind])} • </span>
                      <span className="font-mono font-bold text-blue-600">{formatNumber(tr.amount, 0)} {tr.currency}</span>
                      {tr.materialDetail && <span className="block text-[11px] text-slate-500">{tr.materialDetail}</span>}
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {tr.date}{tr.requestedBy ? ` • ${tp('by', 'توسط', 'لخوا')} ${tr.requestedBy}` : ''}{tr.reason ? ` • ${tr.reason}` : ''}
                      </span>
                    </div>
                    {canApprove ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => approveInterProjectTransfer(tr.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />{tp('Approve', 'تأیید', 'تایید')}
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectInterProjectTransfer(tr.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />{tp('Reject', 'رد', 'ردول')}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">{tp('Only the owner can approve.', 'فقط مالک می‌تواند تأیید کند.', 'یوازې مالک تاییدولی شي.')}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals per project */}
          {grantedProjects.length > 0 && visible.length > 0 && (
            <div className="px-5 sm:px-6 pb-2 text-xs">
              <h3 className="font-black text-ink mb-2">{tp('Sent / received per project (approved only)', 'ارسال / دریافت هر پروژه (فقط تأییدشده‌ها)', 'د هرې پروژې لېږل / ترلاسه کول (یوازې تایید شوي)')}</h3>
              <div className="flex flex-wrap gap-2 pb-2">
                {grantedProjects.map(p => {
                  const tot = transferTotals(visible, p.id, p.defaultExchangeRate || 70);
                  if (tot.sentUSD === 0 && tot.receivedUSD === 0 && tot.pendingOut === 0 && tot.pendingIn === 0) return null;
                  return (
                    <div key={p.id} className="px-3 py-2 rounded-xl bg-surface-2 border border-line text-[11px] leading-relaxed">
                      <span className="font-black text-ink block">{p.name}</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">↑ ${formatNumber(tot.sentUSD, 0)}</span>
                      <span className="text-slate-400"> / </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">↓ ${formatNumber(tot.receivedUSD, 0)}</span>
                      {(tot.pendingOut > 0 || tot.pendingIn > 0) && (
                        <span className="text-amber-600 font-bold"> • {tot.pendingOut + tot.pendingIn} {tp('pending', 'معلق', 'ځنډېدلی')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History */}
          <div className="px-5 sm:px-6 pb-6 text-xs">
            <h3 className="font-black text-ink mb-2">{tp(`History (${history.length})`, `تاریخچه (${history.length})`, `تاریخچه (${history.length})`)}</h3>
            {history.length === 0 ? (
              <p className="text-[11px] text-slate-400">{tp('No recorded transfers yet.', 'هنوز حوالۀ ثبت‌شده‌ای وجود ندارد.', 'تر اوسه ثبت شوې حواله نشته.')}</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line">
                <table className="w-full text-[11px] border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-surface-2/70 text-ink-muted">
                      <th className="text-start py-2 px-3">{t('date') || 'Date'}</th>
                      <th className="text-start py-2 px-3">{tp('Route', 'مسیر', 'لاره')}</th>
                      <th className="text-start py-2 px-3">{tp('Type', 'نوع', 'ډول')}</th>
                      <th className="text-end py-2 px-3">{tp('Amount', 'مبلغ', 'مبلغ')}</th>
                      <th className="text-start py-2 px-3">{tp('Status', 'وضعیت', 'حالت')}</th>
                      <th className="text-start py-2 px-3">{tp('By', 'توسط', 'لخوا')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {history.map(tr => (
                      <tr key={tr.id} className="hover:bg-surface-2/40">
                        <td className="py-2 px-3 font-mono text-slate-400 whitespace-nowrap">{tr.date}</td>
                        <td className="py-2 px-3 font-bold text-ink">{projName(tr.fromProjectId)} ← {projName(tr.toProjectId)}</td>
                        <td className="py-2 px-3 text-slate-500">{tp(...KIND_LABEL[tr.kind])}{tr.materialDetail ? ` — ${tr.materialDetail}` : ''}</td>
                        <td className="py-2 px-3 text-end font-mono font-bold">{formatNumber(tr.amount, 0)} {tr.currency}</td>
                        <td className="py-2 px-3">{statusBadge(tr.status)}</td>
                        <td className="py-2 px-3 text-slate-500">{tr.status === 'pending' ? (tr.requestedBy || '—') : (tr.approvedBy || '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
