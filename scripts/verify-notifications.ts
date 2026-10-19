/**
 * Wave 12 verification: smart notification engine (pure — no browser needed).
 * Run: npm run test:notifications
 */
import {
  generateSmartReminders,
  isQuietHours,
  pruneNotifications,
} from '../src/utils/installmentUtils';
import type {
  ApartmentUnit,
  ConcreteRecord,
  Contractor,
  DocumentRecord,
  Expense,
  Payment,
  Project,
  ProjectBudget,
  SteelRecord,
  Supplier,
  SystemReminderNotification,
} from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const NOW = new Date('2026-10-15T10:00:00');
const fmt = (v: number, c = 'USD') => `${c} ${v}`;
const as = <T>(o: object): T => o as unknown as T;

const base = {
  apartments: [] as ApartmentUnit[],
  expenses: [] as Expense[],
  payments: [] as Payment[],
  contractors: [] as Contractor[],
  suppliers: [] as Supplier[],
  documents: [] as DocumentRecord[],
  projects: [] as Project[],
  existingNotifications: [] as SystemReminderNotification[],
  now: NOW,
  formatCurrency: fmt,
};

function apt(id: string, installments: object[]): ApartmentUnit {
  return as<ApartmentUnit>({ id, projectId: 'p1', unitNumber: 'A-1', installments });
}
function inst(id: string, n: number, amount: number, paid: number, dueDate: string, history: object[] = []): object {
  return { id, installmentNumber: n, amount, paidAmount: paid, dueDate, paymentHistory: history };
}

function main() {
  // --- 1. overdue installments (P1) ---
  let out = generateSmartReminders({
    ...base,
    projects: [as<Project>({ id: 'p1', name: 'Kabul Plaza', status: 'in_construction' })],
    apartments: [apt('a1', [inst('i1', 1, 10000, 0, '2026-10-01')])],
  });
  check('overdue-generated', out.length === 1 && out[0].type === 'installment_overdue', JSON.stringify(out.map(o => o.type)));
  check('overdue-priority-1', out[0]?.priority === 1);
  check('overdue-key-has-date', (out[0]?.reminderKey || '').includes('2026-10-15'));
  check('overdue-action-tab', out[0]?.actionTab === 'apartments');

  // --- 2. due-soon window (P2) ---
  out = generateSmartReminders({
    ...base,
    apartments: [apt('a1', [
      inst('i1', 1, 5000, 0, '2026-10-18'), // +3d → in
      inst('i2', 2, 5000, 0, '2026-11-20'), // +36d → out
    ])],
  });
  check('due-soon-in-window', out.filter(o => o.type === 'installment_due_soon').length === 1);
  out = generateSmartReminders({
    ...base,
    dueSoonDays: 1,
    apartments: [apt('a1', [inst('i1', 1, 5000, 0, '2026-10-18')])],
  });
  check('due-soon-window-respected', out.filter(o => o.type === 'installment_due_soon').length === 0);

  // --- 3. paid confirmations (P7) ---
  out = generateSmartReminders({
    ...base,
    apartments: [apt('a1', [
      inst('i1', 1, 5000, 5000, '2026-10-10', [{ date: '2026-10-12' }]), // recent → in
      inst('i2', 2, 5000, 5000, '2026-08-01', [{ date: '2026-09-01' }]), // old → out
    ])],
  });
  const paid = out.filter(o => o.type === 'installment_paid');
  check('paid-recent-only', paid.length === 1 && paid[0].installmentNumber === 1, JSON.stringify(paid.map(p => p.installmentNumber)));

  // --- 4. unpaid purchases (P3) ---
  out = generateSmartReminders({
    ...base,
    expenses: [
      as<Expense>({ id: 'e1', projectId: 'p1', description: 'Cement', amount: 5000, currency: 'USD', remainingAmount: 2000, date: '2026-10-10', billNumber: 'B-1' }),
      as<Expense>({ id: 'e2', projectId: 'p1', description: 'Sand', amount: 9000, currency: 'USD', remainingAmount: 9000, date: '2026-10-11', billNumber: 'B-2' }),
    ],
  });
  const unpaid = out.filter(o => o.type === 'unpaid_purchase');
  check('unpaid-top1', unpaid.length === 1 && unpaid[0].expenseId === 'e2');
  check('unpaid-overflow-count', (unpaid[0]?.message || '').includes('1'), unpaid[0]?.message);

  // --- 5. contractor + supplier debt (P4) ---
  out = generateSmartReminders({
    ...base,
    contractors: [as<Contractor>({ id: 'c1', projectId: 'p1', name: 'Ali', contractAmount: 10000, totalPaid: 4000 })],
    suppliers: [as<Supplier>({ id: 's1', projectId: 'p1', name: 'ABC Steel', remainingBalance: 3000 })],
  });
  const debts = out.filter(o => o.type === 'outstanding_debt');
  check('debt-both-parties', debts.length === 2, JSON.stringify(debts.map(d => d.actionTab)));
  check('debt-tabs', debts.some(d => d.actionTab === 'contractors') && debts.some(d => d.actionTab === 'suppliers'));

  // --- 6. missing documents (P6), USD-normalized ---
  out = generateSmartReminders({
    ...base,
    expenses: [
      as<Expense>({ id: 'e1', projectId: 'p1', description: 'Big', amount: 5000, currency: 'USD', date: '2026-10-10' }), // $5000 bare → in
      as<Expense>({ id: 'e2', projectId: 'p1', description: 'Small', amount: 20000, currency: 'AFN', exchangeRate: 70, date: '2026-10-10' }), // ~$285 → out
      as<Expense>({ id: 'e3', projectId: 'p1', description: 'Billed', amount: 8000, currency: 'USD', date: '2026-10-10', billNumber: 'B-9' }), // billed → out
    ],
    payments: [as<Payment>({ id: 'pay1', projectId: 'p1', amount: 1000, currency: 'USD', date: '2026-10-10', partyName: 'X' })], // no receipt → in
  });
  const missing = out.filter(o => o.type === 'missing_document');
  check('missing-expense-and-payment', missing.length === 2, JSON.stringify(missing.map(m => m.actionTab)));
  check('missing-threshold-currency-aware', missing.every(m => m.expenseId !== 'e2'));

  // --- 7. budget overrun (P3) ---
  const over = generateSmartReminders({
    ...base,
    projects: [as<Project>({ id: 'p1', name: 'Kabul Plaza', status: 'in_construction' })],
    projectBudgets: [as<ProjectBudget>({ id: 'b1', projectId: 'p1', accountCode: '5100', amount: 1000, currency: 'USD' })],
    steelRecords: [as<SteelRecord>({ id: 'st1', projectId: 'p1', totalAmount: 1500, currency: 'USD', date: '2026-10-10' })],
  });
  const bo = over.filter(o => o.type === 'general_financial');
  check('budget-over-generated', bo.length === 1 && bo[0].actionTab === 'budget', JSON.stringify(over.map(o => o.type)));
  const under = generateSmartReminders({
    ...base,
    projects: [as<Project>({ id: 'p1', name: 'Kabul Plaza', status: 'in_construction' })],
    projectBudgets: [as<ProjectBudget>({ id: 'b1', projectId: 'p1', accountCode: '5100', amount: 10000, currency: 'USD' })],
    steelRecords: [as<SteelRecord>({ id: 'st1', projectId: 'p1', totalAmount: 1500, currency: 'USD', date: '2026-10-10' })],
  });
  check('budget-under-silent', under.filter(o => o.type === 'general_financial').length === 0);

  // --- 8. project inactivity (P5) ---
  out = generateSmartReminders({
    ...base,
    projects: [
      as<Project>({ id: 'pa', name: 'Stale', status: 'in_construction' }),
      as<Project>({ id: 'pb', name: 'Fresh', status: 'in_construction' }),
      as<Project>({ id: 'pc', name: 'Done', status: 'completed' }),
    ],
    expenses: [
      as<Expense>({ id: 'e1', projectId: 'pa', amount: 100, currency: 'USD', date: '2026-09-01', billNumber: 'B1' }),
      as<Expense>({ id: 'e2', projectId: 'pb', amount: 100, currency: 'USD', date: '2026-10-14', billNumber: 'B2' }),
      as<Expense>({ id: 'e3', projectId: 'pc', amount: 100, currency: 'USD', date: '2026-01-01', billNumber: 'B3' }),
    ],
  });
  const stale = out.filter(o => o.type === 'project_inactivity');
  check('inactivity-stale-only', stale.length === 1 && stale[0].projectId === 'pa', JSON.stringify(stale.map(s => s.projectId)));

  // --- 9. dedupe + category filter + caps ---
  const first = generateSmartReminders({
    ...base,
    apartments: [apt('a1', [inst('i1', 1, 10000, 0, '2026-10-01')])],
  });
  const second = generateSmartReminders({
    ...base,
    apartments: [apt('a1', [inst('i1', 1, 10000, 0, '2026-10-01')])],
    existingNotifications: first,
  });
  check('dedupe-same-day', second.length === 0, `got=${second.length}`);
  const filtered = generateSmartReminders({
    ...base,
    enabledTypes: ['installment_overdue'],
    apartments: [apt('a1', [inst('i1', 1, 10000, 0, '2026-10-01')])],
    expenses: [as<Expense>({ id: 'e1', projectId: 'p1', amount: 5000, currency: 'USD', remainingAmount: 5000, date: '2026-10-10', billNumber: 'B1' })],
  });
  check('category-filter', filtered.length === 1 && filtered[0].type === 'installment_overdue');
  const many = generateSmartReminders({
    ...base,
    apartments: [apt('a1', [1, 2, 3, 4, 5, 6].map(n => inst(`i${n}`, n, 1000, 0, '2026-09-01')))],
  });
  check('overdue-cap-4', many.filter(o => o.type === 'installment_overdue').length === 4);

  // --- 10. trilingual output ---
  const fa = generateSmartReminders({
    ...base, lang: 'fa',
    apartments: [apt('a1', [inst('i1', 1, 10000, 0, '2026-10-01')])],
  });
  const ps = generateSmartReminders({
    ...base, lang: 'ps',
    apartments: [apt('a1', [inst('i1', 1, 10000, 0, '2026-10-01')])],
  });
  check('lang-en', (first[0]?.title || '').includes('Overdue'), first[0]?.title);
  check('lang-fa', (fa[0]?.title || '').includes('قسط'), fa[0]?.title);
  check('lang-ps', (ps[0]?.message || '').includes('قسط'), ps[0]?.message);

  // --- 11. quiet hours ---
  check('quiet-night', isQuietHours(new Date('2026-10-15T23:00:00'), '22:00', '07:00') === true);
  check('quiet-early-morning', isQuietHours(new Date('2026-10-15T06:59:00'), '22:00', '07:00') === true);
  check('quiet-day', isQuietHours(new Date('2026-10-15T10:00:00'), '22:00', '07:00') === false);
  check('quiet-boundary-end', isQuietHours(new Date('2026-10-15T07:00:00'), '22:00', '07:00') === false);
  check('quiet-invalid-open', isQuietHours(new Date('2026-10-15T23:00:00'), 'xx', '07:00') === false);

  // --- 12. prune ---
  const mk = (id: string, date: string, read: boolean, dismissed: boolean, priority: 1 | 7 = 7): SystemReminderNotification =>
    as<SystemReminderNotification>({ id, reminderKey: id, type: 'installment_paid', title: 't', message: 'm', date, time: '10:00', read, dismissed, priority });
  const pruned = pruneNotifications([
    mk('old-dismissed', '2026-10-01', false, true),
    mk('old-read', '2026-08-01', true, false),
    mk('fresh-read', '2026-10-12', true, false),
    mk('ancient-unread', '2026-01-01', false, false, 1),
  ], NOW, 150);
  const ids = pruned.map(p => p.id);
  check('prune-drops-old-dismissed', !ids.includes('old-dismissed'));
  check('prune-drops-old-read', !ids.includes('old-read'));
  check('prune-keeps-fresh-read', ids.includes('fresh-read'));
  check('prune-keeps-unread-forever', ids.includes('ancient-unread'));
  check('prune-unread-first', pruned[0]?.id === 'ancient-unread');
  const capped = pruneNotifications([1, 2, 3, 4, 5].map(n => mk(`u${n}`, '2026-10-15', false, false)), NOW, 3);
  check('prune-cap', capped.length === 3);

  // concrete import sanity (keeps fixtures honest)
  const _c: ConcreteRecord | null = null;
  void _c;

  for (const r of results) console.log((r.startsWith('PASS') ? '✅' : '❌') + ' ' + r.slice(5));
  console.log(`\n${failed === 0 ? '🎉 ALL NOTIFICATION CHECKS PASSED' : '💥 FAILURES PRESENT'} (${passed} passed, ${failed} failed)`);
  if (failed > 0) process.exit(1);
}

main();
