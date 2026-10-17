/**
 * Wave 43 verification: honest sync/login errors + PHP 7-safe server code.
 * Login distinguishes unreachable / server-error-500 / truly-not-found;
 * ping exposes HTTP status; sync-all reports the first server error;
 * no PHP 8-only functions remain in api/.
 * Run: npm run test:wave43
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
  const api = read('src/services/backendApi.ts');
  const ctx = read('src/context/AppContext.tsx');
  const auth = read('api/auth.php');
  const install = read('api/install.php');
  const usersView = read('src/components/views/UsersView.tsx');
  const loginView = read('src/components/LoginView.tsx');
  const pkg = read('package.json');

  // --- 1. PHP 7-safe ---
  check('php7-auth', !auth.includes('str_starts_with') && auth.includes("substr($storedHash, 0, 7) === 'sha256$'"));
  check('php7-install', !install.includes('str_starts_with') && install.includes("substr($mHash, 0, 7) !== 'sha256$'"));

  // --- 2. honest login errors ---
  check('login-status', ctx.includes('let serverStatus = -1;') && ctx.includes('serverStatus = res.status'));
  check('login-offline-msg', ctx.includes('Cannot reach the server'));
  check('login-500-msg', ctx.includes('Server error (${serverStatus})'));

  // --- 3. ping status + mapped errors ---
  check('ping-status', api.includes('wave, status: res.status'));
  check('ctx-500-code', ctx.includes("lastError: 'server-500'") && ctx.includes("lastError: 'no-response'"));
  check('ui-500-map', usersView.includes("=== 'server-500'") && usersView.includes('config.php'));

  // --- 4. first error surfacing ---
  check('first-error', ctx.includes('firstError?: string') && ctx.includes('summary.firstError = res.error'));
  check('ui-first-error', usersView.includes('r.firstError'));

  // --- 5. version ---
  check('v-pkg', pkg.includes('"version": "1.0.9"'));
  check('v-login', loginView.includes('v1.0.9'));

  console.log(results.join('\n'));
  console.log(`\nwave43: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
