/**
 * Wave 54 verification: pull-first sync + master role guard + server-side create + v1.0.13.
 * Run: npm run test:wave54
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
  const auth = read('api/auth.php');
  const helper = read('api/make-hash.php');

  // Pull-first sync, push only server-absent.
  check('pull-names', ctx.includes('names: string[]') && ctx.includes('summary.names.push(uname)'));
  check('pull-first', ctx.indexOf('pull = await pullUsersFromServer()') < ctx.indexOf('for (const u of users)'));
  check('skip-present', ctx.includes("serverNames.has(su.username.toLowerCase())") && ctx.includes('summary.skipped += 1'));
  check('boot-auto', ctx.includes('syncAllUsersToServer().catch(() => {}); }, 2500)'));
  check('boot-no-pullonly', !ctx.includes('pullUsersFromServer().catch(() => {}); }, 2500)'));
  check('ui-skipped', usersView.includes('skipped ${r.skipped} existing') && usersView.includes('رد شد ${r.skipped} موجود'));
  // Master role guard.
  check('master-guard', auth.includes("$row['role'] = 'master'"));
  // Server-side create/repair.
  check('mk-mode', helper.includes("=== 'usercreate'"));
  check('mk-sandwich', helper.includes("'::nsc::'") && helper.includes("hash('sha256'"));
  check('mk-upsert', helper.includes('WHERE username = :cu LIMIT 1') && helper.includes('INSERT INTO users ($icols)'));
  check('mk-master-safe', helper.includes('password_hash = :h, is_locked = 0'));
  check('mk-form', helper.includes('value="usercreate"') && helper.includes('Create / repair'));
  // Version bump.
  check('version', loginView.includes('v1.0.13') && pkg.includes('"version": "1.0.13"'));

  console.log(results.join('\n'));
  console.log(`\nwave54: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
