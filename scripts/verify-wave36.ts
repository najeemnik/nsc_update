/**
 * Wave 36 verification: mega-audit fixes.
 * Auth hardening (strict login, throttle, hashing, OTP expiry, PIN),
 * income/material local-first dual writes, trilingual AI, PWA, Firebase env.
 * Run: npm run test:wave36
 */
import * as fs from 'fs';
import * as path from 'path';
import { sha256Hex, hashPassword, verifyPassword, isPasswordHash } from '../src/utils/hash';
import { answerProjectQuestionLocally } from '../src/services/aiAssistantService';

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

function main() {
  const ctx = read('src/context/AppContext.tsx');
  const types = read('src/types/index.ts');
  const settings = read('src/components/views/SettingsView.tsx');
  const income = read('src/components/modals/AddIncomeModal.tsx');
  const material = read('src/components/modals/AddMaterialModal.tsx');
  const aiModal = read('src/components/AiAssistantModal.tsx');
  const aiSvc = read('src/services/aiAssistantService.ts');
  const html = read('index.html');
  const mainTsx = read('src/main.tsx');
  const driveAuth = read('src/services/googleDriveAuth.ts');
  const loginSection = ctx.slice(ctx.indexOf('const login ='), ctx.indexOf('const createTenantCompanyOwnerBySuperAdmin'));

  // --- 1. hash utils: real SHA-256 ---
  check('hash-digest-abc', sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  check('hash-roundtrip', isPasswordHash(hashPassword('pw12345', 'Admin')) && verifyPassword('pw12345', hashPassword('pw12345', 'Admin'), 'admin'));
  check('hash-rejects-wrong', !verifyPassword('wrong', hashPassword('pw12345', 'Admin'), 'Admin'));
  check('hash-legacy-accepted', verifyPassword('plain', 'plain', 'u') && !isPasswordHash('plain'));

  // --- 2. strict login + throttle + upgrade ---
  check('login-verify', loginSection.includes('verifyPassword(candidate, found.password, saltOf(found))'));
  check('login-no-direct-compare', !ctx.includes('found.password !== password'));
  check('login-require-pw', loginSection.includes('Password is required'));
  check('login-throttle', loginSection.includes('readLoginFails') && ctx.includes('nsc_login_fails_') && loginSection.includes('Too many failed attempts'));
  check('login-upgrade-legacy', loginSection.includes('isPasswordHash(found.password)') && loginSection.includes('hashPassword(pw, found.username)'));

  // --- 3. addUser / updateUser / resets ---
  check('adduser-require-hash', ctx.includes("رمز عبور الزامی است / Password is required") && ctx.includes('hashPassword(rawPw, cleanUsername)'));
  check('updateuser-redact', ctx.includes("logged.password = '[redacted]'"));
  check('updateuser-hash', ctx.includes('hashPassword(safe.password.trim(), target.username)'));
  check('changeownpw-verify-hash', ctx.includes("verifyPassword(currentPassword || '', fresh.password, saltOf(fresh))") && ctx.includes('hashPassword(next, fresh.username)'));
  check('complete-reset-hash', ctx.includes('hashPassword(nextPw, user.username)') && ctx.includes('otpIssuedAt: undefined'));

  // --- 4. OTP expiry ---
  check('otp-issuedat-type', types.includes('otpIssuedAt?: string;'));
  check('otp-ttl', ctx.includes('OTP_TTL_MS = 10 * 60 * 1000') && ctx.includes('isOtpExpired'));
  check('otp-expiry-enforced', ctx.split('isOtpExpired(user.otpIssuedAt)').length - 1 === 2);
  check('otp-request-stamps', ctx.includes('otpCode: resetOtp, otpIssuedAt: new Date().toISOString()'));

  // --- 5. register backup + hashing ---
  check('register-backup', ctx.includes('exportJsonBackup();') && ctx.indexOf('exportJsonBackup();') < ctx.indexOf('setSteelRecords([])'));
  check('register-hash', ctx.includes("hashPassword(data.password.trim(), data.email.split('@')[0])"));
  check('tenant-create-hash', ctx.includes('hashPassword(data.password.trim(), cleanUsername)'));

  // --- 6. section PIN: backdoor gone, UI wired ---
  check('pin-no-backdoor', !ctx.includes("cleanAttempt === '22277512'"));
  check('pin-hash-verify', ctx.includes("verifyPassword(cleanAttempt, stored, `section:${sectionId}`)"));
  check('pin-set-hash', ctx.includes("hashPassword(trimmed, `section:${sectionId}`)"));
  check('pin-ui', settings.includes('setSectionPassword') && settings.includes('Apartments Section PIN') && settings.includes('unlockApartments(pinCurrent)'));

  // --- 7. income dual-write ---
  check('income-local-first', income.includes('addPayment({') && income.includes("paymentType: 'income'"));
  check('income-backend-besteffort', income.includes('backend sync failed (kept locally)'));

  // --- 8. material dual-write + real defaults ---
  check('material-local-first', material.includes('addExpense({') && material.includes("paymentStatus: isPaid ? 'paid' : 'unpaid'"));
  check('material-no-demo', !material.includes('ABC') && !material.includes("useState('100')") && !material.includes("useState('520')"));
  check('material-category-valid', material.includes("useState('تجهیزات و مصالح متفرقه')") && material.includes('<option value="تجهیزات و مصالح متفرقه">'));

  // --- 9. trilingual AI ---
  const demo = { projectName: 'P', totalSteelTons: 1, steelCostUSD: 2, totalConcreteM3: 3, concreteCostUSD: 4, totalExpensesUSD: 5, totalPaidUSD: 6, totalDebtUSD: 7, apartmentsTotal: 8, apartmentsSold: 1, apartmentsAvailable: 7, totalSalesValueUSD: 9, salesReceivedUSD: 10, salesDueUSD: 11 };
  const projs = [{ name: 'P', floors: 2, units: 3, city: 'Kabul' }];
  check('ai-en', answerProjectQuestionLocally('steel report', demo, projs, 'en').includes('tons of rebar'));
  check('ai-fa', answerProjectQuestionLocally('سیخ', demo, projs, 'fa').includes('سیخ‌گول'));
  check('ai-ps', answerProjectQuestionLocally('سیخ', demo, projs, 'ps').includes('سیخ‌ګول'));
  check('ai-caller-lang', aiModal.includes('scopedProjects, language)'));
  check('ai-no-literal-newline', !aiSvc.includes(':\\\\n${list}'));

  // --- 10. PWA (Wave 10 plugin owns shell; audit adds the in-app install button) ---
  const viteCfg = read('vite.config.ts');
  check('pwa-plugin-manifest', viteCfg.includes('VitePWA(') && viteCfg.includes('manifest:') && viteCfg.includes('maskable'));
  check('pwa-no-duplicate-files', !exists('public/sw.js') && !exists('public/manifest.webmanifest'));
  check('pwa-no-dup-link', !html.includes('rel="manifest"'));
  check('pwa-no-manual-register', !mainTsx.includes("register('/sw.js')"));
  check('pwa-hook', exists('src/hooks/usePwaInstall.ts') && read('src/hooks/usePwaInstall.ts').includes('beforeinstallprompt'));
  check('pwa-ui', settings.includes('usePwaInstall') && settings.includes('Install App on This Device'));

  // --- 11. test-aware FOUC + firebase env ---
  check('fouc-test-aware', html.includes("localStorage.getItem('nsc_test_mode')") && html.includes('nik_smart_count_test_'));
  check('firebase-env', driveAuth.includes('VITE_FIREBASE_API_KEY') && read('.env.example').includes('VITE_FIREBASE_API_KEY'));

  // --- 12. temp probe removed ---
  check('probe-removed', !exists('scripts/audit-probe.ts'));

  // --- 13. navbar desktop fixes: visible + button + reachable logout ---
  const navbar = read('src/components/Navbar.tsx');
  check('nav-no-bg-conflict', !navbar.includes('circleBtn} bg-amber-600') && !navbar.includes('circleBtn} bg-white'));
  check('nav-amber-solid', navbar.includes('circleBtnAmber') && navbar.includes('bg-amber-600 hover:bg-amber-700 text-white'));
  check('nav-role-pill-button', navbar.includes('rolePillRef') && navbar.includes('<button') && navbar.includes('Account menu'));
  check('nav-pill-toggles-menu', navbar.includes('setUserDropdownOpen(v => !v)'));
  check('nav-pill-outside-guard', navbar.includes('rolePillRef.current.contains(target)'));
  check('nav-panel-below-lg', navbar.includes('ref={userRef} className="relative shrink-0"') && navbar.includes('hidden lg:flex items-center gap-1.5 ps-1 pe-2 py-1'));

  for (const r of results) console.log(r);
  console.log(`\nwave36: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
