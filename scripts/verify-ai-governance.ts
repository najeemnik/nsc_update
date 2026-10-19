/**
 * Wave 34 verification: AI governance (access matrix / quotas / scope).
 * Run: npm run test:aigov
 */
import {
  DEFAULT_AI_GLOBAL,
  authorizedProjects,
  checkAiAccess,
  countUsage,
  countUsageDayAll,
  dayKeyOf,
  effectiveAiProject,
  effectiveLimits,
  monthKeyOf,
  sanitizeGlobal,
  sanitizeLimit,
  sanitizeUserLimits,
  sanitizeVisibility,
  type AiGlobalPolicy,
  type AiUsageEvent,
} from '../src/utils/aiGovernance';
import type { Project, User } from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const asUser = (o: object): User => o as unknown as User;
const asProj = (o: object): Project => o as unknown as Project;

const master = asUser({ id: 'm', role: 'admin', isMasterSuperAdmin: true, companyName: 'HQ' });
const ownerA = asUser({ id: 'oA', role: 'admin', companyName: 'CoA' });
const ownerNoCo = asUser({ id: 'oX', role: 'admin' });
const empGrant = asUser({
  id: 'eG', role: 'employee', companyName: 'CoA',
  projectGrants: [{ projectId: 'p1', sections: {} }],
});
const empPlain = asUser({ id: 'eP', role: 'employee', companyName: 'CoA' });
const empOff = asUser({ id: 'eO', role: 'employee', companyName: 'CoA', permissions: { aiEnabled: false } });

const projs = [
  asProj({ id: 'p1', companyName: 'CoA' }),
  asProj({ id: 'p2', companyName: 'CoB' }),
  asProj({ id: 'p3' }), // legacy, unowned
  asProj({ id: 'p4', userId: 'oA' }),
];

function main() {
  const G: AiGlobalPolicy = { ...DEFAULT_AI_GLOBAL };
  const log: AiUsageEvent[] = [];
  const day = '2026-10-15';
  const month = '2026-10';
  for (let i = 0; i < 3; i += 1) log.push({ userId: 'eP', at: 1, day, month });
  log.push({ userId: 'eP', at: 1, day: '2026-10-14', month });
  log.push({ userId: 'eP', at: 1, day: '2026-09-01', month: '2026-09' });

  // --- counting ---
  const c = countUsage(log, 'eP', day, month);
  check('count-day-month-total', c.today === 3 && c.month === 4 && c.total === 5, JSON.stringify(c));
  check('count-other-user', countUsage(log, 'nobody', day, month).total === 0);
  check('count-day-all', countUsageDayAll(log, day) === 3);
  check('daykey-format', /^\d{4}-\d{2}-\d{2}$/.test(dayKeyOf()) && /^\d{4}-\d{2}$/.test(monthKeyOf()));

  // --- sanitize ---
  check('limit-clamp', sanitizeLimit(50) === 50 && sanitizeLimit(-5) === 0 && sanitizeLimit(999999) === 100000
    && sanitizeLimit(3.9) === 3 && sanitizeLimit('x') === 0 && sanitizeLimit(NaN) === 0);
  check('visibility', sanitizeVisibility('owners_only') === 'owners_only' && sanitizeVisibility('evil') === 'everyone');
  const sg = sanitizeGlobal({ enabled: false, dailyMax: -10 });
  check('global-defaults', sg.enabled === false && sg.visibility === 'everyone' && sg.dailyMax === 0 && sg.monthlyMax === 500);
  check('global-junk', sanitizeGlobal(null).enabled === true && sanitizeGlobal('x').dailyMax === 50);
  check('user-limits', JSON.stringify(sanitizeUserLimits({ dailyMax: 7, monthlyMax: -2, evil: 1 })) === '{"dailyMax":7,"monthlyMax":0}');
  check('effective', effectiveLimits(G, { dailyMax: 5 }).dailyMax === 5 && effectiveLimits(G, { dailyMax: 5 }).monthlyMax === 500
    && effectiveLimits(G, {}).dailyMax === 50);

  // --- access matrix ---
  check('null-user', checkAiAccess(null, G, undefined, log, day, month).reason === 'user_off');
  check('global-off', checkAiAccess(ownerA, { ...G, enabled: false }, undefined, log, day, month).reason === 'global_off');
  check('master-vs-global-off', checkAiAccess(master, { ...G, enabled: false }, undefined, log, day, month).allowed === false);
  check('visibility-owners', checkAiAccess(empPlain, { ...G, visibility: 'owners_only' }, undefined, log, day, month).reason === 'visibility');
  check('visibility-owner-ok', checkAiAccess(ownerA, { ...G, visibility: 'owners_only' }, undefined, log, day, month).allowed === true);
  check('visibility-master', checkAiAccess(ownerA, { ...G, visibility: 'master_only' }, undefined, log, day, month).reason === 'visibility'
    && checkAiAccess(master, { ...G, visibility: 'master_only' }, undefined, log, day, month).allowed === true);
  check('user-off', checkAiAccess(empOff, G, undefined, log, day, month).reason === 'user_off');
  check('master-unlimited', checkAiAccess(master, G, undefined,
    Array.from({ length: 600 }, () => ({ userId: 'm', at: 1, day, month })), day, month).allowed === true);
  check('daily-limit', checkAiAccess(empPlain, { ...G, dailyMax: 3 }, undefined, log, day, month).reason === 'daily_limit');
  check('daily-under', checkAiAccess(empPlain, { ...G, dailyMax: 4 }, undefined, log, day, month).allowed === true);
  check('monthly-limit', checkAiAccess(empPlain, { ...G, monthlyMax: 4 }, undefined, log, day, month).reason === 'monthly_limit');
  check('override-wins', checkAiAccess(empPlain, { ...G, dailyMax: 3 }, { dailyMax: 10 }, log, day, month).allowed === true);
  check('override-zero-unlimited', checkAiAccess(empPlain, { ...G, dailyMax: 1, monthlyMax: 1 }, { dailyMax: 0, monthlyMax: 0 }, log, day, month).allowed === true);
  check('base-counters', (() => {
    const r = checkAiAccess(empPlain, G, undefined, log, day, month);
    return r.usedToday === 3 && r.usedMonth === 4 && r.dailyMax === 50 && r.monthlyMax === 500;
  })());

  // --- authorized scope (req 9) ---
  check('scope-master', authorizedProjects(master, projs).length === 4);
  check('scope-null', authorizedProjects(null, projs).length === 0);
  check('scope-owner', authorizedProjects(ownerA, projs).map(p => p.id).join(',') === 'p1,p3,p4');
  check('scope-owner-noco', authorizedProjects(ownerNoCo, projs).length === 4);
  check('scope-grants', authorizedProjects(empGrant, projs).map(p => p.id).join(',') === 'p1');
  check('scope-employee-plain', authorizedProjects(empPlain, projs).map(p => p.id).join(',') === 'p1,p3');
  check('scope-no-foreign', !authorizedProjects(empPlain, projs).some(p => p.id === 'p2'));
  check('effective-prefers-current', effectiveAiProject(ownerA, projs, 'p4')?.id === 'p4');
  check('effective-fallback', effectiveAiProject(empGrant, projs, 'p2')?.id === 'p1');
  check('effective-none', effectiveAiProject(asUser({ id: 'e0', role: 'employee', projectGrants: [{ projectId: 'zzz', sections: {} }] }), projs, 'p1') === null);

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
