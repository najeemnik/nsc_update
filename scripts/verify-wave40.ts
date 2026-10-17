/**
 * Wave 40 verification: decluttered header (tools inside the More menu,
 * NSC on mobile), permission-filtered + updated system guide, multi-device
 * user sync (server account truth with hash-only pushes), version 1.0.6.
 * Run: npm run test:wave40
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
const count = (s: string, sub: string): number => s.split(sub).length - 1;

function main() {
  const nav = read('src/components/Navbar.tsx');
  const guide = read('src/components/modals/SystemGuideModal.tsx');
  const ctx = read('src/context/AppContext.tsx');
  const loginView = read('src/components/LoginView.tsx');
  const setup = read('src/components/FirstRunSetupView.tsx');
  const office7 = read('src/components/MasterAdminModal.tsx');
  const api = read('src/services/backendApi.ts');
  const auth = read('api/auth.php');
  const install = read('api/install.php');
  const pkg = read('package.json');

  // --- 1. header declutter ---
  check('nav-no-home', !nav.includes("{/* Home */}"));
  check('nav-no-book-standalone', !nav.includes('{/* Help Guide */}'));
  check('nav-no-settings-shortcut', !nav.includes('{/* Settings shortcut */}'));
  check('nav-more-always', nav.includes('ref={moreRef} className="relative block"'));
  check('nav-more-camera', nav.includes('setMoreMenuOpen(false); openCameraForCapture();'));
  check('nav-more-ai', nav.includes('setMoreMenuOpen(false); onOpenAiAssistant();'));
  check('nav-more-guide', nav.includes('setMoreMenuOpen(false); onOpenSystemGuide();'));
  check('nav-nsc', nav.includes('>NSC</span>'));
  check('nav-avatar-locked', nav.includes('ref={userRef} className="relative shrink-0"'));

  // --- 2. guide: filtered + updated ---
  check('guide-filter', guide.includes('visibleTopics') && guide.includes('isTabAllowed(tab)'));
  check('guide-owner-sees-all', guide.includes('t.always || isOwner'));
  check('guide-new-topics', guide.includes("id: 'users'") && guide.includes("id: 'app'") && guide.includes("id: 'master'"));
  check('guide-safe-active', guide.includes('safeActive') && !guide.includes('activeTopic ==='));

  // --- 3. server: account truth ---
  check('auth-sha', auth.includes("substr($storedHash, 0, 7) === 'sha256$'") && auth.includes('hash_equals($storedHash, $calc)')); // PHP7-safe since wave43
  check('auth-sync', auth.includes("$action === 'sync_user'") && auth.includes('app_profile_json'));
  check('auth-sync-guarded', auth.includes("Master accounts are created only via installer bootstrap."));
  check('auth-delete', auth.includes("$action === 'delete_user'"));
  check('auth-profile-out', auth.includes("'appProfile' =>"));
  check('install-master', install.includes("$input['master']") && install.includes("'masterSynced' => $masterSynced"));
  check('migration', exists('database/migration_wave40_usersync.sql') &&
    read('database/migration_wave40_usersync.sql').includes('hash_salt') &&
    read('database/migration_wave40_usersync.sql').includes('app_profile_json'));

  // --- 4. client: sync + login ---
  check('api-methods', api.includes('syncUser(user: any)') && api.includes('deleteServerUser('));
  check('api-queueable', api.includes("endpoint.includes('action=sync_user')"));
  check('ctx-async-login', ctx.includes('const login = async ('));
  check('ctx-server-fallback', ctx.includes('backendApi.login(trimmedInput, pw)'));
  check('ctx-cache', ctx.includes('serverUserToLocal(su,'));
  check('ctx-salt', ctx.includes('hashSalt') && ctx.includes('saltOf(found)') && read('src/types/index.ts').includes('hashSalt?: string;'));
  check('ctx-pushes', count(ctx, 'pushUserToServer(') >= 10);
  check('ctx-server-delete', count(ctx, 'deleteUserOnServer(') >= 2);
  check('ctx-server-locked', ctx.includes("'server-locked'") && loginView.includes("authNotice === 'server-locked'"));
  check('login-await', loginView.includes('await login(loginEmail, loginPassword'));
  check('login-brand-logo', count(loginView, 'alt="NIK SMART COUNT"') === 2);
  check('setup-master', setup.includes('master: {') && setup.includes('passwordHash: hashPassword('));
  check('seal-master', office7.includes('master: me ? {') && office7.includes('masterSynced'));

  // --- 5. version ---
  check('v-pkg', pkg.includes('"version": "1.0.9"')); // rolled forward by wave42
  check('v-login', loginView.includes('v1.0.9')); // rolled forward by wave42

  console.log(results.join('\n'));
  console.log(`\nwave40: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
