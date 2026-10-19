/**
 * Wave 55 verification: single identity per username (dedupe + trim-safe matching) + v1.0.16.
 * Run: npm run test:wave55
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
  const usersView = read('src/components/views/UsersView.tsx');
  const modal = read('src/components/MasterAdminModal.tsx');
  const loginView = read('src/components/LoginView.tsx');
  const pkg = read('package.json');

  // Dedupe pre-pass in pull.
  check('dedupe-pass', ctx.includes('summary.deduped') && ctx.includes('seen.has(k)'));
  check('dedupe-keeper', ctx.includes('if (!next[keeperIx].password && next[i].password)'));
  check('dedupe-surfaced', ctx.includes('summary.deduped = pull.deduped ?? 0'));
  check('ui-deduped', usersView.includes('cleaned ${r.deduped} dups') && usersView.includes('پاک شد ${r.deduped} تکراری'));
  // Trim-safe matching everywhere (no raw .username/.email toLowerCase on records).
  const rawUserField = /(?<!\|\| ''\)\.)\b(u|su|found|fresh|user|target0?|duplicate|x|row|t)\.(username|email)\.toLowerCase\(\)/;
  check('no-raw-ctx', !rawUserField.test(ctx));
  check('modal-guarded', modal.includes("(u.email || '').trim().toLowerCase()") && modal.includes("(u.name || '').trim().toLowerCase()"));
  // Version bump.
  check('version', loginView.includes('v1.0.16') && pkg.includes('"version": "1.0.16"'));

  console.log(results.join('\n'));
  console.log(`\nwave55: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
