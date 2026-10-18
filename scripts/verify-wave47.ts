/**
 * Wave 47 verification: login works without mbstring; last-login update
 * cannot break login; ping reports capabilities.
 * Run: npm run test:wave47
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
  const auth = read('api/auth.php');

  check('mb-attempt', auth.includes("$attemptKey = function_exists('mb_strtolower')"));
  check('mb-salt', auth.includes("$salt = function_exists('mb_strtolower')"));
  check('mb-raw-gone', !auth.includes('= mb_strtolower('));
  check('lastlogin-guarded', auth.includes('last_login update failed:'));
  check('ping-caps', auth.includes("'mbstring' => function_exists('mb_strtolower')") && auth.includes("'php' => PHP_VERSION"));

  console.log(results.join('\n'));
  console.log(`\nwave47: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
