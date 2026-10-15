/**
 * Wave 21+22 verification: equity validation, share math, profit, statements, transfers.
 * Run: npm run test:partners
 */
import {
  validateEquityTransfer,
  applyEquityTransfer,
  shareTotal,
  companyShare,
  shareFits,
  projectProfitUSD,
  partnerCapitalUSD,
  buildPartnerStatements,
  transferTotals,
  toUSD,
  type EquityTransferInput,
} from '../src/utils/partnerFinance';
import type {
  ApartmentUnit,
  Expense,
  InterProjectTransfer,
  ProjectInvestment,
  ProjectPartner,
} from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const mkPartner = (over: Partial<ProjectPartner> = {}): ProjectPartner => ({
  id: 'p1', projectId: 'proj1', name: 'Ahmad', currency: 'USD',
  sharePercentage: 40, status: 'active', createdAt: '2026-01-01',
  ...over,
});

const mkInput = (over: Partial<EquityTransferInput> = {}): EquityTransferInput => ({
  projectId: 'proj1',
  fromPartnerId: 'p1',
  fromPartnerName: 'Ahmad',
  toPartnerId: 'p2',
  toPartnerName: 'Karim',
  transferredPercentage: 10,
  transferPrice: 5000,
  currency: 'USD',
  transferDate: '2026-10-15',
  transferType: 'partner_to_partner',
  ...over,
});

function main() {
  const seller = mkPartner();
  const buyer = mkPartner({ id: 'p2', name: 'Karim', sharePercentage: 30 });
  const all = [seller, buyer];

  // ---------- validateEquityTransfer ----------
  check('eq-ok', validateEquityTransfer(mkInput(), seller, all).ok === true);
  check('eq-seller-missing', validateEquityTransfer(mkInput(), undefined, all).ok === false);
  check('eq-seller-wrong-project', validateEquityTransfer(mkInput(), mkPartner({ projectId: 'other' }), all).ok === false);
  check('eq-seller-exited', validateEquityTransfer(mkInput(), mkPartner({ status: 'exited' }), all).ok === false);
  check('eq-zero-pct', validateEquityTransfer(mkInput({ transferredPercentage: 0 }), seller, all).ok === false);
  const over = validateEquityTransfer(mkInput({ transferredPercentage: 40.01 }), seller, all);
  check('eq-oversell-blocked', over.ok === false && (over.error || '').includes('40'));
  check('eq-exact-full-ok', validateEquityTransfer(mkInput({ transferredPercentage: 40 }), seller, all).ok === true);
  check('eq-neg-price', validateEquityTransfer(mkInput({ transferPrice: -1 }), seller, all).ok === false);
  check('eq-self-buy', validateEquityTransfer(mkInput({ toPartnerId: 'p1' }), seller, all).ok === false);
  check('eq-buyer-missing', validateEquityTransfer(mkInput({ toPartnerId: 'ghost' }), seller, all).ok === false);
  check('eq-buyer-exited', validateEquityTransfer(
    mkInput(), seller, [seller, mkPartner({ id: 'p2', status: 'exited' })]).ok === false);
  check('eq-new-noname', validateEquityTransfer(
    mkInput({ transferType: 'new_partner', toPartnerId: undefined, toPartnerName: '  ' }), seller, all).ok === false);
  check('eq-bad-date', validateEquityTransfer(mkInput({ transferDate: 'xx' }), seller, all).ok === false);
  check('eq-buyout-ok', validateEquityTransfer(
    mkInput({ transferType: 'company_buyout', toPartnerId: undefined, toPartnerName: 'Treasury' }), seller, all).ok === true);

  // ---------- applyEquityTransfer ----------
  const partial = applyEquityTransfer(all, mkInput());
  check('apply-partial-seller', partial.partners.find(p => p.id === 'p1')?.sharePercentage === 30);
  check('apply-partial-buyer', partial.partners.find(p => p.id === 'p2')?.sharePercentage === 40);
  check('apply-partial-no-exit', partial.partners.find(p => p.id === 'p1')?.status === 'active');
  const full = applyEquityTransfer(all, mkInput({ transferredPercentage: 40 }));
  const exited = full.partners.find(p => p.id === 'p1');
  check('apply-full-exited', exited?.status === 'exited' && exited?.sharePercentage === 0);
  check('apply-full-reason', (exited?.exitReason || '').includes('Karim') && exited?.exitDate === '2026-10-15');
  const fresh = applyEquityTransfer(all, mkInput({ transferType: 'new_partner', toPartnerId: undefined, toPartnerName: 'Nabi', transferredPercentage: 15 }));
  check('apply-new-buyer', fresh.createdBuyer?.name === 'Nabi' && fresh.createdBuyer?.sharePercentage === 15);
  check('apply-new-seller-down', fresh.partners.find(p => p.id === 'p1')?.sharePercentage === 25);
  const buyout = applyEquityTransfer(all, mkInput({ transferType: 'company_buyout', toPartnerId: undefined, toPartnerName: 'Treasury', transferredPercentage: 40 }));
  check('apply-buyout-vanish', buyout.partners.find(p => p.id === 'p2')?.sharePercentage === 30 && buyout.createdBuyer === undefined);
  check('apply-total-preserved', shareTotal([...partial.partners]) === 70);

  // ---------- share math ----------
  check('share-total', shareTotal(all) === 70);
  check('share-total-skips-exited', shareTotal([...all, mkPartner({ id: 'px', sharePercentage: 99, status: 'exited' })]) === 70);
  check('company-share', companyShare(all) === 30);
  check('share-fits-ok', shareFits(all, 'proj1', 30) === true);
  check('share-fits-over', shareFits(all, 'proj1', 30.01) === false);
  check('share-fits-edit-self', shareFits(all, 'proj1', 60, 'p1') === true); // 30 (others) + 60
  check('share-fits-edit-over', shareFits(all, 'proj1', 70.01, 'p1') === false);

  // ---------- projectProfitUSD ----------
  const profit = projectProfitUSD({
    projectId: 'proj1',
    rate: 70,
    expenses: [
      { projectId: 'proj1', totalAmountUSD: 1000 } as Expense,
      { projectId: 'proj1', totalAmountUSD: 500, approvalStatus: 'rejected' } as Expense,
      { projectId: 'other', totalAmountUSD: 999 } as Expense,
    ],
    steelRecords: [{ projectId: 'proj1', amountInUSD: 200 } as never],
    concreteRecords: [{ projectId: 'proj1', totalAmount: 7000, currency: 'AFN', exchangeRate: 70 } as never],
    laborRecords: [{ projectId: 'proj1', grossWage: 70000 } as never],
    apartments: [
      { projectId: 'proj1', status: 'sold', totalPriceUSD: 10000 } as ApartmentUnit,
      { projectId: 'proj1', status: 'available', totalPriceUSD: 50000 } as ApartmentUnit,
    ],
    payments: [
      { projectId: 'proj1', paymentType: 'income', amountUSD: 500 } as never,
      { projectId: 'proj1', paymentType: 'expense', amountUSD: 300 } as never,
    ],
  });
  // revenue = 10000 + 500; cost = 1000 + 200 + 100 + 1000
  check('profit-revenue', profit.revenueUSD === 10500, `rev=${profit.revenueUSD}`);
  check('profit-cost', profit.costUSD === 2300, `cost=${profit.costUSD}`);
  check('profit-net', profit.profitUSD === 8200, `net=${profit.profitUSD}`);
  check('profit-afn', profit.profitAFN === 8200 * 70);
  const empty = projectProfitUSD({ projectId: 'x', rate: 70, expenses: [], steelRecords: [], concreteRecords: [], laborRecords: [], apartments: [], payments: [] });
  check('profit-empty-zero', empty.profitUSD === 0 && empty.revenueUSD === 0);

  // ---------- capital + statements ----------
  const invs: ProjectInvestment[] = [
    { id: 'i1', projectId: 'proj1', partnerId: 'p1', partnerName: 'Ahmad', amount: 7000, currency: 'AFN', exchangeRate: 70, date: '2026-01-01', type: 'initial', createdAt: '' },
    { id: 'i2', projectId: 'proj1', partnerId: 'p1', partnerName: 'Ahmad', amount: 900, currency: 'USD', date: '2026-02-01', type: 'additional', createdAt: '' },
  ];
  check('capital-mixed', partnerCapitalUSD(seller, invs, 70) === 1000);
  const stmts = buildPartnerStatements(all, invs, [], 8200, 70);
  const s1 = stmts.find(s => s.partnerId === 'p1');
  check('stmt-profit-split', s1?.profitUSD === 3280, `p=${s1?.profitUSD}`); // 40% of 8200
  check('stmt-roi', s1?.roiPct === 328, `roi=${s1?.roiPct}`);
  const s2 = stmts.find(s => s.partnerId === 'p2');
  check('stmt-null-roi', s2?.roiPct === null && s2?.profitUSD === 2460);
  const withTr = buildPartnerStatements(all, invs, [
    { projectId: 'proj1', fromPartnerId: 'p1', toPartnerId: 'p2', transferredPercentage: 5 } as never,
  ], 1000, 70);
  check('stmt-sold-bought',
    withTr.find(s => s.partnerId === 'p1')?.soldPct === 5 &&
    withTr.find(s => s.partnerId === 'p2')?.boughtPct === 5);

  // ---------- transferTotals ----------
  const trs: InterProjectTransfer[] = [
    { id: 't1', fromProjectId: 'a', toProjectId: 'b', kind: 'funds', amount: 1400, currency: 'AFN', date: '2026-01-01', status: 'approved', createdAt: '' },
    { id: 't2', fromProjectId: 'b', toProjectId: 'a', kind: 'materials', amount: 50, currency: 'USD', date: '2026-01-02', status: 'approved', createdAt: '' },
    { id: 't3', fromProjectId: 'a', toProjectId: 'b', kind: 'funds', amount: 10, currency: 'USD', date: '2026-01-03', status: 'pending', createdAt: '' },
    { id: 't4', fromProjectId: 'a', toProjectId: 'b', kind: 'funds', amount: 999, currency: 'USD', date: '2026-01-04', status: 'rejected', createdAt: '' },
  ];
  const tot = transferTotals(trs, 'a', 70);
  check('tot-sent', tot.sentUSD === 20, `sent=${tot.sentUSD}`);
  check('tot-received', tot.receivedUSD === 50);
  check('tot-pending', tot.pendingOut === 1 && tot.pendingIn === 0);

  // ---------- misc ----------
  check('tousd-afn', toUSD(7000, 'AFN', 70) === 100);
  check('tousd-usd', toUSD(5, 'USD', 70) === 5);

  // ---------- summary ----------
  for (const r of results) console.log(r);
  console.log(`\npartners: ${passed} passed, ${failed} failed (${passed + failed} checks)`);
  if (failed > 0) process.exit(1);
}

main();
