/**
 * Wave 19+20 verification: permission model, evaluator, presets, CSV, approval exclusion.
 * Run: npm run test:permissions
 */
import {
  canDo,
  evaluateGrant,
  grantedProjectIds,
  presetGrants,
  fullGrant,
  emptyGrant,
} from '../src/utils/permissions';
import { rowsToCsv } from '../src/utils/csvExport';
import { computeBudgetActuals } from '../src/utils/budgetUtils';
import { buildJournal } from '../src/utils/journalEngine';
import type { Expense, ProjectGrant, User } from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const NOW = new Date('2026-10-15T12:00:00Z').getTime();
const FUTURE = new Date('2027-01-01T00:00:00Z').toISOString();
const PAST = new Date('2026-01-01T00:00:00Z').toISOString();

const mkUser = (over: Partial<User> = {}): User => ({
  id: 'u1',
  username: 'tariq',
  email: 't@t.com',
  name: 'Tariq',
  role: 'accountant',
  companyAddress: 'Kabul',
  active: true,
  createdAt: '2026-01-01',
  ...over,
});

const mkGrant = (projectId: string, sections: ProjectGrant['sections'] = {}): ProjectGrant => ({
  projectId,
  sections,
});

function main() {
  // ---------- evaluateGrant ----------
  check('eval-empty-undefined', evaluateGrant(undefined, 'p1', 'expenses', 'view') === false);
  check('eval-empty-array', evaluateGrant([], 'p1', 'expenses', 'view') === false);
  const wild = [mkGrant('*', { expenses: { ...emptyGrant(), view: true } })];
  check('eval-wild-view', evaluateGrant(wild, 'p1', 'expenses', 'view') === true);
  check('eval-wild-future-project', evaluateGrant(wild, 'p99', 'expenses', 'view') === true);
  check('eval-wild-other-section', evaluateGrant(wild, 'p1', 'payments', 'view') === false);
  const scoped = [mkGrant('p1', { expenses: { ...emptyGrant(), view: true, create: true } })];
  check('eval-scope-own', evaluateGrant(scoped, 'p1', 'expenses', 'view') === true);
  check('eval-scope-other', evaluateGrant(scoped, 'p2', 'expenses', 'view') === false);
  check('eval-create-needs-view', evaluateGrant(
    [mkGrant('p1', { expenses: { ...emptyGrant(), create: true } })], 'p1', 'expenses', 'create') === false);
  check('eval-create-with-view', evaluateGrant(scoped, 'p1', 'expenses', 'create') === true);
  check('eval-company-via-project-grant', evaluateGrant(
    [mkGrant('p1', { users: { ...emptyGrant(), view: true } })], 'p2', 'users', 'view') === true);
  check('eval-company-denied', evaluateGrant(scoped, 'p1', 'users', 'view') === false);
  check('eval-union-entries', evaluateGrant(
    [mkGrant('p1', { expenses: { ...emptyGrant(), view: true } }),
     mkGrant('*', { expenses: { ...emptyGrant(), view: true, del: true } })],
    'p1', 'expenses', 'del') === true);
  check('eval-approve-flag', evaluateGrant(
    [mkGrant('*', { expenses: { ...fullGrant() } })], 'p1', 'expenses', 'approve') === true);

  // ---------- grantedProjectIds ----------
  check('gpid-undefined', grantedProjectIds(undefined, ['a', 'b']).join(',') === 'a,b');
  check('gpid-empty', grantedProjectIds([], ['a', 'b']).join(',') === 'a,b');
  check('gpid-wild', grantedProjectIds([{ projectId: '*', sections: {} }], ['a', 'b']).join(',') === 'a,b');
  check('gpid-subset', grantedProjectIds([{ projectId: 'b', sections: {} }], ['a', 'b']).join(',') === 'b');

  // ---------- canDo ----------
  check('can-null', canDo(null, 'p1', 'expenses', 'view', NOW) === false);
  check('can-master', canDo(mkUser({ isMasterSuperAdmin: true, role: 'viewer' }), 'p1', 'users', 'del', NOW) === true);
  check('can-admin', canDo(mkUser({ role: 'admin' }), 'p1', 'users', 'del', NOW) === true);
  check('can-inactive', canDo(mkUser({ active: false }), 'p1', 'dashboard', 'view', NOW) === false);
  check('can-locked', canDo(mkUser({ isLockedBySuperAdmin: true }), 'p1', 'dashboard', 'view', NOW) === false);
  check('can-expired', canDo(mkUser({ accessExpiresAt: PAST }), 'p1', 'dashboard', 'view', NOW) === false);
  check('can-future-expiry', canDo(mkUser({ accessExpiresAt: FUTURE }), 'p1', 'dashboard', 'view', NOW) === true);
  check('can-bad-date-passthrough', canDo(mkUser({ accessExpiresAt: 'not-a-date' }), 'p1', 'dashboard', 'view', NOW) === true);

  // legacy accountant (pre-Wave-19 rule set preserved)
  const legacyAcc = mkUser({ role: 'accountant' });
  check('legacy-acc-view', canDo(legacyAcc, 'p1', 'dashboard', 'view', NOW) === true);
  check('legacy-acc-users-denied', canDo(legacyAcc, 'p1', 'users', 'view', NOW) === false);
  check('legacy-acc-create', canDo(legacyAcc, 'p1', 'expenses', 'create', NOW) === true);
  check('legacy-acc-approve-denied', canDo(legacyAcc, 'p1', 'expenses', 'approve', NOW) === false);
  // legacy viewer
  const legacyViewer = mkUser({ role: 'viewer' });
  check('legacy-viewer-apartments', canDo(legacyViewer, 'p1', 'apartments', 'view', NOW) === true);
  check('legacy-viewer-expenses-denied', canDo(legacyViewer, 'p1', 'expenses', 'view', NOW) === false);
  check('legacy-viewer-create-denied', canDo(legacyViewer, 'p1', 'dashboard', 'create', NOW) === false);
  // legacy allowedTabs + module kill-switch
  check('legacy-allowed-tabs', canDo(
    mkUser({ role: 'viewer', permissions: { allowedTabs: ['expenses'] } }), 'p1', 'expenses', 'view', NOW) === true);
  check('legacy-module-off', canDo(
    mkUser({ role: 'accountant', customEnabledModules: { expenses: false } }), 'p1', 'expenses', 'view', NOW) === false);
  // explicit grants take precedence over legacy
  check('grants-beat-legacy', canDo(
    mkUser({ role: 'viewer', projectGrants: [mkGrant('p1', { expenses: { ...emptyGrant(), view: true } })] }),
    'p1', 'expenses', 'view', NOW) === true);
  check('grants-restrict-scope', canDo(
    mkUser({ role: 'accountant', projectGrants: [mkGrant('p1', { expenses: { ...fullGrant() } })] }),
    'p2', 'expenses', 'view', NOW) === false);

  // ---------- presets ----------
  const full = presetGrants('full', ['*'])[0];
  check('preset-full-company', full.sections.users?.del === true && full.sections.expenses?.approve === true);
  const entry = presetGrants('entry', ['p1'])[0];
  check('preset-entry-data', entry.sections.expenses?.create === true && entry.sections.expenses?.del === false);
  check('preset-entry-no-company', entry.sections.users === undefined && entry.sections.settings === undefined);
  const view = presetGrants('view', ['p1'])[0];
  check('preset-view-only', view.sections.expenses?.view === true && view.sections.expenses?.create === false);

  // ---------- CSV ----------
  check('csv-escape', rowsToCsv(['a'], [['x"y,z\nw']]) === 'a\r\n"x""y,z\nw"');
  check('csv-shape', rowsToCsv(['H1', 'H2'], [[1, 'b'], [2, null]]) === 'H1,H2\r\n1,b\r\n2,');

  // ---------- approval exclusion from engines ----------
  const mkExp = (id: string, approvalStatus?: Expense['approvalStatus']): Expense => ({
    id, projectId: 'p1', date: '2026-10-01', title: 't', category: 'Materials',
    amount: 100, currency: 'USD', amountInUSD: 100, totalAmountUSD: 100,
    createdAt: '2026-10-01', approvalStatus,
  } as Expense);
  const actuals = computeBudgetActuals({
    projectId: 'p1', budgets: [],
    expenses: [mkExp('ok'), mkExp('rej', 'rejected')],
    steelRecords: [], concreteRecords: [],
  });
  let committed = 0;
  actuals.forEach(a => { committed += a.committedUSD; });
  check('actuals-exclude-rejected', committed === 100, `committed=${committed}`);
  const journal = buildJournal({
    projects: [], steelRecords: [], concreteRecords: [], payments: [],
    apartments: [], projectInvestments: [],
    expenses: [mkExp('ok'), mkExp('rej', 'rejected')],
  });
  const touchedPurchase = journal.filter(e =>
    JSON.stringify(e).includes('rej'));
  check('journal-excludes-rejected', touchedPurchase.length === 0, `hits=${touchedPurchase.length}`);
  check('journal-keeps-booked', journal.length > 0);

  // ---------- summary ----------
  for (const r of results) console.log(r);
  console.log(`\npermissions: ${passed} passed, ${failed} failed (${passed + failed} checks)`);
  if (failed > 0) process.exit(1);
}

main();
