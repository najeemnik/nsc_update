/**
 * Wave 14+15 verification: comprehensive COA leaves + budget roll-up.
 * Run: npm run test:budget
 */
import {
  CHART_OF_ACCOUNTS,
  getAccount,
  getBudgetTradeGroups,
  resolveExpenseAccount,
  toBudgetMain,
} from '../src/data/chartOfAccounts';
import { computeBudgetReport } from '../src/utils/budgetUtils';
import type { Expense, Project, ProjectBudget } from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const as = <T>(o: object): T => o as unknown as T;

function main() {
  // --- roll-up helper ---
  check('rollup-main-identity', toBudgetMain('5950') === '5950');
  check('rollup-leaf-to-parent', toBudgetMain('595008') === '5950');
  check('rollup-unknown-passthrough', toBudgetMain('999999') === '9999' || toBudgetMain('999999') === '999999');
  check('rollup-empty-safe', toBudgetMain('') === '');

  // --- trade groups ---
  const groups = getBudgetTradeGroups();
  check('groups-18-trades', groups.length === 18, `got=${groups.length}`);
  check('groups-no-cogs', groups.every(g => g.main.code !== '5050'));
  check('groups-have-majors', groups.every(g => g.majors.length > 0));
  const paint = groups.find(g => g.main.code === '5950');
  check('paint-group-exists', !!paint);
  check('paint-has-brush-leaf', (paint?.minors || []).some(l => l.code === '595013'));
  check('paint-has-painter-wages', (paint?.majors || []).some(l => l.code === '595018'));

  // --- leaf integrity across the whole chart ---
  const leaves = CHART_OF_ACCOUNTS.filter(a => a.code.length === 6);
  check('leaf-count-126', leaves.length === 126, `got=${leaves.length}`);
  const codes = leaves.map(l => l.code);
  check('leaf-codes-unique', new Set(codes).size === codes.length);
  check('leaf-parents-exist', leaves.every(l => {
    const p = l.parentCode ? getAccount(l.parentCode) : undefined;
    return !!p && !p.isHeader && p.parentCode === '5000';
  }));
  check('leaf-names-trilingual', leaves.every(l => l.nameEn.trim() && l.nameFa.trim() && l.namePs.trim()));
  check('leaf-minors-exist', leaves.some(l => l.isBudgetMinor) && leaves.some(l => !l.isBudgetMinor));

  // --- category routing for new Dari terms ---
  check('route-rang', resolveExpenseAccount('رنگ') === '5950');
  check('route-rangmali', resolveExpenseAccount('رنگمالی') === '5950');
  check('route-gach', resolveExpenseAccount('گچ') === '5950');

  // --- report roll-up: leaf budgets + main-level actuals ---
  const proj = as<Project>({ id: 'p1', defaultExchangeRate: 70 });
  const paintExpense = as<Expense>({
    projectId: 'p1', category: 'Paint', amount: 150, currency: 'USD',
    exchangeRate: 70, amountInUSD: 150, paidAmount: 0,
  });
  const mkBudget = (code: string, amount: number): ProjectBudget =>
    as<ProjectBudget>({ id: `b-${code}`, projectId: 'p1', accountCode: code, amount, currency: 'USD', exchangeRate: 70 });

  const rolled = computeBudgetReport({
    projectId: 'p1', project: proj,
    budgets: [mkBudget('595008', 100), mkBudget('595018', 200)],
    expenses: [paintExpense], steelRecords: [], concreteRecords: [],
  });
  const row5950 = rolled.find(r => r.accountCode === '5950');
  check('rollup-row-exists', !!row5950);
  check('rollup-budget-sums-leaves', row5950?.budgetUSD === 300, `got=${row5950?.budgetUSD}`);
  check('rollup-actual-on-main', row5950?.committedUSD === 150, `got=${row5950?.committedUSD}`);
  check('rollup-usage', row5950?.usagePct === 50, `got=${row5950?.usagePct}`);
  check('rollup-no-leaf-rows', !rolled.some(r => r.accountCode.length === 6));

  // --- mixed main + leaf budgets add up ---
  const mixed = computeBudgetReport({
    projectId: 'p1', project: proj,
    budgets: [mkBudget('5950', 100), mkBudget('595008', 50)],
    expenses: [], steelRecords: [], concreteRecords: [],
  });
  check('mixed-main-leaf-sum', mixed.find(r => r.accountCode === '5950')?.budgetUSD === 150);

  // --- legacy 4-digit behavior unchanged ---
  const legacy = computeBudgetReport({
    projectId: 'p1', project: proj,
    budgets: [mkBudget('5100', 1000)],
    expenses: [as<Expense>({ projectId: 'p1', category: 'Steel', amount: 200, currency: 'USD', exchangeRate: 70, amountInUSD: 200, paidAmount: 200 })],
    steelRecords: [], concreteRecords: [],
  });
  const row5100 = legacy.find(r => r.accountCode === '5100');
  check('legacy-row', row5100?.budgetUSD === 1000 && row5100?.committedUSD === 200 && row5100?.usagePct === 20);

  for (const r of results) console.log((r.startsWith('PASS') ? '✅' : '❌') + ' ' + r.slice(5));
  console.log(`\n${failed === 0 ? '🎉 ALL BUDGET-SHEET CHECKS PASSED' : '💥 FAILURES PRESENT'} (${passed} passed, ${failed} failed)`);
  if (failed > 0) process.exit(1);
}

main();
