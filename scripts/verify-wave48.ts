/**
 * Wave 48 verification: make-hash.php login simulator (read-only).
 * Run: npm run test:wave48
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

  check('sim-mode', helper.includes("=== 'logintest'"));
  check('sim-lookup', helper.includes('username = :u OR email = :u'));
  check('sim-bcrypt', helper.includes('password_verify($inPass, $stored)'));
  check('sim-sha', helper.includes("'::nsc::' . $inPass"));
  check('sim-locked', helper.includes('is_locked') && helper.includes('403'));
  check('sim-verdict', helper.includes('LOGIN WOULD SUCCEED') && helper.includes('WRONG PASSWORD'));
  check('sim-readonly', !helper.includes('INSERT INTO') && !helper.includes('UPDATE users') && !helper.includes('DELETE FROM'));

  console.log(results.join('\n'));
  console.log(`\nwave48: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
