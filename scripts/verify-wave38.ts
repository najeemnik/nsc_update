/**
 * Wave 38 verification: one-office-per-domain install seal, master-only
 * builder, remember-me/session auth, login logos + backup restore, real
 * PWA icons, compact desktop density, in-app document viewer, COA accordion.
 * Run: npm run test:wave38
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
  const app = read('src/App.tsx');
  const ctx = read('src/context/AppContext.tsx');
  const login = read('src/components/LoginView.tsx');
  const setup = read('src/components/FirstRunSetupView.tsx');
  const office7 = read('src/components/MasterAdminModal.tsx');
  const install = read('api/install.php');
  const perms = read('src/utils/permissions.ts');
  const nav = read('src/components/Navbar.tsx');
  const side = read('src/components/Sidebar.tsx');
  const dash = read('src/components/views/DashboardView.tsx');
  const docs = read('src/components/views/DocumentsView.tsx');
  const drive = read('src/components/modals/GoogleDriveModal.tsx');
  const transfer = read('src/components/modals/ProjectTransferModal.tsx');
  const coa = read('src/components/views/AccountingView.tsx');
  const vite = read('vite.config.ts');
  const html = read('index.html');
  const css = read('src/index.css');

  // --- 1. one office per domain (install seal) ---
  check('seal-status-api', install.includes("action=status") || install.includes("'status'"));
  check('seal-complete-api', install.includes("'complete'") && install.includes('installed.lock'));
  check('seal-complete-keyed', install.includes("complete") && install.includes('install.key'));
  check('seal-hook', exists('src/hooks/useInstallStatus.ts') && read('src/hooks/useInstallStatus.ts').includes('action=status'));
  check('seal-app-gate', app.includes('useInstallStatus') && app.includes('<FirstRunSetupView />'));
  check('seal-auto', setup.includes('action=complete'));
  check('seal-office7', office7.includes('action=complete') && office7.includes('Seal installation'));

  // --- 2. builder master-only ---
  check('builder-gate', perms.includes("section === 'builder'") && perms.includes('if (user.isMasterSuperAdmin === true) return true;'));

  // --- 3. remember-me / session-by-default ---
  check('session-load', ctx.includes('sessionStorage.getItem') && ctx.includes('localStorage.getItem'));
  check('session-save', ctx.includes('sessionStorage.setItem') && ctx.includes('saveCurrentUser'));
  check('session-login-arg', ctx.includes('remember: boolean = true') || ctx.includes('remember = true'));
  check('session-checkbox', login.includes('rememberMe') && login.includes('Remember me on this device'));
  check('session-default-pwa', login.includes('display-mode: standalone'));
  check('session-noleak', count(ctx, "saveToStorage('currentUser'") === 1);
  check('session-no-recursion', !ctx.includes("saveCurrentUser( u)"));

  // --- 4. login logos + restore card ---
  check('login-product-logo', login.includes('/assets/logo.png'));
  check('login-personal-logo', login.includes('/assets/creator-logo.png'));
  check('login-restore', login.includes('importBackupJSON') && login.includes('users.length === 0'));

  // --- 5. PWA icons ---
  check('pwa-192', exists('public/assets/icon-192.png'));
  check('pwa-512', exists('public/assets/icon-512.png'));
  check('pwa-maskable', exists('public/assets/icon-maskable-512.png'));
  check('pwa-manifest', vite.includes('icon-192.png') && vite.includes('192x192') && vite.includes('512x512') && vite.includes('maskable'));
  check('pwa-apple', html.includes('icon-192.png'));

  // --- 6. compact density + pill truncate ---
  check('density-css', css.includes('.tap-compact'));
  check('density-nav', nav.includes('tap-compact') && nav.includes('w-8 h-8 rounded-full'));
  check('density-pill', nav.includes('max-w-[170px]') && nav.includes('truncate'));
  check('density-side', side.includes('w-60') && side.includes('w-6 h-6 rounded-lg'));
  check('density-dash', dash.includes('text-xl sm:text-2xl font-extrabold'));

  // --- 7. document viewer (names only, no raw links) ---
  check('viewer-exists', exists('src/components/DocumentViewerModal.tsx'));
  check('viewer-drive-preview', read('src/components/DocumentViewerModal.tsx').includes('/preview'));
  check('viewer-docs-wired', docs.includes('DocumentViewerModal') && docs.includes('setViewDoc'));
  check('viewer-drive-wired', drive.includes('DocumentViewerModal') && drive.includes('setViewDoc'));
  check('viewer-transfer-wired', transfer.includes('DocumentViewerModal') && transfer.includes('setViewDoc'));
  check('viewer-no-blank', !docs.includes('target="_blank"') || docs.includes('setViewDoc'));

  // --- 8. COA accordion ---
  check('coa-groups', coa.includes('COA_GROUP_DEFS') && coa.includes('coaGroupRows'));
  check('coa-toggle', coa.includes('coaOpen') && coa.includes('coaIsOpen'));
  check('coa-total', coa.includes('coaGroupTotal'));
  check('coa-print', coa.includes('print:table-row'));

  console.log(results.join('\n'));
  console.log(`\nwave38: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
