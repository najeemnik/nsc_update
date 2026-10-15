/**
 * Wave 35 verification: security patch + Drive centralization + canonical
 * apartment money + trilingual UI + separate test version.
 * Run: npm run test:wave35
 */
import * as fs from 'fs';
import * as path from 'path';
import { aptUSD } from '../src/utils/docFinance';
import { collectedFromSales } from '../src/utils/opsMath';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const root = process.cwd();
const read = (p: string): string => fs.readFileSync(path.join(root, p), 'utf-8');

function fnHasGuard(src: string, fnName: string): boolean {
  const i = src.indexOf(`const ${fnName} =`);
  if (i < 0) return false;
  return src.slice(i, i + 900).includes('denyAccess');
}

function main() {
  const ctx = read('src/context/AppContext.tsx');
  const login = read('src/components/LoginView.tsx');
  const nav = read('src/components/Navbar.tsx');
  const side = read('src/components/Sidebar.tsx');
  const dash = read('src/components/views/DashboardView.tsx');
  const docs = read('src/components/views/DocumentsView.tsx');
  const app = read('src/App.tsx');
  const settings = read('src/components/views/SettingsView.tsx');
  const apts = read('src/components/views/ApartmentsView.tsx');

  // --- 1. OTP bypass removed ---
  check('otp-no-fallback-login', !login.includes("|| '123456'"));
  check('otp-no-fallback-ctx', !ctx.includes("|| '123456'"));
  check('otp-guard-twice', ctx.split('!user.otpCode || user.otpCode !== otpCode.trim()').length - 1 === 2);

  // --- 2. Google-login -> admin path removed ---
  check('login-no-google-handler', !login.includes('handleGoogleSignInClick') && !login.includes('isGoogleSigningIn'));
  check('login-no-google-button', !login.includes('Official Google Sign In') && !login.includes('Sign in with Google'));

  // --- 3. no silent auto-login in production ---
  check('currentuser-default-null', ctx.includes("TEST_MODE ? TEST_USER : null"));

  // --- 4. master-only guards ---
  for (const fn of ['createTenantCompanyOwnerBySuperAdmin', 'chargeUserSubscription', 'toggleLockUserBySuperAdmin', 'updateTenantByMasterAdmin', 'toggleAiForUser', 'deleteEmployeeAccount', 'createEmployeeAccount']) {
    check(`guard-${fn}`, fnHasGuard(ctx, fn));
  }

  // --- 5. canonical apartment money ---
  check('dash-aptusd', dash.includes('aptUSD(a)') && dash.includes('amountReceived'));
  check('apts-aptusd', apts.includes('aptUSD(') && apts.includes('amountReceived'));
  const viewDir = path.join(root, 'src/components/views');
  const legacyMoney = fs.readdirSync(viewDir)
    .filter(f => f.endsWith('.tsx'))
    .flatMap(f => read(`src/components/views/${f}`).split('\n')
      .map((l, i) => ({ f, i: i + 1, l }))
      .filter(x => /totalPriceUSD|downPaymentUSD|paidAmountUSD/.test(x.l)));
  check('views-no-legacy-money', legacyMoney.length === 0, JSON.stringify(legacyMoney.slice(0, 3)));
  check('aptusd-fn', aptUSD({ salePrice: 100 } as any) === 100 && aptUSD({} as any) === 0
    && aptUSD({ totalPriceUSD: 50, salePrice: 100 } as any) === 50);
  check('collected-fn', collectedFromSales([{ downPayment: 200, amountReceived: 500 }] as any) === 500);

  // --- 6. Drive centralized in Settings ---
  const driveTokens = ['isGoogleDriveConnected', 'backupToGoogleDrive', 'connectGoogleDrive',
    'disconnectGoogleDrive', 'uploadDocumentToDrive', 'googleDriveUserEmail'];
  for (const [name, src] of [['login', login], ['nav', nav], ['side', side], ['dash', dash], ['docs', docs], ['app', app]] as const) {
    const leaks = driveTokens.filter(t => src.includes(t));
    check(`drive-absent-${name}`, leaks.length === 0, leaks.join(','));
  }
  check('drive-no-props', !app.includes('onOpenGoogleDrive') && !app.includes('onOpenDrive')
    && !dash.includes('onOpenGoogleDrive') && !docs.includes('onOpenGoogleDrive'));
  check('drive-app-no-modal', !app.includes('GoogleDriveModal'));
  check('settings-owns-drive', settings.includes('GoogleDriveModal') && settings.includes('disconnectGoogleDrive')
    && settings.includes('backupToGoogleDrive') && settings.includes('googleDriveUserEmail'));
  check('settings-auto-backup', settings.includes('driveAutoBackup') && settings.includes('toggleDriveAutoBackup')
    && settings.includes('Backup Now') && settings.includes('handleExportLocal'));

  // --- 7. separate test version ---
  check('test-flag', ctx.includes("TEST_MODE_KEY = 'nsc_test_mode'"));
  check('test-prefix', ctx.includes("TEST_PREFIX = 'nik_smart_count_test_'")
    && ctx.includes("STORAGE_PREFIX = TEST_MODE ? TEST_PREFIX : 'nik_smart_count_'"));
  // Wave 37: prod defaults wrapped with EMPTY_SEED, test fallbacks unchanged.
  check('test-empty-fallbacks', ctx.includes("TEST_MODE ? [] : (EMPTY_SEED ? [] : initialExpenses)")
    && ctx.includes("TEST_MODE ? [TEST_USER] : (EMPTY_SEED ? [] : initialUsers)")
    && ctx.includes("TEST_MODE ? [TEST_PROJECT] : (EMPTY_SEED ? [] : initialProjects)"));
  check('test-tab-lock', ctx.includes("if (TEST_MODE && (section === 'apartments' || section === 'payments')) return false"));
  check('test-logout-exits', ctx.includes('if (TEST_MODE) { exitTestMode(); return; }'));
  check('test-ctx-api', ctx.includes('isTestMode: boolean') && ctx.includes('enterTestMode: () => void')
    && ctx.includes('exitTestMode: () => void') && ctx.includes('wipeTestData: () => void'));
  check('test-login-entry', login.includes('enterTestMode') && login.includes('Enter test version'));
  check('test-navbar-strip', nav.includes('TEST VERSION') && nav.includes('exitTestMode'));
  check('test-settings-card', settings.includes('wipeTestData') && settings.includes('Wipe test data')
    && settings.includes('Exit test version'));
  check('test-backup-prefix', ctx.includes("TEST_MODE ? 'TEST_' : ''"));

  // --- 8. trilingual UI: no hardcoded display literals in views ---
  const faRe = /[\u0600-\u06FF]/;
  const violations: string[] = [];
  for (const f of fs.readdirSync(viewDir).filter(x => x.endsWith('.tsx'))) {
    const lines = read(`src/components/views/${f}`).split('\n');
    let inLangMap = false;
    let tpDepth = 0;
    lines.forEach((raw, idx) => {
      const l = raw;
      if (/^\s+(fa|ps): \{$/.test(l)) { inLangMap = true; return; }
      if (inLangMap && /^\s+\},?$/.test(l)) { inLangMap = false; return; }
      if (inLangMap) return;
      if (/^\s*\*/.test(l)) return; // file-header comment
      if (tpDepth > 0) { // continuation of a multi-line tp(...) call
        tpDepth += (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
        return;
      }
      if (/tp\(/.test(l)) {
        tpDepth = (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
        return;
      }
      const code = l.split('//')[0];
      if (!faRe.test(code)) return;
      if (/tp\(|[^a-zA-Z]t\(['"]/.test(code)) return;
      if (/^\s*[?:]/.test(l)) return; // ternary branch (en branch on sibling line)
      if (/fa:|ps:|AFN \(؋|\(Farsi\)|\(Pashto\)|\['(fa|ps)'|\.category ===|join\(/.test(code)) return;
      violations.push(`${f}:${idx + 1}:${code.trim().slice(0, 60)}`);
    });
  }
  check('i18n-no-hardcoded', violations.length === 0, JSON.stringify(violations.slice(0, 5)));

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
