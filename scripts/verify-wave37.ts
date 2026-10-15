/**
 * Wave 37 verification: go-live — zero-seed production, first-run master
 * setup, Office7 username change + factory reset, Quick Test hidden in prod.
 * Run: npm run test:wave37
 */
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const root = process.cwd();
const read = (p: string): string => fs.readFileSync(path.join(root, p), 'utf-8');
const exists = (p: string): boolean => fs.existsSync(path.join(root, p));
const count = (s: string, sub: string): number => s.split(sub).length - 1;

function main() {
  const ctx = read('src/context/AppContext.tsx');
  const login = read('src/components/LoginView.tsx');
  const settings = read('src/components/views/SettingsView.tsx');
  const office7 = read('src/components/MasterAdminModal.tsx');
  const app = read('src/App.tsx');

  // --- 1. zero-seed production ---
  check('seed-flag', ctx.includes('const EMPTY_SEED = import.meta.env.PROD === true;'));
  check('seed-users-empty', ctx.includes("loadFromStorage('users', TEST_MODE ? [TEST_USER] : (EMPTY_SEED ? [] : initialUsers))"));
  check('seed-arrays-empty', count(ctx, 'EMPTY_SEED ? [] : initial') === 16);
  check('seed-currentproj-empty', ctx.includes("EMPTY_SEED ? '' : (initialProjects[0]?.id || '')"));
  check('seed-test-intact', ctx.includes('TEST_MODE ? [TEST_USER]') && ctx.includes('TEST_MODE ? [TEST_PROJECT]'));

  // --- 2. first-run master setup ---
  check('bootstrap-decl', ctx.includes('bootstrapMasterAdmin: (data:'));
  check('bootstrap-refuses-nonempty', ctx.includes('users.length > 0') && ctx.includes('already initialized'));
  check('bootstrap-refuses-test', ctx.includes('Not available in test version'));
  check('bootstrap-hashes', ctx.includes('password: hashPassword(pw, cleanUsername)'));
  check('bootstrap-master', ctx.includes('isMasterSuperAdmin: true,') && ctx.includes("subscriptionPlan: 'lifetime'"));
  check('setup-view', exists('src/components/FirstRunSetupView.tsx') && read('src/components/FirstRunSetupView.tsx').includes('bootstrapMasterAdmin({ name, username, email, password, companyName })'));
  check('app-gate', app.includes('!isTestMode && users.length === 0') && app.includes('<FirstRunSetupView />'));

  // --- 3. Office7: master username change ---
  check('uname-fn', ctx.includes('const changeOwnUsername =') && ctx.includes('Username changed'));
  check('uname-unique', ctx.includes('already taken / این نام کاربری'));
  check('uname-ui', office7.includes('handleSelfUsername') && office7.includes('Change my username'));

  // --- 4. Office7: factory reset ---
  check('factory-fn', ctx.includes('const factoryReset =') && ctx.includes("denyAccess('factory_reset', 'del')"));
  check('factory-backup-first', ctx.indexOf('exportJsonBackup(); } catch') < ctx.indexOf('setUsers([]);\n    setProjects([]);'));
  check('factory-spares-test', ctx.includes("!k.startsWith(TEST_PREFIX)"));
  check('factory-logout', ctx.includes('setCurrentUser(null);\n    return { success: true };'));
  check('factory-ui', office7.includes('handleFactoryReset') && office7.includes('wipe everything'));

  // --- 5. Quick Test hidden in production ---
  check('login-test-gated', count(login, "VITE_SHOW_DEMO_LOGINS !== 'false'") === 2);
  check('settings-test-gated', settings.includes("VITE_SHOW_DEMO_LOGINS !== 'false'") && settings.includes('exitTestMode'));
  check('env-production', exists('.env.production') && read('.env.production').includes('VITE_SHOW_DEMO_LOGINS=false'));
  check('env-versioned', read('.gitignore').includes('!.env.production'));

  // --- 6. deploy guide ---
  check('guide-golive', read('SHAHHOST_DEPLOYMENT_GUIDE.md').includes('Go-Live') && read('SHAHHOST_DEPLOYMENT_GUIDE.md').includes('password_hash'));

  for (const r of results) console.log(r);
  console.log(`\nwave37: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
