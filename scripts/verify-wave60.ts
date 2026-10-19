/**
 * Wave 60 verification: push receipts + auto-retry + visible badges.
 * Run: npm run test:wave60
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
  const uv = read('src/components/views/UsersView.tsx');
  const mm = read('src/components/MasterAdminModal.tsx');

  // Receipt state: persisted, exposed, all three outcomes recorded.
  check('receipt-state', ctx.includes("loadFromStorage('syncReceipts'") && ctx.includes('syncReceipts,') && ctx.includes('retryUserPush,'));
  check('receipt-marks', ctx.includes("markReceipt('synced')") && ctx.includes("markReceipt('pending')") && ctx.includes("markReceipt('failed'"));
  // Auto-retry with cooldown, wired into the background sync.
  check('retry-fn', ctx.includes('const retryFailedPushes') && ctx.includes('2 * 60 * 1000'));
  check('retry-wired', ctx.includes('bgSyncRetryRef.current()'));
  // Pull heals receipts for server-held rows.
  check('pull-heal', ctx.includes("nextR[u.id] = { status: 'synced'"));
  // Honest badges: only a real synced receipt shows green.
  check('badge-uv', uv.includes("if (r && r.status === 'synced')") && uv.includes('Not sent — tap to retry'));
  check('badge-mm', mm.includes('server-delivery receipt (tap = retry now)'));

  console.log(results.join('\n'));
  console.log(`\nwave60: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
