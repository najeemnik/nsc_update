/**
 * Wave 41 verification: user sync that actually works — no silent failures.
 * Failed syncs never log the owner out, token-less pushes are queued, server
 * capability is probed (outdated files diagnosed), one-time retro-push heals
 * pre-patch accounts, Users page shows status + sync-all button.
 * Run: npm run test:wave41
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
  const api = read('src/services/backendApi.ts');
  const ctx = read('src/context/AppContext.tsx');
  const auth = read('api/auth.php');
  const usersView = read('src/components/views/UsersView.tsx');

  // --- 1. sync failures never nuke the session ---
  check('no-logout-request', api.includes("endpoint.includes('action=sync_user') || endpoint.includes('action=delete_user')") &&
    api.includes('!isUserSync'));
  check('no-logout-replay', api.includes('replayIsUserSync'));
  check('token-getter', api.includes('public getToken()'));

  // --- 2. probe + explicit queue ---
  check('ping-client', api.includes('pingServer') && api.includes("auth.php?action=ping"));
  check('ping-server', auth.includes("=== 'ping'") && auth.includes("'wave' => 40"));
  check('queue-sync', api.includes('queueUserSync'));
  check('server-lower', auth.includes("$username = strtolower(trim((string)($p['username'] ?? '')));"));

  // --- 3. context: status + healing ---
  check('ctx-status', ctx.includes('serverSync: { status:') && ctx.includes("'no-token' | 'outdated' | 'offline'"));
  check('ctx-refresh', ctx.includes('const refreshServerSyncStatus = async'));
  check('ctx-syncall', ctx.includes('const syncAllUsersToServer = async'));
  check('ctx-queue-no-token', ctx.includes("if (!backendApi.getToken()) {") && ctx.includes("queueUserSync('sync_user'"));
  check('ctx-retro', ctx.includes('nsc_bulkpush_v41') && ctx.includes('syncAllUsersToServer().catch'));
  check('ctx-login-status', ctx.includes("status: 'ok', lastSyncAt:"));
  check('ctx-exports', ctx.includes('serverSync,') && ctx.includes('refreshServerSyncStatus,') && ctx.includes('syncAllUsersToServer,'));

  // --- 4. creation paths hardened ---
  check('adduser-min3', ctx.includes('Username must be at least 3 characters'));
  check('adduser-lower', ctx.includes('username: cleanUsername,'));
  check('register-push', ctx.includes('pushUserToServer(newUser);') && ctx.includes('regUsername'));

  // --- 5. users page UI ---
  check('ui-status', usersView.includes('serverSync.status') && usersView.includes('refreshServerSyncStatus'));
  check('ui-syncall', usersView.includes('syncAllUsersToServer()') && usersView.includes('Sync all users'));

  console.log(results.join('\n'));
  console.log(`\nwave41: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
