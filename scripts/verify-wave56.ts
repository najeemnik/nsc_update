/**
 * Wave 56 verification: sync/auth rejection logging + roster activity viewer.
 * Run: npm run test:wave56
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
  const db = read('api/db.php');
  const helper = read('api/make-hash.php');

  // Rejection logger exists, never throws, routes auth vs sync.
  check('log-fn', db.includes('function logSyncReject(PDO $db, array $me, string $username, string $reason): void'));
  check('log-safe', db.includes("} catch (Throwable $e) { /* never break the API response */ }"));
  check('log-routes', db.includes("? 'auth' : 'user_sync'") && db.includes("'auth_rejected'") && db.includes("'sync_rejected'"));
  // authenticateUser logs Bearer-carrying rejections.
  check('auth-logs', db.includes("'auth:invalid-or-expired-token'") && db.includes("'auth:user-missing-or-locked'") && db.includes("'auth:token-version-mismatch'") && db.includes("'auth:master-required'"));
  // All 7 sync_user rejections logged.
  const reasons = ['invalid-username', 'invalid-hash', 'master-touch-denied', 'master-create-denied', 'privilege-denied', 'owner-mismatch', 'email-conflict'];
  check('sync-logs7', reasons.every(r => auth.includes(`'${r}'`)));
  // Roster viewer shows the activity.
  check('view-table', helper.includes('Recent push/auth attempts') && helper.includes("module IN ('user_sync', 'auth')"));
  check('view-empty-hint', helper.includes('No push or login attempts recorded yet'));

  console.log(results.join('\n'));
  console.log(`\nwave56: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
