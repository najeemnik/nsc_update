/**
 * Wave 39 verification: Visual Builder lives ONLY inside Office7
 * (master-only, no sidebar tab, no grants), offline-first PWA gate
 * (no phantom setup when the server is unreachable), version 1.0.5.
 * Run: npm run test:wave39
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
const count = (s: string, sub: string): number => s.split(sub).length - 1;

function main() {
  const app = read('src/App.tsx');
  const office7 = read('src/components/MasterAdminModal.tsx');
  const side = read('src/components/Sidebar.tsx');
  const drawer = read('src/components/MobileMenuDrawer.tsx');
  const bottom = read('src/components/MobileNav.tsx');
  const pb = read('src/utils/pageBuilder.ts');
  const perms = read('src/utils/permissions.ts');
  const bv = read('src/components/views/BuilderView.tsx');
  const login = read('src/components/LoginView.tsx');
  const pkg = read('package.json');
  const vite = read('vite.config.ts');

  // --- 1. builder: master-only at every layer ---
  check('b-canuse-master',
    pb.includes('return user.isMasterSuperAdmin === true;') &&
    !pb.includes("user.role === 'admin') return true"));
  check('b-cando-deny', perms.includes("section === 'builder'") && perms.includes('Office7-only'));
  check('b-no-grant', !office7.includes("{ id: 'builder'"));
  check('b-no-sidebar', !side.includes("id: 'builder'"));
  check('b-no-drawer', !drawer.includes("'builder'"));
  check('b-no-bottomnav', !bottom.includes("'builder'"));
  check('b-view-gate', bv.includes('if (!canUseBuilder(currentUser))'));
  check('b-deny-text', bv.includes('only to the master administrator') && bv.includes('فقط داخل دفتر هفت'));

  // --- 2. builder: the ONLY entry point is inside Office7 ---
  check('b-entry-prop', office7.includes('onOpenBuilder?: () => void') && office7.includes('onClick={onOpenBuilder}'));
  check('b-entry-wired', count(app, "onOpenBuilder={() => { setIsMasterAdminOpen(false); setActiveTab('builder'); }}") === 2);
  check('b-back-btn', bv.includes("setActiveTab('dashboard')"));

  // --- 3. offline-first gate (no phantom office) ---
  check('o-null-screen', app.includes('installStatus.initialized === null'));
  check('o-retry', app.includes('onClick={installStatus.refresh}'));
  check('o-setup-still-gated', app.includes('<FirstRunSetupView />'));
  check('o-nav-fallback', vite.includes("navigateFallback: '/index.html'"));
  check('o-denylist', vite.includes('/^\\/api\\//') && vite.includes('/\\.php([?#]|$)/'));
  check('o-icons', vite.includes('icon-192.png') && vite.includes('icon-maskable-512.png'));

  // --- 4. version 1.0.5 ---
  check('v-pkg', pkg.includes('"version": "1.0.7"')); // rolled forward by wave40
  check('v-login', login.includes('v1.0.7')); // rolled forward by wave40

  console.log(results.join('\n'));
  console.log(`\nwave39: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
