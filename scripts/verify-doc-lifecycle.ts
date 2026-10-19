/**
 * Wave 23+24 verification: canonical money + document lifecycle helpers.
 * Run: npm run test:doclifecycle
 */
import {
  canonicalMoney,
  expUSD,
  expAFN,
  payUSD,
  payAFN,
  aptUSD,
  isCountedDoc,
  isLockedDoc,
  docStateOf,
  expenseReversalMoney,
  paymentReversalMoney,
  round2,
} from '../src/utils/docFinance';
import type { Expense, Payment, ApartmentUnit } from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const as = <T>(o: object): T => o as unknown as T;

function main() {
  // --- canonicalMoney ---
  check('cm-usd-raw', JSON.stringify(canonicalMoney(100, 'USD', 70)) === JSON.stringify({ usd: 100, afn: 7000 }));
  check('cm-afn-raw', JSON.stringify(canonicalMoney(7000, 'AFN', 70)) === JSON.stringify({ usd: 100, afn: 7000 }));
  check('cm-custom-rate', canonicalMoney(140, 'AFN', 73.5).usd === 1.9, `got=${canonicalMoney(140, 'AFN', 73.5).usd}`);
  check('cm-default-rate', canonicalMoney(70, 'AFN').usd === 1);
  check('cm-undefined-zero', canonicalMoney(undefined, 'USD').usd === 0 && canonicalMoney(undefined, 'USD').afn === 0);
  check('cm-round2', round2(10.005) === 10.01 && round2(1.004) === 1);

  // --- expense canonicals: explicit fields win (legacy-safe) ---
  const legacyExp = as<Expense>({ amount: 100, currency: 'AFN', amountInUSD: 100, amountInAFN: 7000, totalAmountUSD: 100, totalAmountAFN: 7000 });
  check('exp-legacy-total-wins', expUSD(legacyExp) === 100 && expAFN(legacyExp) === 7000);
  const rawExp = as<Expense>({ amount: 3500, currency: 'AFN', exchangeRate: 70 });
  check('exp-raw-convert', expUSD(rawExp) === 50 && expAFN(rawExp) === 3500);
  const midExp = as<Expense>({ amount: 999, currency: 'USD', amountInUSD: 50, amountInAFN: 3500 });
  check('mid-inusd-fallback', expUSD(midExp) === 50 && expAFN(midExp) === 3500);

  // --- payment canonicals ---
  const legacyPay = as<Payment>({ amount: 200, currency: 'USD', amountUSD: 200, amountAFN: 14000 });
  check('pay-legacy-mirror-wins', payUSD(legacyPay) === 200 && payAFN(legacyPay) === 14000);
  const rawPay = as<Payment>({ amount: 700, currency: 'AFN', exchangeRate: 70 });
  check('pay-raw-convert', payUSD(rawPay) === 10 && payAFN(rawPay) === 700);

  // --- apartment chain: totalPriceUSD > salePriceInUSD > salePrice > totalPrice ---
  check('apt-chain-1', aptUSD(as<ApartmentUnit>({ totalPriceUSD: 50, salePriceInUSD: 60, salePrice: 70, totalPrice: 80 })) === 50);
  check('apt-chain-2', aptUSD(as<ApartmentUnit>({ salePriceInUSD: 60, salePrice: 70, totalPrice: 80 })) === 60);
  check('apt-chain-3', aptUSD(as<ApartmentUnit>({ salePrice: 70, totalPrice: 80 })) === 70);
  check('apt-chain-4', aptUSD(as<ApartmentUnit>({ totalPrice: 80 })) === 80);
  check('apt-empty-zero', aptUSD(as<ApartmentUnit>({})) === 0);

  // --- lifecycle gates ---
  check('counted-legacy', isCountedDoc({}) === true);
  check('counted-approved', isCountedDoc({ docStatus: 'approved' }) === true);
  check('counted-posted', isCountedDoc({ docStatus: 'posted' }) === true);
  check('counted-draft-out', isCountedDoc({ docStatus: 'draft' }) === false);
  check('counted-rejected-out', isCountedDoc({ approvalStatus: 'rejected' }) === false);
  check('locked-posted', isLockedDoc({ docStatus: 'posted' }) === true);
  check('locked-reversed', isLockedDoc({ reversedBy: 'x' }) === true);
  check('locked-open', isLockedDoc({}) === false && isLockedDoc({ docStatus: 'draft' }) === false);
  check('state-legacy-approved', docStateOf({}) === 'approved');
  check('state-draft', docStateOf({ docStatus: 'draft' }) === 'draft');
  check('state-reversed', docStateOf({ docStatus: 'posted', reversedBy: 'm1' }) === 'reversed');

  // --- reversal mirrors negate and net to zero ---
  const origE = as<Expense>({ amount: 3500, currency: 'AFN', exchangeRate: 70, amountInUSD: 50, amountInAFN: 3500, paidAmount: 1000, remainingAmount: 2500 });
  const revE = expenseReversalMoney(origE);
  check('rev-exp-negates', revE.amount === -3500 && revE.totalAmountUSD === -50 && revE.totalAmountAFN === -3500);
  check('rev-exp-nets-zero', (origE.amountInUSD || 0) + (revE.amountInUSD || 0) === 0);
  check('rev-exp-paid-negated', revE.paidAmount === -1000 && revE.remainingAmount === -2500);
  const origP = as<Payment>({ amount: 700, currency: 'AFN', exchangeRate: 70, amountInUSD: 10, amountInAFN: 700 });
  const revP = paymentReversalMoney(origP);
  check('rev-pay-negates', revP.amount === -700 && revP.amountUSD === -10 && revP.amountAFN === -700);
  check('rev-pay-nets-zero', (origP.amountInUSD || 0) + (revP.amountInUSD || 0) === 0);
  // reversal of legacy record without explicit canonicals still converts
  const bareE = as<Expense>({ amount: 140, currency: 'AFN', exchangeRate: 70 });
  check('rev-exp-bare-converts', expenseReversalMoney(bareE).totalAmountUSD === -2);

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
