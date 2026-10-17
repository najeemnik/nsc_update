/**
 * Wave 44 verification: login-page server indicator (same on every device),
 * version 1.0.9.
 * Run: npm run test:wave44
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
  const loginView = read('src/components/LoginView.tsx');
  const pkg = read('package.json');

  check('indicator-state', loginView.includes("useState<'checking' | 'ok' | 'outdated' | 'down'>"));
  check('indicator-ping', loginView.includes('backendApi.pingServer()'));
  check('indicator-ui', loginView.includes('Server connected') && loginView.includes('Server unreachable') && loginView.includes('Server outdated'));
  check('indicator-retry', loginView.includes('onClick={checkServer}'));
  check('v-pkg', pkg.includes('"version": "1.0.9"'));
  check('v-login', loginView.includes('v1.0.9'));

  console.log(results.join('\n'));
  console.log(`\nwave44: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
