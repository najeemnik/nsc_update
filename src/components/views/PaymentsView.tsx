import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AttachmentClip } from '../docs/AttachmentClip';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Printer, 
  Trash2, 
  Calendar, 
  DollarSign, 
  User, 
  FileText, 
  CheckCircle2,
  Download,
  Lock,
  LockOpen,
  Undo2
} from 'lucide-react';
import { Payment } from '../../types';
import { downloadCsv } from '../../utils/csvExport';
import { payUSD, payAFN, docStateOf } from '../../utils/docFinance';
import { PaymentVoucherDoc } from '../docs/printDocs';

interface PaymentsViewProps {
  onOpenAddPayment: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ onOpenAddPayment }) => {
  const { 
    currentProject, 
    payments, 
    deletePayment, 
    updatePayment, 
    formatCurrency, 
    formatNumber, 
    t, 
    language,
    tp,
    postPayment,
    unpostPayment,
    reversePayment
  ,
    printIfAllowed,
    can,
    denyAccess,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);

  const projectPayments = useMemo(() => {
    return payments.filter(p => p.projectId === currentProject?.id);
  }, [payments, currentProject]);

  const filteredPayments = useMemo(() => {
    return projectPayments.filter(p => {
      return (
        (p.recipientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.paymentMethod || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.referenceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [projectPayments, searchTerm]);

  const countedPayments = filteredPayments.filter(p => p.docStatus !== 'draft');
  const totalPaidUSD = countedPayments.reduce((sum, p) => sum + payUSD(p), 0);
  const totalPaidAFN = countedPayments.reduce((sum, p) => sum + payAFN(p), 0);

  const handleDelete = (id: string, recipient: string) => {
    if (!can('payments', 'del')) { denyAccess('payments', 'del'); return; }
    if (confirm(t('confirmDeletePayment') || `Are you sure you want to delete payment to "${recipient}"?`)) {
      deletePayment(id);
    }
  };

  const handleExportCsv = () => {
    if (!can('payments', 'export')) { denyAccess('payments', 'export'); return; }
    downloadCsv(`payments-${currentProject?.code || 'project'}-${new Date().toISOString().split('T')[0]}`,
      ['Date', 'Recipient', 'Method', 'Reference', 'Amount USD', 'Amount AFN', 'Notes'],
      filteredPayments.map(p => [
        p.date, p.recipientName || (p as any).partyName || '', p.paymentMethod || (p as any).method || '',
        p.referenceNumber || '', Math.round(payUSD(p) * 100) / 100, Math.round(payAFN(p)), p.notes || '',
      ]));
  };

  const handlePrintVoucher = (p: Payment) => {
    setSelectedReceiptPayment(p);
    setTimeout(() => {
      printIfAllowed('payments');
    }, 200);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>{t('paymentsRegister') || 'Payments & Disbursements'}</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            {currentProject?.name} • {t('totalDisbursed')}: <strong>{formatCurrency(totalPaidUSD, 'USD')}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => printIfAllowed('payments')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            <span>{t('printList') || 'Print List'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-teal-500/25 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>{t('exportCsv') || 'CSV'}</span>
          </button>

          <button
            onClick={() => { if (can('payments', 'create')) onOpenAddPayment(); else denyAccess('payments', 'create'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-500/25 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addPayment') || 'New Payment Voucher'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm">
          <span className="text-xs text-slate-400 font-medium">{t('paymentTransactions') || 'Disbursement Count'}</span>
          <p className="text-xl font-black text-ink mt-1">{filteredPayments.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm">
          <span className="text-xs text-slate-400 font-medium">{t('totalPaidUSD') || 'Total Paid (USD)'}</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(totalPaidUSD, 'USD')}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm">
          <span className="text-xs text-slate-400 font-medium">{t('totalPaidAFN') || 'Total Paid (AFN)'}</span>
          <p className="text-xl font-black text-ink mt-1">{formatNumber(totalPaidAFN, 0)} AFN</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 rounded-2xl bg-surface border border-line">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('searchPayments') || 'Search recipient, method, reference...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-2/80 border border-line rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-3xl border border-line shadow-sm overflow-hidden">
        <div className="overflow-x-auto scroll-touch">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-2/60 text-ink-muted font-bold border-b border-line">
              <tr>
                <th className="py-3.5 px-4">{t('date') || 'Date'}</th>
                <th className="py-3.5 px-4">{t('recipient') || 'Recipient / Payee'}</th>
                <th className="py-3.5 px-4">{t('paymentMethod') || 'Payment Method'}</th>
                <th className="py-3.5 px-4">{t('referenceNumber') || 'Ref / Voucher #'}</th>
                <th className="py-3.5 px-4">{t('notes') || 'Purpose / Notes'}</th>
                <th className="py-3.5 px-4 text-right">{t('amountUSD') || 'Amount (USD)'}</th>
                <th className="py-3.5 px-4 text-center">{t('receipt') || 'Voucher'}</th>
                <th className="py-3.5 px-4 text-center">{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPayments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 text-ink-muted whitespace-nowrap">{p.date}</td>
                  <td className="py-3.5 px-4 font-bold text-ink">{p.recipientName}
                    {docStateOf(p) === 'draft' && (
                      <span className="ms-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">{tp('Draft — not booked', 'پیش‌نویس — خارج از حساب', 'مسوده — له حساب وتلی')}</span>
                    )}
                    {p.docStatus === 'posted' && !p.reversedBy && (
                      <span className="ms-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500"><Lock className="w-3 h-3" />{tp('Posted', 'ثبت نهایی', 'نهایي ثبت')}</span>
                    )}
                    {p.reversedBy && (
                      <span className="ms-1.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">{tp('Reversed', 'برگشت‌شده', 'بیرته شوی')}</span>
                    )}
                    {p.reversalOf && (
                      <span className="ms-1.5 text-[10px] font-bold text-rose-500 dark:text-rose-300">{tp('Reversal entry', 'سند برگشتی', 'بیرته سند')}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 bg-surface-2 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      {p.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{p.referenceNumber || '—'}</td>
                  <td className="py-3.5 px-4 text-ink-muted max-w-xs truncate">{p.notes || '—'}</td>
                  <td className="py-3.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    <div>{formatCurrency(payUSD(p), 'USD')}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {formatNumber(payAFN(p), 0)} AFN
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handlePrintVoucher(p)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
                      title={t('printVoucher') || 'Print Payment Receipt'}
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {p.attachments && p.attachments.length > 0 && (
                      <AttachmentClip refs={p.attachments} section="payments" onRefsChange={next => updatePayment(p.id, { attachments: next })} />
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {can('payments', 'approve') && docStateOf(p) !== 'posted' && !p.reversedBy && (
                      <button
                        onClick={() => postPayment(p.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        title={tp('Post (lock)', 'ثبت نهایی (قفل)', 'نهایي ثبت (قفل)')}
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                    )}
                    {can('payments', 'approve') && p.docStatus === 'posted' && !p.reversedBy && (
                      <button
                        onClick={() => unpostPayment(p.id)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition"
                        title={tp('Unpost (unlock for correction)', 'بازگشایی برای تصحیح', 'د سمون لپاره خلاصول')}
                      >
                        <LockOpen className="w-4 h-4" />
                      </button>
                    )}
                    {can('payments', 'approve') && !p.reversedBy && (
                      <button
                        onClick={() => { if (confirm(tp('Reverse this payment? A mirror entry will be created; the original is preserved and locked.', 'این پرداخت برگشت شود؟ سند آینه‌ای ساخته می‌شود؛ سند اصلی حفظ و قفل می‌گردد.', 'دا تادیه بیرته شي؟ آینه‌يي سند به جوړ شي؛ اصلي سند ساتل کېږي او قفل کېږي.'))) reversePayment(p.id); }}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-slate-800 rounded-lg transition"
                        title={tp('Reverse (keeps original)', 'برگشت (با حفظ سند اصلی)', 'بیرته کول (له اصلي سند سره)')}
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(p.id, p.recipientName || p.partyName || 'Payment')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition"
                      title={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    {t('noPaymentsFound') || 'No payment transactions recorded'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReceiptPayment && (
        <PaymentVoucherDoc payment={selectedReceiptPayment} onClose={() => setSelectedReceiptPayment(null)} />
      )}
    </div>
  );
};
