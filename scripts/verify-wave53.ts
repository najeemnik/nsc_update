/**
 * Wave 53 verification: make-hash.php server roster (zero-typing truth table).
 * Run: npm run test:wave53
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

  check('roster-mode', helper.includes("=== 'roster'"));
  check('roster-cols', helper.includes('is_locked, is_master, password_hash, created_at') && helper.includes('ORDER BY created_at ASC'));
  check('roster-labels', helper.includes('LOCKED') && helper.includes('sha256$…') && helper.includes('bcrypt…') && helper.includes('EMPTY!'));
  check('roster-no-leak', !helper.includes("htmlspecialchars($r['password_hash'])") && !helper.includes('. $h .'));
  check('roster-form', helper.includes('value="roster"') && helper.includes('Show roster'));
  check('roster-count', helper.includes('Users on this server:'));

  console.log(results.join('\n'));
  console.log(`\nwave53: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
