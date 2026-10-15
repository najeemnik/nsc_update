import React from 'react';
import { useApp } from '../../context/AppContext';
import { DocPrintLayout } from './DocPrintLayout';
import { expUSD, expAFN, payUSD, payAFN, aptUSD, docStateOf, round2 } from '../../utils/docFinance';
import type { Payment, Expense, ApartmentUnit } from '../../types';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between py-1.5 border-b border-slate-100 text-xs">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-end">{value}</span>
  </div>
);

/* ---------------- Payment voucher ---------------- */
export const PaymentVoucherDoc: React.FC<{ payment: Payment; onClose: () => void }> = ({ payment: p, onClose }) => {
  const { tp, formatNumber } = useApp();
  const st = docStateOf(p);
  return (
    <DocPrintLayout
      docTitle={tp('Official Payment Voucher', 'سند رسمی پرداخت', 'د تادیې رسمي سند')}
      docNo={`#PAY-${p.id.slice(0, 8).toUpperCase()}`}
      date={p.date}
      statusLine={`${tp('Status', 'وضعیت', 'حالت')}: ${st === 'draft' ? tp('Draft', 'پیش‌نویس', 'مسوده') : st === 'posted' ? tp('Posted', 'ثبت نهایی', 'نهایي ثبت') : tp('Approved', 'تأییدشده', 'تایید شوی')}${p.reversedBy ? ' • ' + tp('Reversed', 'برگشت‌شده', 'بیرته شوی') : ''}`}
      totals={[{ label: tp('Amount Paid', 'مبلغ پرداخت‌شده', 'ورکړل شوې پیسې'), usd: payUSD(p), afn: payAFN(p), bold: true }]}
      notes={p.notes}
      section="payments"
      onClose={onClose}
    >
      <Row label={tp('Paid To', 'پرداخت به', 'ورکړه ته')} value={<span className="text-sm font-black">{p.recipientName}</span>} />
      <Row label={tp('Payment Method', 'روش پرداخت', 'د ورکړې لاره')} value={p.paymentMethod} />
      {p.referenceNumber && <Row label={tp('Reference', 'مرجع', 'ماخذ')} value={<span className="font-mono">{p.referenceNumber}</span>} />}
      <Row label={tp('Original Amount', 'مبلغ اصلی', 'اصلي پیسې')} value={`${formatNumber(p.amount ?? 0, 0)} ${p.currency || 'USD'}`} />
      {p.relatedType === 'expense' && p.relatedId && <Row label={tp('For Expense', 'بابت مصرف', 'د لګښت لپاره')} value={<span className="font-mono">#EXP-{String(p.relatedId).slice(0, 8).toUpperCase()}</span>} />}
      {p.reversalOf && <Row label={tp('Reverses Document', 'برگشت سند', 'د سند بیرته کول')} value={<span className="font-mono">{String(p.reversalOf).slice(0, 8)}</span>} />}
    </DocPrintLayout>
  );
};

/* ---------------- Expense bill (with qty/unit verification table) ---------------- */
export const ExpenseBillDoc: React.FC<{ expense: Expense; onClose: () => void }> = ({ expense: e, onClose }) => {
  const { tp, formatNumber } = useApp();
  const st = docStateOf(e);
  const qty = e.quantity ?? 1;
  const unitPrice = e.amount ?? 0;
  const lineTotal = qty * unitPrice;
  return (
    <DocPrintLayout
      docTitle={tp('Expense Bill', 'صورت‌حساب مصرف', 'د لګښت بل')}
      docNo={`#EXP-${e.id.slice(0, 8).toUpperCase()}`}
      date={e.date}
      statusLine={`${tp('Status', 'وضعیت', 'حالت')}: ${st === 'draft' ? tp('Draft', 'پیش‌نویس', 'مسوده') : st === 'posted' ? tp('Posted', 'ثبت نهایی', 'نهایي ثبت') : tp('Approved', 'تأییدشده', 'تایید شوی')}${e.reversedBy ? ' • ' + tp('Reversed', 'برگشت‌شده', 'بیرته شوی') : ''}`}
      totals={[{ label: tp('Total', 'جمع کل', 'ټولټال'), usd: expUSD(e), afn: expAFN(e), bold: true }]}
      notes={e.notes}
      section="expenses"
      onClose={onClose}
    >
      <Row label={tp('Title', 'شرح', 'شرحه')} value={e.title || e.description} />
      <Row label={tp('Category', 'کتگوری', 'کټګوري')} value={e.category} />
      {e.invoiceNumber && <Row label={tp('Invoice No', 'نمبر فاکتور', 'د بیل نمبر')} value={<span className="font-mono">{e.invoiceNumber}</span>} />}
      {e.recipientName && <Row label={tp('Supplier / Contractor', 'تمویل‌کننده / قراردادی', 'تمویلوونکی / قراردادي')} value={e.recipientName} />}
      <table className="w-full text-xs mt-3 border border-slate-200 rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-slate-100 font-bold">
            <th className="py-2 px-2 text-start">{tp('Description', 'شرح', 'شرحه')}</th>
            <th className="py-2 px-2 text-center">{tp('Qty', 'تعداد', 'شمېر')}</th>
            <th className="py-2 px-2 text-center">{tp('Unit', 'واحد', 'واحد')}</th>
            <th className="py-2 px-2 text-end">{tp('Unit Price', 'فی‌واحد', 'د واحد بیه')}</th>
            <th className="py-2 px-2 text-end">{tp('Total', 'مجموع', 'مجموعه')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-200">
            <td className="py-2 px-2 font-semibold">{e.title || e.description}</td>
            <td className="py-2 px-2 text-center font-mono">{formatNumber(qty, qty % 1 ? 2 : 0)}</td>
            <td className="py-2 px-2 text-center">{e.unit || '—'}</td>
            <td className="py-2 px-2 text-end font-mono">{formatNumber(unitPrice, 2)} {e.currency || 'USD'}</td>
            <td className="py-2 px-2 text-end font-mono font-bold">{formatNumber(lineTotal, 2)} {e.currency || 'USD'}</td>
          </tr>
        </tbody>
      </table>
      {e.reversalOf && <div className="mt-2"><Row label={tp('Reverses Document', 'برگشت سند', 'د سند بیرته کول')} value={<span className="font-mono">{String(e.reversalOf).slice(0, 8).toUpperCase()}</span>} /></div>}
    </DocPrintLayout>
  );
};

/* ---------------- Goods receipt (supplier delivery) ---------------- */
export const GoodsReceiptDoc: React.FC<{ expense: Expense; onClose: () => void }> = ({ expense: e, onClose }) => {
  const { tp, formatNumber } = useApp();
  const qty = e.quantity ?? 1;
  return (
    <DocPrintLayout
      docTitle={tp('Goods Receipt', 'رسید تحویل کالا', 'د مال ترلاسه کولو رسید')}
      docNo={`#GRN-${e.id.slice(0, 8).toUpperCase()}`}
      date={e.date}
      totals={[{ label: tp('Received Value', 'ارزش تحویل‌شده', 'ترلاسه شوي ارزښت'), usd: expUSD(e), afn: expAFN(e), bold: true }]}
      notes={e.notes}
      section="expenses"
      onClose={onClose}
    >
      <Row label={tp('Delivered By (Supplier)', 'تحویل‌دهنده (تمویل‌کننده)', 'ورکوونکی (تمویلوونکی)')} value={<span className="font-black">{e.recipientName || '—'}</span>} />
      {e.invoiceNumber && <Row label={tp('Delivery / Invoice No', 'نمبر تحویلی / فاکتور', 'د تحویلي / بیل نمبر')} value={<span className="font-mono">{e.invoiceNumber}</span>} />}
      <table className="w-full text-xs mt-3 border border-slate-200 rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-slate-100 font-bold">
            <th className="py-2 px-2 text-start">{tp('Item', 'جنس', 'جنس')}</th>
            <th className="py-2 px-2 text-center">{tp('Qty / Weight', 'تعداد / وزن', 'شمېر / وزن')}</th>
            <th className="py-2 px-2 text-center">{tp('Unit', 'واحد', 'واحد')}</th>
            <th className="py-2 px-2 text-end">{tp('Condition', 'وضعیت', 'حالت')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-200">
            <td className="py-2 px-2 font-semibold">{e.title || e.description}</td>
            <td className="py-2 px-2 text-center font-mono">{formatNumber(qty, qty % 1 ? 2 : 0)}</td>
            <td className="py-2 px-2 text-center">{e.unit || '—'}</td>
            <td className="py-2 px-2 text-end">{tp('Received complete', 'مکمل تحویل شد', 'بشپړ ترلاسه شو')}</td>
          </tr>
        </tbody>
      </table>
    </DocPrintLayout>
  );
};

/* ---------------- Apartment sale contract ---------------- */
export const SaleContractDoc: React.FC<{ apartment: ApartmentUnit; onClose: () => void }> = ({ apartment: a, onClose }) => {
  const { tp, formatNumber, formatCurrency, appSettings } = useApp();
  const rate = appSettings.exchangeRateUSDToAFN || 70;
  const priceUSD = aptUSD(a);
  const priceAFN = a.salePriceInAFN ?? (a.currency === 'AFN' ? (a.totalPrice ?? 0) : round2(priceUSD * rate));
  const receivedUSD = Math.max(0, (a.downPayment || 0) + Math.max(0, (a.amountReceived || 0) - (a.downPayment || 0)));
  const balanceUSD = Math.max(0, priceUSD - receivedUSD);
  const sched = (a.installments || []).slice().sort((x, y) => x.installmentNumber - y.installmentNumber);
  return (
    <DocPrintLayout
      docTitle={tp('Unit Sale Contract', 'قرارداد فروش واحد', 'د واحد د پلور تړون')}
      docNo={`#CTR-${a.id.slice(0, 8).toUpperCase()}`}
      date={a.contractDate || a.saleDate || new Date().toISOString().split('T')[0]}
      totals={[
        { label: tp('Total Price', 'قیمت مجموعی', 'ټوله بیه'), usd: priceUSD, afn: priceAFN },
        { label: tp('Received', 'دریافت‌شده', 'ترلاسه شوي'), usd: receivedUSD, afn: round2(receivedUSD * rate) },
        { label: tp('Remaining Balance', 'باقی‌مانده', 'پاتې'), usd: balanceUSD, afn: round2(balanceUSD * rate), bold: true },
      ]}
      notes={a.notes}
      section="apartments"
      onClose={onClose}
    >
      <Row label={tp('Buyer', 'خریدار', 'پېرودونکی')} value={<span className="font-black">{a.buyerName || '—'}</span>} />
      {a.buyerPhone && <Row label={tp('Buyer Phone', 'تلفن خریدار', 'د پېرودونکي تلفن')} value={<span className="font-mono">{a.buyerPhone}</span>} />}
      {a.buyerTazkira && <Row label={tp('Tazkira / ID', 'تذکره', 'تذکره')} value={<span className="font-mono">{a.buyerTazkira}</span>} />}
      <Row label={tp('Unit', 'واحد', 'واحد')} value={`${a.buildingSection ? a.buildingSection + ' • ' : ''}${tp('Floor', 'طبقه', 'پوړ')} ${formatNumber(a.floor, 0)} • ${tp('No', 'نمبر', 'نمبر')} ${a.unitNumber}`} />
      <Row label={tp('Area', 'مساحت', 'مساحت')} value={`${formatNumber(a.areaM2 ?? a.areaSqm ?? 0, 0)} m²`} />
      <Row label={tp('Price per m²', 'فی‌متر مربع', 'د متر مربع بیه')} value={a.pricePerM2 ? `${formatNumber(a.pricePerM2, 0)} ${a.currency || 'USD'}` : '—'} />
      {sched.length > 0 && (
        <table className="w-full text-xs mt-3 border border-slate-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-slate-100 font-bold">
              <th className="py-2 px-2 text-center">#</th>
              <th className="py-2 px-2 text-start">{tp('Due Date', 'سررسید', 'نېټه')}</th>
              <th className="py-2 px-2 text-end">{tp('Amount', 'مبلغ', 'پیسې')}</th>
              <th className="py-2 px-2 text-end">{tp('Paid', 'پرداخت‌شده', 'ورکړل شوي')}</th>
              <th className="py-2 px-2 text-center">{tp('Status', 'وضعیت', 'حالت')}</th>
            </tr>
          </thead>
          <tbody>
            {sched.map(s => (
              <tr key={s.id} className="border-t border-slate-200">
                <td className="py-2 px-2 text-center font-mono">{formatNumber(s.installmentNumber, 0)}</td>
                <td className="py-2 px-2 font-mono">{s.dueDate}</td>
                <td className="py-2 px-2 text-end font-mono">{formatNumber(s.amount, 0)} {s.currency || a.currency || 'USD'}</td>
                <td className="py-2 px-2 text-end font-mono">{formatNumber(s.paidAmount, 0)}</td>
                <td className="py-2 px-2 text-center">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-[10px] text-slate-500">{formatCurrency(priceUSD, 'USD')}</p>
    </DocPrintLayout>
  );
};
