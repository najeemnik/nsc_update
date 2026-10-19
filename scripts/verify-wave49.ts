/**
 * Wave 49 verification: no reused named PDO placeholder (HY093 root-cause fix).
 * Run: npm run test:wave49
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
  const helper = read('api/make-hash.php');

  check('login-u1u2', auth.includes('username = :u1 OR email = :u2'));
  check('login-bind', auth.includes("'u1' => $username, 'u2' => $username"));
  check('sim-u1u2', helper.includes('username = :u1 OR email = :u2'));
  check('sim-bind', helper.includes("'u1' => $inUser, 'u2' => $inUser"));
  check('no-reuse-left', !auth.includes('= :u OR') && !helper.includes('= :u OR'));

  // Repo-wide regression net: no line reuses the same :named placeholder twice.
  const apiDir = path.join(root, 'api');
  const bad: string[] = [];
  for (const f of fs.readdirSync(apiDir)) {
    if (!f.endsWith('.php')) continue;
    const lines = read(`api/${f}`).split('\n');
    lines.forEach((ln, i) => {
      const m = ln.match(/:([a-z_][a-z0-9_]*)\b.*:\1\b/);
      if (m && !ln.trim().startsWith('//') && !ln.trim().startsWith('*') && !ln.trim().startsWith('#')) {
        bad.push(`${f}:${i + 1} (:${m[1]})`);
      }
    });
  }
  check('api-wide-noreuse', bad.length === 0, bad.join(', '));

  console.log(results.join('\n'));
  console.log(`\nwave49: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
