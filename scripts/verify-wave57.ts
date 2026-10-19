/**
 * Wave 57 verification: owner accounts minted ONLY from the Office7 panel.
 * Run: npm run test:wave57
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
  const auth = read('api/auth.php');
  const form = read('src/components/views/UsersView.tsx');
  const office7 = read('src/components/MasterAdminModal.tsx');

  // addUser refuses owner-rank for non-masters.
  check('adduser-guard', ctx.includes("userData.role === 'admin' && !currentUser?.isMasterSuperAdmin"));
  check('adduser-msg', ctx.includes('Only Office 7 can create owner accounts'));
  // updateUser blocks rank changes involving owner accounts for non-masters.
  check('update-guard', ctx.includes("roleChanging && (safe.role === 'admin' || target?.role === 'admin')"));
  // Server enforces the same rule (defense in depth) and logs it.
  check('server-guard', auth.includes("$role === 'admin' && !$meMaster && !$isSelf"));
  check('server-log', auth.includes("'owner-create-denied'"));
  // Office7 path still mints owners; staff form still cannot.
  check('office7-kept', office7.includes("role: 'admin'") && officeFormHasOwnerCreate(office7));
  check('staff-form-clean', !/<option value="admin">/.test(form));

  console.log(results.join('\n'));
  console.log(`\nwave57: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

function officeFormHasOwnerCreate(src: string): boolean {
  return src.includes('handleCreateOwner') && src.includes('addUser({');
}

main();
