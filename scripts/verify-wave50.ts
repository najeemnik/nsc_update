/**
 * Wave 50 verification: roster pull (two-way sync) + tenants reshape + v1.0.14.
 * Run: npm run test:wave50
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

function main() {
  const ctx = read('src/context/AppContext.tsx');
  const usersView = read('src/components/views/UsersView.tsx');
  const loginView = read('src/components/LoginView.tsx');
  const pkg = read('package.json');
  const tenants = read('api/office7.php');

  // Pull exists, guarded, and wired.
  check('pull-fn', ctx.includes('const pullUsersFromServer = async'));
  check('pull-calls-tenants', ctx.includes('backendApi.getOffice7Tenants()'));
  check('pull-testmode', ctx.includes('if (TEST_MODE) return summary;'));
  check('pull-no-token', ctx.includes("if (!backendApi.getToken()) { summary.error = 'no-token'"));
  check('pull-keeps-local-creds', ctx.includes('password: keep.password') && ctx.includes('hashSalt: keep.hashSalt || merged.hashSalt'));
  check('pull-new-no-password', ctx.includes("serverUserToLocal(su, '', undefined)"));
  check('pull-lock-flags', ctx.includes('isLockedBySuperAdmin: su.isLocked === true'));
  check('pull-exposed', ctx.includes('pullUsersFromServer: () => Promise<') && ctx.includes('pullUsersFromServer,'));
  // Two-way sync-all + auto triggers.
  check('sync-two-way', ctx.includes('pull = await pullUsersFromServer()') && ctx.includes('pulledNew')); // wave54: pull-first assignment
  check('auto-login-pull', ctx.includes('pullUsersFromServer().catch(() => {});'));
  check('auto-boot-pull', ctx.includes('didBootPullRef') && ctx.includes('2500'));
  // Anti-brick guard.
  check('push-guard', ctx.includes('if (!u.password || !(u.password as string).trim()) return;'));
  // UI message shows received counts (3 languages).
  check('ui-received', usersView.includes('received ${r.pulledNew} new') && usersView.includes('دریافت ${r.pulledNew} جدید') && usersView.includes('ترلاسه شول ${r.pulledNew} نوي'));
  // Version bump.
  check('version', loginView.includes('v1.0.14') && pkg.includes('"version": "1.0.14"'));
  // Backend tenants: login shape, no hashes, scoped for non-masters.
  check('ten-camel', tenants.includes("'companyName' =>") && tenants.includes("'isMasterSuperAdmin' =>") && tenants.includes("'appProfile' =>"));
  check('ten-locked', tenants.includes("'isLocked' =>"));
  check('ten-no-hash', !tenants.includes('password_hash,') && !tenants.includes("'password_hash' =>"));
  check('ten-scope', tenants.includes('owner_admin_id = :me2'));

  console.log(results.join('\n'));
  console.log(`\nwave50: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
