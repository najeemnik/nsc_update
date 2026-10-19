/**
 * Wave 17 verification: admin custom COA accounts (registry, codes, guards).
 * Run: npm run test:coa
 */
import {
  CHART_OF_ACCOUNTS,
  accountDeleteBlocker,
  getAccount,
  getBudgetTradeGroups,
  getFullChart,
  nextLeafCode,
  sanitizeCustomAccounts,
  setCustomAccounts,
  type Account,
} from '../src/data/chartOfAccounts';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const mk = (code: string, parentCode: string, nameFa = 'تست'): Account => ({
  code, type: 'expense', normalBalance: 'debit', parentCode,
  nameEn: nameFa, nameFa, namePs: nameFa, system: false, activePhase: 1,
});

function main() {
  setCustomAccounts([]);

  // --- sanitizer ---
  check('sanitize-non-array', sanitizeCustomAccounts(null).length === 0);
  check('sanitize-drops-bad-code', sanitizeCustomAccounts([{ code: '51', parentCode: '5100', nameFa: 'x' }]).length === 0);
  check('sanitize-drops-bad-parent', sanitizeCustomAccounts([{ code: '510099', parentCode: '51', nameFa: 'x' }]).length === 0);
  check('sanitize-drops-empty-name', sanitizeCustomAccounts([{ code: '510099', parentCode: '5100', nameFa: '  ' }]).length === 0);
  check('sanitize-drops-system-collision', sanitizeCustomAccounts([{ code: '595008', parentCode: '5950', nameFa: 'x' }]).length === 0);
  const dups = sanitizeCustomAccounts([
    { code: '510099', parentCode: '5100', nameFa: 'a' },
    { code: '510099', parentCode: '5100', nameFa: 'b' },
  ]);
  check('sanitize-drops-dupes', dups.length === 1);
  const fb = sanitizeCustomAccounts([{ code: '510099', parentCode: '5100', nameFa: 'دری' }])[0];
  check('sanitize-lang-fallback', fb.nameEn === 'دری' && fb.namePs === 'دری');

  // --- registry ---
  setCustomAccounts([mk('510099', '5100')]);
  check('registry-lookup', getAccount('510099')?.nameFa === 'تست');
  check('registry-full-chart', getFullChart().length === CHART_OF_ACCOUNTS.length + 1);
  const groups = getBudgetTradeGroups();
  check('registry-in-trade-group', (groups.find(g => g.main.code === '5100')?.majors || []).some(l => l.code === '510099'));
  setCustomAccounts([]);

  // --- code generator ---
  check('next-leaf-5100', nextLeafCode('5100') === '510009', `got=${nextLeafCode('5100')}`);
  check('next-leaf-invalid', nextLeafCode('51') === null && nextLeafCode('') === null);
  setCustomAccounts([mk('510009', '5100')]);
  check('next-leaf-skips-custom', nextLeafCode('5100') === '510010', `got=${nextLeafCode('5100')}`);
  const fill: Account[] = [];
  for (let n = 9; n <= 99; n++) fill.push(mk(`5100${String(n).padStart(2, '0')}`, '5100'));
  setCustomAccounts(fill);
  check('next-leaf-full', nextLeafCode('5100') === null);
  setCustomAccounts([]);

  // --- delete blocker ---
  setCustomAccounts([mk('595099', '5950'), mk('59509901', '595099')]);
  check('blocker-children', accountDeleteBlocker('595099', [], []) === 'has-children');
  setCustomAccounts([mk('595099', '5950')]);
  check('blocker-budgets', accountDeleteBlocker('595099', ['595099'], []) === 'has-budgets');
  check('blocker-journals', accountDeleteBlocker('595099', [], ['595099']) === 'has-journals');
  check('blocker-free', accountDeleteBlocker('595099', ['5100'], ['5100']) === null);
  setCustomAccounts([]);
  check('registry-clean', getFullChart().length === CHART_OF_ACCOUNTS.length);

  for (const r of results) console.log((r.startsWith('PASS') ? '✅' : '❌') + ' ' + r.slice(5));
  console.log(`\n${failed === 0 ? '🎉 ALL COA-ADMIN CHECKS PASSED' : '💥 FAILURES PRESENT'} (${passed} passed, ${failed} failed)`);
  if (failed > 0) process.exit(1);
}

main();
