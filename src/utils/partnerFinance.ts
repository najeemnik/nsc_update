import type {
  ApartmentUnit,
  ConcreteRecord,
  Expense,
  InterProjectTransfer,
  LaborRecord,
  PartnerEquityTransfer,
  Payment,
  ProjectInvestment,
  ProjectPartner,
  SteelRecord,
} from '../types';
import { expUSD, aptUSD } from './docFinance';

/**
 * Wave 21 — pure partner / equity / profit math (no React, fully unit-testable).
 * AppContext delegates to these helpers so every money rule is tested headlessly.
 */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const toUSD = (amount: number | undefined, currency?: string, rate?: number): number => {
  const a = Number(amount) || 0;
  if ((currency || 'USD').toUpperCase() === 'AFN') {
    const r = rate && rate > 0 ? rate : 70;
    return a / r;
  }
  return a;
};

// ---------------- equity transfer validation (req 9: never oversell) ----------------

export interface EquityTransferInput {
  projectId: string;
  fromPartnerId: string;
  fromPartnerName: string;
  toPartnerId?: string;
  toPartnerName: string;
  transferredPercentage: number;
  transferPrice: number;
  currency: string;
  transferDate: string;
  transferType: 'partner_to_partner' | 'new_partner' | 'company_buyout';
  deedNumber?: string;
  notes?: string;
}

export const validateEquityTransfer = (
  input: EquityTransferInput,
  seller: ProjectPartner | undefined,
  partners: ProjectPartner[],
): { ok: boolean; error?: string } => {
  if (!seller || seller.projectId !== input.projectId) {
    return { ok: false, error: 'شریک فروشنده در این پروژه یافت نشد.' };
  }
  if (seller.status === 'exited') {
    return { ok: false, error: 'این شریک قبلاً از شراکت خارج شده است.' };
  }
  const pct = input.transferredPercentage;
  if (!Number.isFinite(pct) || pct <= 0) {
    return { ok: false, error: 'درصد واگذاری باید عددی بزرگتر از صفر باشد.' };
  }
  const available = seller.sharePercentage || 0;
  if (pct - available > 1e-9) {
    return { ok: false, error: `فروش بیش از سهم موجود مجاز نیست (موجودی ${seller.name}: ${available}٪).` };
  }
  if (!Number.isFinite(input.transferPrice) || input.transferPrice < 0) {
    return { ok: false, error: 'مبلغ معامله نامعتبر است.' };
  }
  if (input.toPartnerId && input.toPartnerId === input.fromPartnerId) {
    return { ok: false, error: 'خریدار نمی‌تواند خود فروشنده باشد.' };
  }
  if (input.transferType === 'partner_to_partner') {
    const buyer = partners.find(p => p.id === input.toPartnerId && p.projectId === input.projectId);
    if (!buyer) return { ok: false, error: 'شریک خریدار در این پروژه یافت نشد.' };
    if (buyer.status === 'exited') return { ok: false, error: 'شریک خارج‌شده نمی‌تواند خریدار باشد.' };
  }
  if (input.transferType === 'new_partner' && !input.toPartnerName.trim()) {
    return { ok: false, error: 'نام خریدار جدید الزامی است.' };
  }
  if (!input.transferDate || Number.isNaN(new Date(input.transferDate).getTime())) {
    return { ok: false, error: 'تاریخ واگذاری نامعتبر است.' };
  }
  return { ok: true };
};

export const applyEquityTransfer = (
  partners: ProjectPartner[],
  t: EquityTransferInput,
): { partners: ProjectPartner[]; createdBuyer?: ProjectPartner } => {
  const next = partners.map(p => {
    if (p.id === t.fromPartnerId) {
      const remaining = Math.max(0, round2((p.sharePercentage || 0) - t.transferredPercentage));
      return {
        ...p,
        sharePercentage: remaining,
        status: remaining === 0 ? ('exited' as const) : p.status,
        exitDate: remaining === 0 ? t.transferDate : p.exitDate,
        exitReason: remaining === 0 ? `واگذاری کامل سهم به ${t.toPartnerName}` : p.exitReason,
        transferredToPartnerId: t.toPartnerId,
        transferredToPartnerName: t.toPartnerName,
        transferPrice: t.transferPrice,
        transferCurrency: t.currency,
      };
    }
    if (t.toPartnerId && p.id === t.toPartnerId) {
      return { ...p, sharePercentage: round2((p.sharePercentage || 0) + t.transferredPercentage) };
    }
    return p;
  });
  let createdBuyer: ProjectPartner | undefined;
  if (!t.toPartnerId && t.transferType === 'new_partner') {
    createdBuyer = {
      id: `pp-${Date.now()}`,
      projectId: t.projectId,
      name: t.toPartnerName.trim(),
      sharePercentage: t.transferredPercentage,
      initialInvestment: t.transferPrice,
      currency: t.currency,
      investmentDate: t.transferDate,
      notes: `خرید سهم از ${t.fromPartnerName} (سند: ${t.deedNumber || '—'})`,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
  }
  return { partners: next, createdBuyer };
};

// ---------------- share totals & company residual ----------------

export const activePartners = (partners: ProjectPartner[]): ProjectPartner[] =>
  partners.filter(p => p.status !== 'exited');

export const shareTotal = (partners: ProjectPartner[]): number =>
  round2(activePartners(partners).reduce((s, p) => s + (p.sharePercentage || 0), 0));

/** Company (treasury) holds whatever active partners don't. */
export const companyShare = (partners: ProjectPartner[]): number =>
  Math.max(0, round2(100 - shareTotal(partners)));

/** Can this share be added/edited without breaking the 100% cap? */
export const shareFits = (
  partners: ProjectPartner[],
  projectId: string,
  newShare: number,
  excludePartnerId?: string,
): boolean => {
  const others = activePartners(partners.filter(p => p.projectId === projectId && p.id !== excludePartnerId));
  return round2(others.reduce((s, p) => s + (p.sharePercentage || 0), 0) + (newShare || 0)) <= 100 + 1e-9;
};

// ---------------- real project profit (req 10) ----------------

export interface ProfitInput {
  projectId: string;
  rate: number;
  expenses: Expense[];
  steelRecords: SteelRecord[];
  concreteRecords: ConcreteRecord[];
  laborRecords: LaborRecord[];
  apartments: ApartmentUnit[];
  payments: Payment[];
}

export interface ProfitResult {
  revenueUSD: number;
  costUSD: number;
  profitUSD: number;
  revenueAFN: number;
  costAFN: number;
  profitAFN: number;
}

const isIncomePayment = (p: Payment): boolean => {
  const anyP = p as unknown as Record<string, unknown>;
  return anyP.paymentType === 'income' || anyP.type === 'income' || p.recipientType === 'apartment_buyer';
};

export const projectProfitUSD = (input: ProfitInput): ProfitResult => {
  const { projectId, rate } = input;
  const r = rate && rate > 0 ? rate : 70;
  // Revenue: contracted apartment sales + cash income receipts.
  const sold = input.apartments.filter(a => a.projectId === projectId && a.status === 'sold');
  const salesUSD = sold.reduce((s, a) => s + aptUSD(a), 0);
  const incomeUSD = input.payments
    .filter(p => p.projectId === projectId && p.docStatus !== 'draft' && isIncomePayment(p))
    .reduce((s, p) => s + (p.amountUSD ?? p.amountInUSD ?? toUSD(p.amount, p.currency, p.exchangeRate || r)), 0);
  // Cost: booked purchases + materials + gross labor (cash outflows excluded — they settle the same purchases).
  const expCostUSD = input.expenses
    .filter(e => e.projectId === projectId && e.approvalStatus !== 'rejected' && e.docStatus !== 'draft')
    .reduce((s, e) => s + expUSD(e), 0);
  const steelUSD = input.steelRecords
    .filter(s => s.projectId === projectId)
    .reduce((s, x) => s + (x.amountInUSD ?? x.totalCostUSD ?? toUSD(x.totalAmount, x.currency, x.exchangeRate || r)), 0);
  const concUSD = input.concreteRecords
    .filter(s => s.projectId === projectId)
    .reduce((s, x) => s + (x.amountInUSD ?? x.totalCostUSD ?? toUSD(x.totalAmount, x.currency, x.exchangeRate || r)), 0);
  const laborUSD = input.laborRecords
    .filter(l => l.projectId === projectId)
    .reduce((s, l) => s + (l.grossWage || 0) / r, 0);
  const revenueUSD = round2(salesUSD + incomeUSD);
  const costUSD = round2(expCostUSD + steelUSD + concUSD + laborUSD);
  const profitUSD = round2(revenueUSD - costUSD);
  return {
    revenueUSD, costUSD, profitUSD,
    revenueAFN: round2(revenueUSD * r),
    costAFN: round2(costUSD * r),
    profitAFN: round2(profitUSD * r),
  };
};

// ---------------- partner statements + distribution ----------------

export const partnerCapitalUSD = (
  partner: ProjectPartner,
  investments: ProjectInvestment[],
  rate: number,
): number => {
  const r = rate && rate > 0 ? rate : 70;
  return round2(investments
    .filter(i => i.projectId === partner.projectId && i.partnerId === partner.id)
    .reduce((s, i) => s + toUSD(i.amount, i.currency, i.exchangeRate || r), 0));
};

export interface PartnerStatement {
  partnerId: string;
  name: string;
  sharePct: number;
  capitalUSD: number;
  capitalAFN: number;
  soldPct: number;
  boughtPct: number;
  profitUSD: number;
  roiPct: number | null;
}

export const buildPartnerStatements = (
  partners: ProjectPartner[],
  investments: ProjectInvestment[],
  equityTransfers: PartnerEquityTransfer[],
  profitUSD: number,
  rate: number,
): PartnerStatement[] => {
  const r = rate && rate > 0 ? rate : 70;
  return activePartners(partners).map(p => {
    const capitalUSD = partnerCapitalUSD(p, investments, r);
    const soldPct = round2(equityTransfers
      .filter(t => t.projectId === p.projectId && t.fromPartnerId === p.id)
      .reduce((s, t) => s + t.transferredPercentage, 0));
    const boughtPct = round2(equityTransfers
      .filter(t => t.projectId === p.projectId && t.toPartnerId === p.id)
      .reduce((s, t) => s + t.transferredPercentage, 0));
    const profit = round2(((p.sharePercentage || 0) / 100) * profitUSD);
    return {
      partnerId: p.id,
      name: p.name,
      sharePct: p.sharePercentage || 0,
      capitalUSD,
      capitalAFN: round2(capitalUSD * r),
      soldPct,
      boughtPct,
      profitUSD: profit,
      roiPct: capitalUSD > 0 ? round2((profit / capitalUSD) * 100) : null,
    };
  });
};

// ---------------- inter-project transfer totals (req 11) ----------------

export interface TransferTotals {
  sentUSD: number;
  receivedUSD: number;
  pendingOut: number;
  pendingIn: number;
}

export const transferTotals = (
  transfers: InterProjectTransfer[],
  projectId: string,
  rate: number,
): TransferTotals => {
  const r = rate && rate > 0 ? rate : 70;
  let sentUSD = 0;
  let receivedUSD = 0;
  let pendingOut = 0;
  let pendingIn = 0;
  for (const t of transfers) {
    const usd = toUSD(t.amount, t.currency, r);
    if (t.fromProjectId === projectId) {
      if (t.status === 'approved') sentUSD += usd;
      else if (t.status === 'pending') pendingOut += 1;
    }
    if (t.toProjectId === projectId) {
      if (t.status === 'approved') receivedUSD += usd;
      else if (t.status === 'pending') pendingIn += 1;
    }
  }
  return { sentUSD: round2(sentUSD), receivedUSD: round2(receivedUSD), pendingOut, pendingIn };
};
