/**
 * Wave 30 verification: operational math with independent hand fixtures.
 * Run: npm run test:opsmath
 */
import {
  laborPay,
  contractorPayout,
  inMonth,
  isCashInflow,
  isCashOutflow,
  collectedFromSales,
  profitMargin,
  roundMoney,
} from '../src/utils/opsMath';
import type { ApartmentUnit, Payment } from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const as = <T>(o: object): T => o as unknown as T;

function main() {
  // --- payroll ---
  const p1 = laborPay(26, 500, 2000);
  check('labor-basic', p1.gross === 13000 && p1.net === 11000, JSON.stringify(p1));
  check('labor-advance-capped', laborPay(10, 100, 5000).net === 0);
  check('labor-fraction-round', laborPay(3, 333.333, 0).gross === 1000);
  check('labor-zero-safe', laborPay(NaN, NaN, NaN).net === 0);

  // --- contractor deductions (matches the old Office7 sample figures) ---
  const c1 = contractorPayout(200000, 10, 2);
  check('deduct-sample', c1.retention === 20000 && c1.brt === 4000 && c1.net === 176000, JSON.stringify(c1));
  const c2 = contractorPayout(100000, 10, 7);
  check('deduct-brt7', c2.retention === 10000 && c2.brt === 7000 && c2.net === 83000);
  check('deduct-zero', contractorPayout(0).net === 0);
  check('deduct-defaults', contractorPayout(1000).retention === 100 && contractorPayout(1000).brt === 20);

  // --- month matcher ---
  check('month-hit', inMonth('2026-03-15', 2026, 3) === true);
  check('month-miss', inMonth('2026-03-15', 2026, 4) === false);
  check('month-jan-dec', inMonth('2026-01-01', 2026, 1) === true && inMonth('2026-12-31', 2026, 12) === true);
  check('month-invalid', inMonth('garbage', 2026, 3) === false && inMonth('', 2026, 3) === false && inMonth(undefined, 2026, 3) === false);

  // --- cash predicates (Wave 30 double-count fix) ---
  const income = as<Payment>({ paymentType: 'income' });
  check('pred-income-in', isCashInflow(income) === true && isCashOutflow(income) === false);
  const buyer = as<Payment>({ recipientType: 'apartment_buyer' });
  check('pred-buyer-once', isCashInflow(buyer) === true && isCashOutflow(buyer) === false);
  const expensePay = as<Payment>({ paymentType: 'expense' });
  check('pred-expense-out', isCashInflow(expensePay) === false && isCashOutflow(expensePay) === true);
  const legacy = as<Payment>({});
  check('pred-legacy-out', isCashOutflow(legacy) === true);

  // --- sales collection fallback (Wave 30 zero-fallback fix) ---
  check('collect-basic', collectedFromSales(as<ApartmentUnit[]>([
    { downPayment: 5000, amountReceived: 12000 },
  ])) === 12000);
  check('collect-mirrors-ignored', collectedFromSales(as<ApartmentUnit[]>([
    { downPaymentUSD: 999, paidAmountUSD: 888 },
  ])) === 0);
  check('collect-empty', collectedFromSales([]) === 0);

  // --- margin + rounding ---
  check('margin-basic', profitMargin(1000, 750) === 25);
  check('margin-zero-rev', profitMargin(0, 5) === 0);
  check('margin-full', profitMargin(100, 0) === 100);
  check('round-float', roundMoney(0.1 + 0.2) === 0.3);
  check('round-half-up', roundMoney(10.005) === 10.01);

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
