/**
 * ============================================================================
 * Accounting edge-case suite (Wave 8)
 * Complements scripts/verify-journal.ts (seed-data happy path) with hostile
 * inputs: empty sets, zero/negative amounts, bad exchange rates, overpayment,
 * threshold boundaries, and rounding agreement across engines.
 *
 * Run:  npm run test:accounting
 * ============================================================================
 */

import { buildJournal, buildTrialBalance, isEntryBalanced } from '../src/utils/journalEngine';
import {
  computeBudgetReport, summarizeBudgetReport, getBudgetStatus,
} from '../src/utils/budgetUtils';
import {
  computeProjectCostPoolUSD, computeSellableAreaM2, allocateUnitCostUSD,
} from '../src/utils/wipAllocation';
import { calculateUnitConversion } from '../src/utils/unitConversion';
import { calculateInstallmentStatus, getDaysDifference } from '../src/utils/installmentUtils';

let failures = 0;
let passes = 0;
const check = (ok: boolean, label: string, extra = '') => {
  if (ok) { passes++; console.log(`  ✅ ${label}`); }
  else { failures++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`); }
};
const noNaN = (obj: any): boolean => {
  if (typeof obj === 'number') return Number.isFinite(obj);
  if (Array.isArray(obj)) return obj.every(noNaN);
  if (obj && typeof obj === 'object') return Object.values(obj).every(noNaN);
  return true;
};

const P = { id: 'p1', name: 'Test Tower', defaultExchangeRate: 70 } as any;
const emptyInput = {
  projects: [P], expenses: [], steelRecords: [], concreteRecords: [],
  payments: [], apartments: [], projectInvestments: [],
};

console.log('\n════════════ A. JOURNAL EDGES ════════════');
{
  const j = buildJournal(emptyInput as any);
  check(j.length === 0, 'empty input → zero entries');
  const tb = buildTrialBalance(j);
  check(tb.totalDebitUSD === 0 && tb.totalCreditUSD === 0, 'empty trial balance is zero');
}
{
  const j = buildJournal({
    ...emptyInput,
    expenses: [
      { id: 'e0', projectId: 'p1', category: 'Materials', date: '2026-01-01', amount: 0, currency: 'USD' },
      { id: 'eN', projectId: 'p1', category: 'Materials', date: '2026-01-01', amount: -50, currency: 'USD' },
    ],
  } as any);
  check(j.length === 0, 'zero/negative amounts are skipped');
}
{
  // AFN 7000 @ 70 → $100 each side
  const j = buildJournal({
    ...emptyInput,
    expenses: [
      { id: 'e1', projectId: 'p1', category: 'Materials', date: '2026-01-01', amount: 7000, currency: 'AFN', exchangeRate: 70 },
    ],
  } as any);
  check(j.length === 1, 'AFN purchase yields one entry');
  check(j[0].totalDebitUSD === 100 && j[0].totalCreditUSD === 100, `AFN→USD conversion exact (got ${j[0]?.totalDebitUSD}/${j[0]?.totalCreditUSD})`);
  check(isEntryBalanced(j[0], 0.001), 'AFN entry strictly balanced');
}
{
  // hostile rates → fallback, never NaN
  const j = buildJournal({
    ...emptyInput,
    expenses: [
      { id: 'e2', projectId: 'p1', category: 'Materials', date: '2026-01-01', amount: 100, currency: 'AFN', exchangeRate: 0 },
      { id: 'e3', projectId: 'p1', category: 'Materials', date: '2026-01-01', amount: 100, currency: 'AFN', exchangeRate: -5 },
      { id: 'e4', projectId: 'p1', category: 'Materials', date: '2026-01-01', amount: 100, currency: 'AFN' },
    ],
  } as any);
  check(j.length === 3 && noNaN(j), 'zero/negative/missing rate → fallback, no NaN/Infinity');
  check(j.every(e => isEntryBalanced(e, 0.01)), 'all fallback entries balanced');
}
{
  // unlinked settlement: paid 60, no Payment rows → reconciliation entry
  const j = buildJournal({
    ...emptyInput,
    expenses: [
      { id: 'e5', projectId: 'p1', category: 'Materials', date: '2026-01-01', amount: 100, currency: 'USD', paidAmount: 60 },
    ],
  } as any);
  check(j.some(e => e.id.includes('unlinked-settlement')), 'unlinked paid amount emits settlement entry');
  const j2 = buildJournal({
    ...emptyInput,
    expenses: [
      { id: 'e5', projectId: 'p1', category: 'Materials', date: '2026-01-01', amount: 100, currency: 'USD', paidAmount: 60 },
    ],
    payments: [{ id: 'pay1', relatedId: 'e5', relatedType: 'expense', amount: 60, currency: 'USD' }],
  } as any);
  check(!j2.some(e => e.id.includes('unlinked-settlement')), 'fully-linked payment emits no settlement entry');
  check(j2.every(e => isEntryBalanced(e, 0.01)), 'linked-payment journal strictly balanced');
}

console.log('\n════════════ B. BUDGET EDGES ════════════');
{
  check(getBudgetStatus(79.99, true) === 'normal', '79.99% → normal');
  check(getBudgetStatus(80, true) === 'warning', '80% → warning');
  check(getBudgetStatus(99.99, true) === 'warning', '99.99% → warning');
  check(getBudgetStatus(100, true) === 'over', '100% → over');
  check(getBudgetStatus(150, true) === 'over', '150% → over');
  check(getBudgetStatus(null, true) === 'unbudgeted', 'null usage → unbudgeted');
  check(getBudgetStatus(50, false) === 'unbudgeted', 'no budget line → unbudgeted');
}
{
  const rows = computeBudgetReport({
    projectId: 'p1', project: P,
    budgets: [{ projectId: 'p1', accountCode: '5100', amount: 70000, currency: 'AFN', exchangeRate: 70 } as any],
    expenses: [],
    steelRecords: [{ projectId: 'p1', totalAmount: 35000, currency: 'AFN', exchangeRate: 70, paidAmount: 35000 } as any],
    concreteRecords: [],
  });
  const steel = rows.find(r => r.accountCode === '5100');
  check(!!steel, 'steel budget line present');
  check(steel?.budgetUSD === 1000 && steel?.committedUSD === 500, `AFN budget math (budget=${steel?.budgetUSD}, committed=${steel?.committedUSD})`);
  check(steel?.usagePct === 50 && steel?.status === 'normal', '50% usage → normal');
  check(steel?.payableUSD === 0, 'fully paid → zero payable');
}
{
  // overpayment must be capped: paid can never exceed committed
  const rows = computeBudgetReport({
    projectId: 'p1', project: P,
    budgets: [{ projectId: 'p1', accountCode: '5100', amount: 1000, currency: 'USD' } as any],
    expenses: [],
    steelRecords: [{ projectId: 'p1', totalAmount: 400, currency: 'USD', paidAmount: 9999 } as any],
    concreteRecords: [],
  });
  const steel = rows.find(r => r.accountCode === '5100');
  check(steel?.paidUSD === 400 && steel?.payableUSD === 0, `overpayment capped (paid=${steel?.paidUSD}, payable=${steel?.payableUSD})`);
  const t = summarizeBudgetReport(rows);
  check(t.totalCommittedUSD === 400 && t.totalPaidUSD === 400 && t.usagePct === 40, 'summary totals agree with rows');
  check(t.status === 'normal', 'summary status normal at 40%');
}
{
  // over-budget detection
  const rows = computeBudgetReport({
    projectId: 'p1', project: P,
    budgets: [{ projectId: 'p1', accountCode: '5100', amount: 100, currency: 'USD' } as any],
    expenses: [],
    steelRecords: [{ projectId: 'p1', totalAmount: 150, currency: 'USD', paidAmount: 0 } as any],
    concreteRecords: [],
  });
  const steel = rows.find(r => r.accountCode === '5100');
  check(steel?.status === 'over' && steel?.remainingUSD === -50, '150% spend → over, remaining −$50');
}

console.log('\n════════════ C. WIP EDGES ════════════');
{
  const pool = computeProjectCostPoolUSD({
    projectId: 'p1',
    expenses: [{ projectId: 'p1', category: 'Materials', amount: 7000, currency: 'AFN', exchangeRate: 70 } as any],
    steelRecords: [{ projectId: 'p1', totalAmount: 200, currency: 'USD' } as any],
    concreteRecords: [{ projectId: 'p1', totalAmount: 300, currency: 'USD' } as any],
  });
  check(pool === 600, `cost pool = 100 + 200 + 300 = $600 (got ${pool})`);
  const units = [
    { projectId: 'p1', areaM2: 100 }, { projectId: 'p1', areaM2: 300 },
  ] as any;
  const area = computeSellableAreaM2(units);
  const a1 = allocateUnitCostUSD(units[0], pool, area);
  const a2 = allocateUnitCostUSD(units[1], pool, area);
  check(a1 === 150 && a2 === 450, `area allocation 1:3 → $150/$450 (got ${a1}/${a2})`);
  check(Math.abs(a1 + a2 - pool) < 0.02, 'allocations sum back to pool');
  check(allocateUnitCostUSD({ areaM2: 0 } as any, pool, area) === 0, 'zero area → zero allocation');
  check(allocateUnitCostUSD(units[0], 0, area) === 0, 'zero pool → zero allocation');
  check(allocateUnitCostUSD(units[0], pool, 0) === 0, 'zero total area → zero (no div/0)');
}

console.log('\n════════════ D. UNIT CONVERSION ════════════');
{
  const t1 = calculateUnitConversion(2, 'Ton');
  check(t1?.convertedQuantity === 2000 && t1?.targetUnit === 'kg', '2 Ton = 2000 kg');
  const t2 = calculateUnitConversion(1500, 'kg');
  check(t2?.convertedQuantity === 1.5 && t2?.targetUnit === 'Ton', '1500 kg = 1.5 Ton');
  check(calculateUnitConversion(0, 'Ton') === null, 'zero quantity → null');
  check(calculateUnitConversion(-5, 'Ton') === null, 'negative quantity → null');
  check(calculateUnitConversion(NaN, 'Ton') === null, 'NaN quantity → null');
}

console.log('\n════════════ E. INSTALLMENT STATUS ════════════');
{
  const now = new Date(2026, 9, 15); // 15 Oct 2026
  const d = (y: number, m: number, day: number) =>
    `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  check(calculateInstallmentStatus(1000, 1000, d(2026, 9, 1), now) === 'Paid', 'fully paid → Paid');
  check(calculateInstallmentStatus(1000, 200, d(2026, 9, 1), now) === 'Overdue', 'past due + partial → Overdue');
  check(calculateInstallmentStatus(1000, 0, d(2026, 10, 15), now) === 'Due', 'due today → Due');
  check(calculateInstallmentStatus(1000, 200, d(2026, 11, 1), now) === 'Partially Paid', 'future + partial → Partially Paid');
  check(calculateInstallmentStatus(1000, 0, d(2026, 11, 1), now) === 'Pending', 'future + unpaid → Pending');
  check(getDaysDifference(d(2026, 10, 10), now) === 5, '5 days overdue → +5');
  check(getDaysDifference(d(2026, 10, 20), now) === -5, '5 days left → −5');
  check(getDaysDifference(d(2026, 10, 15), now) === 0, 'today → 0');
}

console.log(`\n${failures === 0 ? '🎉 ALL EDGE CHECKS PASSED' : `💥 ${failures} FAILURES`} (${passes} passed)`);
process.exit(failures === 0 ? 0 : 1);
