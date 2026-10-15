import type { ApartmentUnit, DocStatus, Expense, Payment } from '../types';

/**
 * Wave 23 — canonical money + document-lifecycle helpers (pure, unit-testable).
 *
 * MONEY INVARIANT (req 3/4/5): `amount` is the RAW entered value in `currency`.
 * `amountInUSD / amountInAFN` (+ `totalAmountUSD/AFN`, `amountUSD/AFN` mirrors)
 * are canonical conversions computed ONCE by AppContext writers. Every total,
 * engine and balance uses the canonical USD fields — never raw+currency math
 * scattered across views.
 *
 * Legacy records (pre-W23) stored USD-normalized `amount` with the ORIGINAL
 * currency label, but they DO carry correct `amountInUSD/amountInAFN` — so the
 * helpers below prefer explicit canonical fields and only convert raw values
 * as a last resort. This keeps old localStorage data displaying correctly.
 */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const canonicalMoney = (
  amount: number | undefined,
  currency?: string,
  rate?: number,
): { usd: number; afn: number } => {
  const raw = Number(amount) || 0;
  const r = rate && rate > 0 ? rate : 70;
  if ((currency || 'USD').toUpperCase() === 'AFN') {
    return { usd: round2(raw / r), afn: Math.round(raw) };
  }
  return { usd: round2(raw), afn: Math.round(raw * r) };
};

/** Canonical USD value of an expense (legacy-safe). */
export const expUSD = (e: Expense): number =>
  e.totalAmountUSD ?? e.amountInUSD ?? canonicalMoney(e.amount, e.currency, e.exchangeRate).usd;

/** Canonical AFN value of an expense (legacy-safe). */
export const expAFN = (e: Expense): number =>
  e.totalAmountAFN ?? e.amountInAFN ?? canonicalMoney(e.amount, e.currency, e.exchangeRate).afn;

/** Canonical USD value of a payment (legacy-safe). */
export const payUSD = (p: Payment): number =>
  p.amountUSD ?? p.amountInUSD ?? canonicalMoney(p.amount, p.currency, p.exchangeRate).usd;

/** Canonical AFN value of a payment (legacy-safe). */
export const payAFN = (p: Payment): number =>
  p.amountAFN ?? p.amountInAFN ?? canonicalMoney(p.amount, p.currency, p.exchangeRate).afn;

/** Canonical USD sale price of an apartment (legacy-safe). */
export const aptUSD = (a: ApartmentUnit): number =>
  a.totalPriceUSD ?? a.salePriceInUSD ?? a.salePrice ?? a.totalPrice ?? 0;

// ---------------- lifecycle (req 6/7/8) ----------------

interface DocLike {
  approvalStatus?: string;
  docStatus?: DocStatus;
  reversedBy?: string;
}

/** Drafts and rejected docs never hit books, totals or reminders. */
export const isCountedDoc = (d: DocLike): boolean =>
  d.approvalStatus !== 'rejected' && d.docStatus !== 'draft';

/** Posted (or reversed) docs are locked: editing needs the `approve` right. */
export const isLockedDoc = (d: DocLike): boolean =>
  d.docStatus === 'posted' || !!d.reversedBy;

/** Display state for pills: legacy (undefined) counts as approved. */
export const docStateOf = (d: DocLike): DocStatus | 'reversed' =>
  d.reversedBy ? 'reversed' : (d.docStatus || 'approved');

/** Money fields negated for a reversal mirror of an expense. */
export const expenseReversalMoney = (orig: Expense): Partial<Expense> => ({
  amount: -(orig.amount || 0),
  amountInUSD: -(orig.amountInUSD ?? canonicalMoney(orig.amount, orig.currency, orig.exchangeRate).usd),
  amountInAFN: -(orig.amountInAFN ?? canonicalMoney(orig.amount, orig.currency, orig.exchangeRate).afn),
  totalAmountUSD: -expUSD(orig),
  totalAmountAFN: -expAFN(orig),
  paidAmount: -(orig.paidAmount || 0),
  remainingAmount: -(orig.remainingAmount ?? Math.max(0, (orig.amount || 0) - (orig.paidAmount || 0))),
});

/** Money fields negated for a reversal mirror of a payment. */
export const paymentReversalMoney = (orig: Payment): Partial<Payment> => ({
  amount: -(orig.amount || 0),
  amountInUSD: -(orig.amountInUSD ?? canonicalMoney(orig.amount, orig.currency, orig.exchangeRate).usd),
  amountInAFN: -(orig.amountInAFN ?? canonicalMoney(orig.amount, orig.currency, orig.exchangeRate).afn),
  amountUSD: -payUSD(orig),
  amountAFN: -payAFN(orig),
});
