import React, { useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { DocQr } from './DocQr';
import {
  sanitizeDesign, fontStackOf, paperOptionOf, qrPayload, DEFAULT_SECTION_ORDER,
} from '../../utils/docDesign';
import type { DocSectionId } from '../../types';

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
 * Wave 24 shell + Wave 27 design engine: every visual aspect (font, colors,
 * margins, paper, logo, section order, QR) comes from the sanitized bill
 * design configured in Office7 / Settings. Screen = WYSIWYG preview of paper.
 */
export const DocPrintLayout: React.FC<DocPrintLayoutProps> = ({
  docTitle, docNo, date, statusLine, totals, notes, section, onClose, children,
}) => {
  const { appSettings, currentProject, language, tp, formatCurrency, formatNumber, printIfAllowed } = useApp();
  const design = useMemo(() => sanitizeDesign(appSettings.billDesign || {}), [appSettings.billDesign]);
  const rtl = language !== 'en';
  const paper = paperOptionOf(design.paperSize);
  const isThermal = paper.id === 'thermal';
  const primary = design.primaryColor || '#0f172a';
  const fontStack = fontStackOf(design.fontFamily);
  const scale = design.fontScale || 1;
  const logoH = design.logoSize || 56;
  const sigOn = appSettings.reportCustomization?.showSignatures !== false;
  const sig1 = appSettings.reportCustomization?.signature1Title || tp('Prepared by', 'تهیه‌کننده', 'چمتو کوونکی');
  const sig2 = appSettings.reportCustomization?.signature2Title || tp('Approved by', 'تأییدکننده', 'تاییدوونکی');
  const sig3 = appSettings.reportCustomization?.signature3Title || tp('Received by', 'گیرنده', 'ترلاسه کوونکی');

  // @page cannot be inlined — inject a scoped print rule while the doc is open.
  useEffect(() => {
    const el = document.createElement('style');
    el.setAttribute('data-doc-page', '1');
    el.textContent = `@page { size: ${paper.cssSize}; margin: ${design.marginMm || 12}mm; }`;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [paper.cssSize, design.marginMm]);

  const qrText = useMemo(() => {
    const usd = (totals || []).reduce((s, t) => s + (t.usd || 0), 0);
    const afn = (totals || []).reduce((s, t) => s + (t.afn || 0), 0);
    return qrPayload({
      company: appSettings.companyName || 'NSC',
      docNo,
      date,
      usd: Math.round(usd * 100) / 100,
      afn: Math.round(afn),
    });
  }, [totals, appSettings.companyName, docNo, date]);

  const bill = appSettings.billDesign || {};
  const wmText = design.showWatermark ? (bill.watermarkText || appSettings.reportCustomization?.watermarkText) : null;
  const order: DocSectionId[] = design.sectionOrder && design.sectionOrder.length > 0
    ? design.sectionOrder
    : DEFAULT_SECTION_ORDER;

  const logoPos = design.logoPosition || 'start';
  const headerLayout = logoPos === 'center'
    ? 'flex-col items-center text-center'
    : logoPos === 'end' || logoPos === 'left'
      ? 'flex-row-reverse items-start text-start'
      : 'items-start';

  const sectionBlocks: Record<DocSectionId, React.ReactNode> = {
    bank: bill.bankDetails ? (
      <div key="bank" className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-600 whitespace-pre-line">
        {bill.bankDetails}
      </div>
    ) : null,
    notes: notes ? (
      <div key="notes" className="mt-3 text-[11px] text-slate-600">
        <span className="font-bold">{tp('Notes', 'یادداشت', 'یادښت')}: </span>{notes}
      </div>
    ) : null,
    terms: bill.termsAndConditions ? (
      <div key="terms" className="mt-3 text-[10px] text-slate-500 whitespace-pre-line border-t pt-2">
        {bill.termsAndConditions}
      </div>
    ) : null,
    signatures: sigOn ? (
      <div key="sig" className={`mt-8 flex text-center text-[11px] gap-4 ${isThermal ? 'flex-col' : 'justify-between'}`}>
        {[sig1, sig2, sig3].map((s, i) => (
          <div key={i} className="flex-1">
            <div className="h-10" />
            <div className="border-t border-slate-400 pt-1 text-slate-500">{s}</div>
          </div>
        ))}
      </div>
    ) : null,
    stamp: design.showStampArea ? (
      <div key="stamp" className="mt-4 flex justify-end">
        <div className="w-32 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
          {tp('Stamp', 'مهر', 'ټاپه')}
        </div>
      </div>
    ) : null,
    qr: design.showQrCode !== false ? (
      <div key="qr" className="mt-4 flex justify-center print:justify-end">
        <DocQr payload={qrText} size={isThermal ? 72 : 88} caption={tp('Scan to verify', 'برای راستی‌آزمایی اسکن کنید', 'د تایید لپاره سکین کړئ')} />
      </div>
    ) : null,
    footer: (bill.receiptFooter || appSettings.receiptFooter) ? (
      <p key="foot" className="mt-6 text-center text-[10px] text-slate-400">
        {bill.receiptFooter || appSettings.receiptFooter}
      </p>
    ) : null,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm overflow-auto print:p-0 print:bg-transparent print:block print:overflow-visible">
      <div
        dir={rtl ? 'rtl' : 'ltr'}
        style={{ fontFamily: fontStack, zoom: scale, maxWidth: paper.maxWidthPx }}
        className="print-doc relative bg-white text-slate-900 rounded-3xl shadow-2xl w-full my-6 p-8 print:my-0 print:max-w-none print:rounded-none print:shadow-none"
      >
        {wmText && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span className="text-6xl font-black text-slate-200/70 rotate-[-24deg] select-none whitespace-nowrap">
              {wmText}
            </span>
          </div>
        )}

        {/* Header */}
        <div className={`flex gap-4 border-b-2 pb-4 mb-4 ${headerLayout}`} style={{ borderColor: primary }}>
          <div className={`flex items-center gap-3 ${logoPos === 'center' ? 'flex-col' : ''}`}>
            {(appSettings.reportCustomization?.showLogo !== false && appSettings.logoUrl) ? (
              <img src={appSettings.logoUrl} alt="logo" style={{ height: logoH }} className="object-contain" />
            ) : (
              <div
                className="rounded-2xl text-white flex items-center justify-center text-xl font-black shrink-0"
                style={{ backgroundColor: primary, width: logoH, height: logoH }}
              >
                {(appSettings.companyName || 'NSC').slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="text-lg font-black leading-tight" style={{ color: primary }}>
                {bill.receiptTitle || appSettings.companyName}
              </h1>
              <p className="text-[11px] text-slate-500">{bill.receiptSubheader || appSettings.companySubtitle}</p>
              {(bill.companyPhone || bill.companyAddress || appSettings.receiptContact) && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {[bill.companyPhone, bill.companyAddress, bill.companyEmail, appSettings.receiptContact].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
          </div>
          <div className={`${logoPos === 'center' ? 'text-center' : 'text-end'} shrink-0 ${logoPos === 'start' || (!logoPos || logoPos === 'right') ? 'ms-auto' : ''} ${logoPos === 'end' || logoPos === 'left' ? 'me-auto' : ''}`}>
            <p className="text-base font-black" style={{ color: primary }}>{docTitle}</p>
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
          <div className="mt-4 border-t-2 pt-2 space-y-1" style={{ borderColor: primary }}>
            {totals.map((t, i) => (
              <div key={i} className={`flex justify-between text-xs ${t.bold ? 'font-black text-sm' : 'font-semibold'}`}>
                <span>{t.label}</span>
                <span className="font-mono">{formatCurrency(t.usd, 'USD')} <span className="text-slate-500">({formatNumber(t.afn, 0)} AFN)</span></span>
              </div>
            ))}
          </div>
        )}

        {/* Ordered optional sections */}
        {order.map(id => sectionBlocks[id])}

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
