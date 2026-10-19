/**
 * Wave 59 verification: per-company data partitioning.
 * Run: npm run test:wave59
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

  // Scope helpers exist; staff map to their owner's scope, master keeps office7.
  check('helpers', ctx.includes('function scopeOf(u: User | null)') && ctx.includes('OFFICE7_SCOPE'));
  check('staff-scope', ctx.includes("(u.ownerAdminId || u.id || '')"));
  // Business data goes through scoped helpers; roster/session stay global.
  const dataKeys = ['projects', 'expenses', 'payments', 'documents', 'steel', 'concrete', 'contractors', 'suppliers', 'apartments', 'assets', 'labor', 'auditLogs', 'activityEvents', 'customAccounts', 'currentProjId', 'projectBudgets', 'projectPartners', 'projectInvestments', 'partnerEquityTransfers', 'interProjectTransfers'];
  check('scoped20', dataKeys.every(k => ctx.includes(`loadScoped('${k}'`) && ctx.includes(`saveScoped('${k}'`)));
  check('global-kept', ctx.includes("loadFromStorage('users'") && ctx.includes("saveToStorage('users'") && ctx.includes("saveToStorage('syncReceipts'"));
  // Legacy pool adopted once as the Office7 scope.
  check('adopt', ctx.includes('adopted once') && ctx.includes('const legacy = localStorage.getItem(STORAGE_PREFIX + key)'));
  // Identity switches reload the new company's data.
  check('switch-fn', ctx.includes('const switchCompanyScope = (u: User | null)'));
  check('switch-wired', (ctx.match(/switchCompanyScope\(/g) || []).length >= 4);

  console.log(results.join('\n'));
  console.log(`\nwave59: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
