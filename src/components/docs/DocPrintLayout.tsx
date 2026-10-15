import React from 'react';
import { useApp } from '../../context/AppContext';

export interface DocTotal {
  label: string;
  usd: number;
  afn: number;
  bold?: boolean;
}

interface DocPrintLayoutProps {
  docTitle: string;
  docNo: string;
  date: string;
  statusLine?: string;
  totals?: DocTotal[];
  notes?: string;
  section: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Wave 24: canonical printable shell for all financial documents.
 * Company branding comes from AppSettings + billDesign (Settings → Company/Bill),
 * so logo / bank / signatures / custom texts print on every voucher, bill and contract.
 */
export const DocPrintLayout: React.FC<DocPrintLayoutProps> = ({
  docTitle, docNo, date, statusLine, totals, notes, section, onClose, children,
}) => {
  const { appSettings, currentProject, language, tp, formatCurrency, formatNumber, printIfAllowed } = useApp();
  const bill = appSettings.billDesign || {};
  const rtl = language !== 'en';
  const sig1 = appSettings.reportCustomization?.signature1Title || tp('Prepared by', 'تهیه‌کننده', 'چمتو کوونکی');
  const sig2 = appSettings.reportCustomization?.signature2Title || tp('Approved by', 'تأییدکننده', 'تاییدوونکی');
  const sig3 = appSettings.reportCustomization?.signature3Title || tp('Received by', 'گیرنده', 'ترلاسه کوونکی');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-transparent print:block print:overflow-visible">
      <div
        dir={rtl ? 'rtl' : 'ltr'}
        className="print-doc relative bg-white text-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl my-6 p-8 print:my-0 print:max-w-none print:rounded-none print:shadow-none"
      >
        {(bill.showWatermark && (bill.watermarkText || appSettings.reportCustomization?.watermarkText)) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span className="text-6xl font-black text-slate-200/70 rotate-[-24deg] select-none whitespace-nowrap">
              {bill.watermarkText || appSettings.reportCustomization?.watermarkText}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex items-center gap-3">
            {(appSettings.reportCustomization?.showLogo !== false && (appSettings.logoUrl || appSettings.billDesign?.logoPosition)) ? (
              <img src={appSettings.logoUrl} alt="logo" className="w-14 h-14 object-contain" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-black">
                {(appSettings.companyName || 'NSC').slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="text-lg font-black leading-tight">{bill.receiptTitle || appSettings.companyName}</h1>
              <p className="text-[11px] text-slate-500">{bill.receiptSubheader || appSettings.companySubtitle}</p>
              {(bill.companyPhone || bill.companyAddress || appSettings.receiptContact) && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {[bill.companyPhone, bill.companyAddress, bill.companyEmail, appSettings.receiptContact].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
          </div>
          <div className="text-end shrink-0">
            <p className="text-base font-black">{docTitle}</p>
            <p className="text-[11px] font-mono text-slate-500 mt-1">{docNo}</p>
            <p className="text-[11px] text-slate-500">{date}</p>
            {statusLine && <p className="text-[10px] font-bold text-slate-600 mt-1">{statusLine}</p>}
          </div>
        </div>

        {appSettings.receiptHeader && (
          <p className="text-center text-[11px] font-semibold text-slate-600 mb-3">{appSettings.receiptHeader}</p>
        )}
        <p className="text-[11px] text-slate-500 mb-3">{currentProject?.name}</p>

        {/* Body */}
        <div className="relative">{children}</div>

        {/* Totals */}
        {totals && totals.length > 0 && (
          <div className="mt-4 border-t-2 border-slate-900 pt-2 space-y-1">
            {totals.map((t, i) => (
              <div key={i} className={`flex justify-between text-xs ${t.bold ? 'font-black text-sm' : 'font-semibold'}`}>
                <span>{t.label}</span>
                <span className="font-mono">{formatCurrency(t.usd, 'USD')} <span className="text-slate-500">({formatNumber(t.afn, 0)} AFN)</span></span>
              </div>
            ))}
          </div>
        )}

        {bill.bankDetails && (
          <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-600 whitespace-pre-line">
            {bill.bankDetails}
          </div>
        )}
        {notes && (
          <div className="mt-3 text-[11px] text-slate-600"><span className="font-bold">{tp('Notes', 'یادداشت', 'یادښت')}: </span>{notes}</div>
        )}
        {bill.termsAndConditions && (
          <div className="mt-3 text-[10px] text-slate-500 whitespace-pre-line border-t pt-2">{bill.termsAndConditions}</div>
        )}

        {/* Signatures */}
        {appSettings.reportCustomization?.showSignatures !== false && (
          <div className="mt-8 flex justify-between text-center text-[11px] gap-4">
            {[sig1, sig2, sig3].map((s, i) => (
              <div key={i} className="flex-1">
                <div className="h-10" />
                <div className="border-t border-slate-400 pt-1 text-slate-500">{s}</div>
              </div>
            ))}
          </div>
        )}
        {bill.showStampArea && (
          <div className="mt-4 flex justify-end">
            <div className="w-32 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
              {tp('Stamp', 'مهر', 'ټاپه')}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-[10px] text-slate-400">
          {bill.receiptFooter || appSettings.receiptFooter}
        </p>

        {/* Screen-only actions */}
        <div className="mt-6 flex justify-end gap-2 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
          >
            {tp('Close', 'بستن', 'تړل')}
          </button>
          <button
            onClick={() => printIfAllowed(section)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
          >
            {tp('Print', 'چاپ', 'چاپ')}
          </button>
        </div>
      </div>
    </div>
  );
};
