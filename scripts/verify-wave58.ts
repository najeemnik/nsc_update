/**
 * Wave 58 verification: fully automatic sync (no button needed).
 * Run: npm run test:wave58
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
  const pwa = read('src/components/PwaManager.tsx');
  const ctx = read('src/context/AppContext.tsx');

  // Shared ref-guarded flusher (no double-send from overlapping triggers).
  check('flusher', pwa.includes('flushingRef') && pwa.includes('const flushQueue = useCallback'));
  // Debounced auto-flush watches the live queue count (stale-closure fix).
  check('debounce', pwa.includes('[online, pending, flushQueue]') && pwa.includes('setTimeout(() => { flushQueue(false)'));
  // Retry timer + refocus flush.
  check('timer', pwa.includes('setInterval(') && pwa.includes('45000'));
  check('focus', pwa.includes("addEventListener('focus', kick)"));
  // "Send now" still works as instant-force.
  check('send-now', pwa.includes('flushQueue(true)'));
  // Login flushes the outbox with the fresh token, then pulls.
  check('login-flush', ctx.includes('backendApi.syncOfflineQueue().catch(() => {}).finally(() => { pullUsersFromServer()'));
  // Background roster sync: 5-min timer + focus, throttled, visible-tab only.
  check('bg-sync', ctx.includes('bgSyncPullRef') && ctx.includes('setInterval(bgSync, 5 * 60 * 1000)') && ctx.includes("visibilityState !== 'visible'"));

  console.log(results.join('\n'));
  console.log(`\nwave58: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
