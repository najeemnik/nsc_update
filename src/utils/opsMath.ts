/**
 * Wave 30 — operational math (pure, independently tested with hand fixtures).
 *
 * Single home for payroll, contractor deductions, P&L predicates and margins
 * so views and previews can never drift apart again.
 */
import type { ApartmentUnit, Payment } from '../types';

/** Payroll: gross = days × rate, net = max(0, gross − advance). */
export const laborPay = (
  daysWorked: number,
  dailyRate: number,
  advanceDeduction: number,
): { gross: number; advance: number; net: number } => {
  const days = Number(daysWorked) || 0;
  const rate = Number(dailyRate) || 0;
  const advance = Number(advanceDeduction) || 0;
  const gross = Math.round(days * rate * 100) / 100;
  const net = Math.max(0, Math.round((gross - advance) * 100) / 100);
  return { gross, advance, net };
};

/** Contractor statement: retention + BRT withholding deducted from gross. */
export const contractorPayout = (
  grossAmount: number,
  retentionPct = 10,
  brtPct = 2,
): { gross: number; retention: number; brt: number; net: number } => {
  const gross = Math.round((Number(grossAmount) || 0) * 100) / 100;
  const retention = Math.round((gross * (Number(retentionPct) || 0)) / 100);
  const brt = Math.round((gross * (Number(brtPct) || 0)) / 100);
  return { gross, retention, brt, net: gross - retention - brt };
};

/** Safe YYYY-MM-DD month matcher (invalid dates → false, never throw). */
export const inMonth = (dateStr: string | undefined, year: number, month1to12: number): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() + 1 === month1to12;
};

/** Cash INFLOW: income payments + apartment-buyer receipts (any label). */
export const isCashInflow = (p: Payment): boolean => {
  const anyP = p as unknown as Record<string, unknown>;
  return anyP.paymentType === 'income' || anyP.type === 'income' || p.recipientType === 'apartment_buyer';
};

/**
 * Cash OUTFLOW: everything dated that is NOT an inflow.
 * (Wave 30 fix: buyer receipts without the income label were counted as
 * outflow too — counted once, on the inflow side only.)
 */
export const isCashOutflow = (p: Payment): boolean => !isCashInflow(p);

/**
 * Collected cash fallback from unit sales (downPayment/amountReceived are the
 * runtime-settled fields; downPaymentUSD/paidAmountUSD are never written).
 */
export const collectedFromSales = (sales: ApartmentUnit[]): number =>
  sales.reduce(
    (sum, a) => sum + (a.downPayment ?? 0) + Math.max(0, (a.amountReceived || 0) - (a.downPayment || 0)),
    0,
  );

/** Net margin % — 0 when revenue is 0 (never NaN/Infinity). */
export const profitMargin = (revenue: number, cost: number): number => {
  const rev = Number(revenue) || 0;
  if (rev <= 0) return 0;
  return ((rev - (Number(cost) || 0)) / rev) * 100;
};

/** Round money to 2 decimals without float drift. */
export const roundMoney = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;
