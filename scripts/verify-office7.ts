/**
 * Wave 31 verification: Office7 config snapshots (sanitize / roundtrip / guards).
 * Run: npm run test:office7
 */
import {
  OFFICE7_THEME_OPTIONS,
  SNAPSHOT_MAX_BYTES,
  buildSnapshot,
  extractTenantConfig,
  isOffice7Theme,
  parseSnapshotFile,
  remainingDays,
  sanitizeSnapshotData,
} from '../src/utils/configSnapshots';
import type { User } from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const asUser = (o: object): User => o as unknown as User;
const throws = (fn: () => unknown): boolean => {
  try { fn(); return false; } catch { return true; }
};

function main() {
  // --- sanitize: unknown/secret keys stripped ---
  const dirty = sanitizeSnapshotData({
    customLogoUrl: 'https://x.test/logo.png',
    password: 'hunter2', otpCode: '123456', isMasterSuperAdmin: true,
    __proto__: { polluted: true }, constructor: { evil: 1 },
  } as unknown as Record<string, unknown>);
  check('secrets-stripped', !('password' in dirty) && !('otpCode' in dirty) && !('isMasterSuperAdmin' in dirty));
  check('proto-stripped', !Object.keys(dirty).includes('__proto__') && !Object.keys(dirty).includes('constructor')
    && (dirty as unknown as Record<string, unknown>).polluted === undefined
    && ({} as Record<string, unknown>).polluted === undefined);
  check('logo-kept', dirty.customLogoUrl === 'https://x.test/logo.png');

  // --- sanitize: buttons ---
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, label: `B${i}`, color: 'emerald', shape: 'pill', order: i, enabled: true }));
  const btns = sanitizeSnapshotData({ customButtonConfig: many }).customButtonConfig || [];
  check('buttons-capped-30', btns.length === 30, String(btns.length));
  const badBtns = sanitizeSnapshotData({
    customButtonConfig: [{ id: '', label: 'x' }, { id: 'ok', label: '' }, { id: 'good', label: 'G', color: 'hacker', shape: 'circle', order: 5 }],
  }).customButtonConfig || [];
  check('buttons-invalid-dropped', badBtns.length === 1 && badBtns[0].id === 'good', JSON.stringify(badBtns));
  check('buttons-defaults', badBtns[0].color === 'slate' && badBtns[0].shape === 'rounded-xl' && badBtns[0].enabled === true);

  // --- sanitize: modules / permissions ---
  const mods = sanitizeSnapshotData({ customEnabledModules: { steel: true, expenses: 'yes', evil: true } }).customEnabledModules || {};
  check('modules-whitelist', (mods as Record<string, unknown>).steel === true && !('expenses' in mods) && !('evil' in mods));
  const perms = sanitizeSnapshotData({
    permissions: {
      allowedTabs: ['dashboard', 42, 'reports', ...Array.from({ length: 50 }, (_, i) => `t${i}`)],
      canManageSales: true, canAdd: true, steel: true,
    },
  }).permissions as unknown as Record<string, unknown>;
  check('perms-tabs-capped-strings', Array.isArray(perms.allowedTabs) && perms.allowedTabs.length === 40 && perms.allowedTabs.every(t => typeof t === 'string'));
  check('perms-flags', perms.canManageSales === true && !('canAdd' in perms) && !('steel' in perms));

  // --- sanitize: grants ---
  const grants = sanitizeSnapshotData({
    projectGrants: [
      { projectId: 'p1', sections: { steel: { view: true, del: false, evil: true }, '': { view: true } } },
      { projectId: '', sections: {} },
      { projectId: 'p2', sections: ['not', 'a', 'map'] },
    ],
  }).projectGrants || [];
  const grantsMany = sanitizeSnapshotData({
    projectGrants: Array.from({ length: 60 }, (_, i) => ({ projectId: `px${i}`, sections: {} })),
  }).projectGrants || [];
  check('grants-capped', grantsMany.length === 50, String(grantsMany.length));
  check('grants-malformed-dropped', grants.length === 2 && grants[0].projectId === 'p1' && grants[1].projectId === 'p2');
  const g0 = grants[0].sections as Record<string, Record<string, boolean>>;
  check('grants-flags-whitelist', g0.steel?.view === true && g0.steel?.del === false && !('evil' in (g0.steel || {})) && !('' in g0));

  // --- sanitize: plan / dates / booleans / theme / design ---
  check('plan-valid', sanitizeSnapshotData({ subscriptionPlan: '1_year' }).subscriptionPlan === '1_year');
  check('plan-invalid', sanitizeSnapshotData({ subscriptionPlan: 'forever' }).subscriptionPlan === undefined);
  check('date-valid', sanitizeSnapshotData({ subscriptionExpiresAt: '2027-01-05' }).subscriptionExpiresAt === '2027-01-05T00:00:00.000Z');
  check('date-invalid', sanitizeSnapshotData({ subscriptionExpiresAt: 'not-a-date' }).subscriptionExpiresAt === undefined);
  check('bool-strict', sanitizeSnapshotData({ active: 'true', isLockedBySuperAdmin: 1 }).active === undefined);
  check('bool-kept', sanitizeSnapshotData({ active: false }).active === false);
  check('theme-valid', sanitizeSnapshotData({ customTheme: 'dark_gold' }).customTheme === 'dark_gold');
  check('theme-invalid', sanitizeSnapshotData({ customTheme: '../../etc' }).customTheme === undefined);
  const design = sanitizeSnapshotData({ customBillDesign: { receiptHeader: 12345, evilKey: '<script>' } }).customBillDesign;
  check('design-sanitized-no-throw', !!design && typeof design.receiptHeader === 'string' && !('evilKey' in (design as object)));
  check('non-object', JSON.stringify(sanitizeSnapshotData(null)) === '{}' && JSON.stringify(sanitizeSnapshotData([1, 2])) === '{}');

  // --- extract: only whitelisted config, never identity/secrets ---
  const user = asUser({
    id: 'u1', name: 'A', username: 'a', email: 'a@x.af', password: 'secret', phone: '0700',
    companyName: 'C', customTheme: 'navy', subscriptionPlan: '6_months', active: true,
    permissions: { allowedTabs: ['dashboard'], aiEnabled: true },
  });
  const ext = extractTenantConfig(user) as unknown as Record<string, unknown>;
  check('extract-no-secrets', !('password' in ext) && !('email' in ext) && !('phone' in ext) && !('name' in ext));
  check('extract-keeps-config', ext.customTheme === 'navy' && ext.subscriptionPlan === '6_months' && ext.active === true);

  // --- remainingDays ---
  const now = new Date('2026-10-15T12:00:00Z').getTime();
  check('remaining-future', remainingDays('2026-10-25T12:00:00Z', now) === 10);
  check('remaining-past', (remainingDays('2026-10-10T12:00:00Z', now) as number) < 0);
  check('remaining-null', remainingDays(undefined, now) === null && remainingDays('junk', now) === null);

  // --- themes ---
  check('theme-allowlist', isOffice7Theme('glassmorphism') && !isOffice7Theme('evil') && !isOffice7Theme(undefined));
  check('theme-count-unique', OFFICE7_THEME_OPTIONS.length === 13 && new Set(OFFICE7_THEME_OPTIONS).size === 13);

  // --- parseSnapshotFile ---
  const snap = buildSnapshot(user, 'master@x.af');
  const round = parseSnapshotFile(JSON.stringify(snap));
  check('parse-roundtrip', round.userId === 'u1' && round.data.customTheme === 'navy');
  check('parse-broken-json', throws(() => parseSnapshotFile('{oops')));
  check('parse-missing-user', throws(() => parseSnapshotFile(JSON.stringify({ data: {} }))));
  check('parse-oversized', throws(() => parseSnapshotFile(`{"userId":"u1","data":{},"pad":"${'x'.repeat(SNAPSHOT_MAX_BYTES * 2)}"}`)));
  const tampered = parseSnapshotFile(JSON.stringify({
    userId: 'u1', data: { customTheme: 'navy', password: 'x', customButtonConfig: many },
  }));
  const tExt = tampered.data as unknown as Record<string, unknown>;
  check('parse-tampered-sanitized', tampered.data.customTheme === 'navy' && !('password' in tExt)
    && Array.isArray(tExt.customButtonConfig) && (tExt.customButtonConfig as unknown[]).length === 30);

  // --- buildSnapshot ---
  check('build-shape', snap.userId === 'u1' && snap.id.startsWith('snap_') && snap.byteSize > 0 && !Number.isNaN(new Date(snap.createdAt).getTime()));

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
