/**
 * Wave 42 verification: dead Admin role-switcher removed, interface-size
 * setting (compact default), slimmer navbar, version 1.0.8.
 * Run: npm run test:wave42
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
  const nav = read('src/components/Navbar.tsx');
  const ctx = read('src/context/AppContext.tsx');
  const types = read('src/types/index.ts');
  const settings = read('src/components/views/SettingsView.tsx');
  const loginView = read('src/components/LoginView.tsx');
  const pkg = read('package.json');

  // --- 1. dead role switcher gone ---
  check('no-switcher-ui', !nav.includes('switchUserRole') && !nav.includes('{t.role}'));
  check('no-switcher-ctx', !ctx.includes('switchUserRole'));
  check('office7-entry-kept', nav.includes('setIsMasterAdminOpen(true)'));

  // --- 2. interface size ---
  check('type-uiscale', types.includes("uiScale?: 's' | 'm' | 'l';"));
  check('ctx-setter', ctx.includes("const setUiScale = (s: 's' | 'm' | 'l')") && ctx.includes('setUiScale,'));
  check('ctx-root-font', ctx.includes("document.documentElement.style.fontSize = px;") && ctx.includes("'14px'"));
  check('settings-ui', settings.includes('setUiScale(opt.id)') && settings.includes('Interface size'));

  // --- 3. slimmer navbar ---
  check('nav-h11', nav.includes('justify-between h-11 gap-2'));
  check('nav-logo-sm', nav.includes('h-6 sm:h-8 w-auto'));

  // --- 4. version ---
  check('v-pkg', pkg.includes('"version": "1.0.8"'));
  check('v-login', loginView.includes('v1.0.8'));

  console.log(results.join('\n'));
  console.log(`\nwave42: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
