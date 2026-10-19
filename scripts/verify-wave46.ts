/**
 * Wave 46 verification: make-hash.php database self-test (read-only).
 * Run: npm run test:wave46
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
  const helper = read('api/make-hash.php');

  check('dbtest-mode', helper.includes("=== 'dbtest'"));
  check('dbtest-config', helper.includes("require_once __DIR__ . '/config.php'"));
  check('dbtest-users', helper.includes('SELECT COUNT(*) AS c FROM users'));
  check('dbtest-seeds', helper.includes('LEFT(password_hash, 7) AS alg') && helper.includes("IN ('office7','admin')"));
  check('dbtest-attempts', helper.includes('FROM login_attempts WHERE'));
  check('dbtest-phpver', helper.includes('PHP_VERSION'));
  const helperPreCreate = helper.split("=== 'usercreate'")[0]; // wave54: only the explicit create mode writes
  check('dbtest-readonly', !helperPreCreate.includes('INSERT INTO') && !helperPreCreate.includes('UPDATE users') && !helperPreCreate.includes('DELETE FROM'));

  console.log(results.join('\n'));
  console.log(`\nwave46: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
