/**
 * Stored-value display labels — Wave 33.
 *
 * Database values are stored in ONE language (often English ids like
 * 'permits' or Title Case like 'Bank Transfer'). These helpers render them
 * readably in the ACTIVE language, so no foreign language leaks into the UI.
 * Unknown values fall back to a humanized form (never raw camelCase).
 */
import type { Language } from '../types';
import { findCategoryDef, categoryLabel } from '../data/expenseCategories';
import { AVAILABLE_UNITS } from './unitConversion';

export type StoredKind = 'payment' | 'category' | 'doc' | 'unit';

/** camelCase / snake-case → readable words. Non-Latin text passes through untouched. */
export const humanizeKey = (key: string | undefined): string => {
  const s = (key || '').trim();
  if (!s) return '';
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, ch => ch.toUpperCase());
};

interface TriLabel { en: string; fa: string; ps: string; }

const PAYMENT_METHOD_LABELS: Record<string, TriLabel> = {
  cash: { en: 'Cash', fa: 'نقدی', ps: 'نغدي' },
  'bank transfer': { en: 'Bank Transfer', fa: 'انتقال بانکی', ps: 'بانکي انتقال' },
  banktransfer: { en: 'Bank Transfer', fa: 'انتقال بانکی', ps: 'بانکي انتقال' },
  'hawala / sarafi': { en: 'Hawala / Sarafi', fa: 'حواله / صرافی', ps: 'حواله / صرافي' },
  hawala: { en: 'Hawala', fa: 'حواله', ps: 'حواله' },
  sarafi: { en: 'Sarafi', fa: 'صرافی', ps: 'صرافي' },
  cheque: { en: 'Cheque', fa: 'چک بانکی', ps: 'بانکي چک' },
  check: { en: 'Cheque', fa: 'چک بانکی', ps: 'بانکي چک' },
};

/** Stored doc-category id → translations key (resolved by the caller via t()). */
export const DOC_CATEGORY_TKEY: Record<string, string> = {
  permits: 'docPermits',
  drawings: 'docDrawings',
  lab_reports: 'docLabReports',
  contracts: 'docContracts',
  invoices: 'docInvoices',
  sales_contracts: 'docSalesContracts',
  legal: 'docLegal',
};

const pick = (tri: TriLabel, lang: Language): string =>
  lang === 'ps' ? tri.ps : lang === 'fa' ? tri.fa : tri.en;

export const labelPaymentMethod = (stored: string | undefined, lang: Language): string => {
  const v = (stored || '').trim();
  if (!v) return '';
  const hit = PAYMENT_METHOD_LABELS[v.toLowerCase()];
  return hit ? pick(hit, lang) : humanizeKey(v);
};

export const labelExpenseCategory = (stored: string | undefined, lang: Language): string => {
  const v = (stored || '').trim();
  if (!v) return '';
  const def = findCategoryDef(v);
  return def ? categoryLabel(def, lang) : humanizeKey(v);
};

export const labelUnit = (stored: string | undefined, lang: Language): string => {
  const v = (stored || '').trim();
  if (!v) return '';
  const low = v.toLowerCase();
  const hit = AVAILABLE_UNITS.find(u =>
    u.id.toLowerCase() === low || u.symbol.toLowerCase() === low ||
    u.nameEn.toLowerCase() === low || u.nameFa === v || u.namePs === v,
  );
  if (!hit) return humanizeKey(v);
  return lang === 'ps' ? hit.namePs : lang === 'fa' ? hit.nameFa : hit.nameEn;
};
