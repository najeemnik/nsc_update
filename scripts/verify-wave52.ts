/**
 * Wave 52 verification: stay-logged-in for all ranks + smart outbox + username validation.
 * Run: npm run test:wave52
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
  const api = read('src/services/backendApi.ts');
  const queue = read('src/services/offlineQueue.ts');
  const tenants = read('api/office7.php');
  const loginView = read('src/components/LoginView.tsx');
  const pkg = read('package.json');

  // Outbox retires poison, 401 waits for login.
  check('q-status-sender', queue.includes('sender: (m: QueuedMutation) => Promise<number>'));
  check('q-401-kept', queue.includes('status === 401'));
  check('q-dead', queue.includes('status === 400 || status === 403 || status === 409'));
  check('q-cap', queue.includes('>= 25'));
  check('replay-status', api.includes('private async replaySend(m: QueuedMutation): Promise<number>') && api.includes('return res.status'));
  // Pull never nukes the session.
  check('pull-shield', api.includes('isTenantsPull') && api.includes('!isTenantsPull'));
  // Tenants open to authenticated users, fork-tolerant scope.
  check('gate-tenants', tenants.includes('$tenantsOnly && $currentUser'));
  check('scope-fork', tenants.includes('owner_admin_id = :me3') && tenants.includes('WHERE username = :un'));
  // Username validation on every creation path.
  check('val-fn', ctx.includes('const isValidServerUsername'));
  check('val-owner', ctx.includes('data.username.trim().toLowerCase();\n    const cleanEmail = data.email.trim().toLowerCase();\n    if (!isValidServerUsername(cleanUsername))'));
  check('val-adduser', ctx.includes('userData.username.trim().toLowerCase();\n    const cleanEmail = userData.email.trim().toLowerCase();\n    if (!isValidServerUsername(cleanUsername))'));
  check('val-emp', ctx.includes('if (!isValidServerUsername(cleanEmpUsername))'));
  check('val-reg', ctx.includes(".replace(/[^a-z0-9._-]/g, '').slice(0, 80)"));
  // Version bump.
  check('version', loginView.includes('v1.0.14') && pkg.includes('"version": "1.0.14"'));

  console.log(results.join('\n'));
  console.log(`\nwave52: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
