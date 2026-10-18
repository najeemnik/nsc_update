/**
 * Wave 51 verification: staff accounts hash + push + heal (every login works everywhere).
 * Run: npm run test:wave51
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
  const loginView = read('src/components/LoginView.tsx');
  const pkg = read('package.json');

  // Staff creation: normalized + hashed + pushed.
  check('emp-lower', ctx.includes('const cleanEmpUsername = employee.username.trim().toLowerCase()'));
  check('emp-hash', ctx.includes('password: hashPassword(employee.password.trim(), cleanEmpUsername)'));
  check('emp-salt', ctx.includes('hashSalt: cleanEmpUsername'));
  check('emp-push', ctx.includes('pushUserToServer(newEmp)'));
  check('emp-no-plain', !ctx.includes('password: employee.password,'));
  // Login upgrade pushes the healed hash.
  check('login-push-heal', ctx.includes('pushUserToServer(reanchored)'));
  // Sync-all heals plaintext instead of skipping.
  check('sync-heal', ctx.includes('healedLocals.push(su)') && ctx.includes("hashPassword((u.password as string).trim(), u.username)"));
  check('sync-heal-persist', ctx.includes('healedLocals.find(h => h.id === u.id) ?? u'));
  check('sync-uses-su', ctx.includes('serializeUserSync(su)') || ctx.includes('serializeUserForSync(su)'));
  // Version bump.
  check('version', loginView.includes('v1.0.11') && pkg.includes('"version": "1.0.11"'));

  console.log(results.join('\n'));
  console.log(`\nwave51: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
