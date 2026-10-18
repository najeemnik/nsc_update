/**
 * Wave 45 verification: PHP-only hardening — stored-hash trimming (pasted
 * whitespace) + standalone hash helper with generate/verify modes.
 * Run: npm run test:wave45
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

function main() {
  const auth = read('api/auth.php');
  const install = read('api/install.php');

  check('trim-login', auth.includes("$storedHash = trim((string)($user['password_hash'] ?? ''));"));
  check('trim-sync', auth.includes("$hash = trim((string)($p['passwordHash'] ?? ''));"));
  check('trim-install', install.includes("$mHash = trim((string)($m['passwordHash'] ?? ''));"));
  check('helper-exists', exists('api/make-hash.php'));
  const helper = read('api/make-hash.php');
  check('helper-gen', helper.includes('::nsc::') && helper.includes('PASSWORD_BCRYPT'));
  check('helper-verify', helper.includes("mode'] ?? ''") && helper.includes('MISMATCH') && helper.includes('MATCH'));
  check('helper-php7', !helper.includes('str_starts_with') && helper.includes("substr($stored, 0, 7)"));
  check('helper-alone', helper.includes("mode === 'dbtest'") && !helper.includes('INSERT INTO') && !helper.includes('UPDATE users'));

  console.log(results.join('\n'));
  console.log(`\nwave45: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
