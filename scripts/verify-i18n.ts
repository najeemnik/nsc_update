/**
 * Wave 33 verification: language system (parity / Afghan terms / display labels).
 * Run: npm run test:i18n
 */
import { translations } from '../src/i18n/translations';
import {
  humanizeKey, labelPaymentMethod, labelExpenseCategory, labelUnit, DOC_CATEGORY_TKEY,
} from '../src/utils/displayLabels';
import { COMMON_CATEGORIES, categoryLabel, findCategoryDef } from '../src/data/expenseCategories';
import { exportLayoutHTML, type PageLayout } from '../src/utils/pageBuilder';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const hasArabic = (s: string): boolean => /[\u0600-\u06FF]/.test(s);

function main() {
  const locales = ['en', 'fa', 'ps'] as const;
  const dicts = locales.map(l => translations[l] as unknown as Record<string, string>);
  const keySets = dicts.map(d => new Set(Object.keys(d)));

  // --- parity ---
  check('three-locales', keySets.every(ks => ks.size > 500), keySets.map(ks => ks.size).join('/'));
  const [enK, faK, psK] = keySets;
  const missingFa = [...enK].filter(k => !faK.has(k));
  const missingPs = [...enK].filter(k => !psK.has(k));
  check('parity-fa', missingFa.length === 0, missingFa.slice(0, 5).join(','));
  check('parity-ps', missingPs.length === 0, missingPs.slice(0, 5).join(','));
  check('nonempty', dicts.every(d => Object.values(d).every(v => typeof v === 'string' && v.trim().length > 0)));

  // --- no language mixing: en values must be Latin-only ---
  const mixed = Object.entries(dicts[0]).filter(([, v]) => hasArabic(v)).map(([k]) => k);
  check('en-latin-only', mixed.length === 0, mixed.slice(0, 5).join(','));

  // --- Afghan terms: no Iranian markers in fa values ---
  const IRANIAN = ['آپارتمان', 'گزارشات', 'خودکار', 'انبار', 'کامپیوتر', 'فاکتور', 'پرونده', 'خودرو', 'تومان'];
  const hits: string[] = [];
  for (const [k, v] of Object.entries(dicts[1])) {
    for (const w of IRANIAN) {
      if (v.includes(w)) { hits.push(`${k}:${w}`); break; }
    }
  }
  check('fa-afghan-terms', hits.length === 0, hits.slice(0, 5).join(','));
  // ... and none of the markers anywhere in fa/ps values
  const hitsPs: string[] = [];
  for (const [k, v] of Object.entries(dicts[2])) {
    if (v.includes('آپارتمان') || v.includes('گزارشات')) { hitsPs.push(k); }
  }
  check('ps-no-iranian-markers', hitsPs.length === 0, hitsPs.slice(0, 5).join(','));

  // --- humanize ---
  check('humanize-camel', humanizeKey('steelRaber') === 'Steel Raber');
  check('humanize-snake', humanizeKey('material_suppliers') === 'Material suppliers');
  check('humanize-fa-passthrough', humanizeKey('کرایه لاری') === 'کرایه لاری');
  check('humanize-empty', humanizeKey(undefined) === '' && humanizeKey('  ') === '');

  // --- categories ---
  check('cat-count', COMMON_CATEGORIES.length === 13 && new Set(COMMON_CATEGORIES.map(c => c.id)).size === 13);
  check('cat-trilingual', COMMON_CATEGORIES.every(c => c.labelEn.trim() && c.labelFa.trim() && c.labelPs.trim()));
  const steel = COMMON_CATEGORIES.find(c => c.id === 'steel')!;
  check('cat-label-pick', categoryLabel(steel, 'en') === 'Steel / Rebar' && categoryLabel(steel, 'fa') === 'سیخ‌گول (فولاد)' && categoryLabel(steel, 'ps') === 'سیخ ګول');
  check('cat-find-cross', findCategoryDef('سیخ‌گول (فولاد)')?.id === 'steel' && findCategoryDef('Steel / Rebar')?.id === 'steel' && findCategoryDef('steel')?.id === 'steel');
  check('label-cat-cross', labelExpenseCategory('steel', 'fa') === 'سیخ‌گول (فولاد)'
    && labelExpenseCategory('سیخ‌گول (فولاد)', 'en') === 'Steel / Rebar');
  check('label-cat-custom', labelExpenseCategory('کرایه لاری شخصی', 'en') === 'کرایه لاری شخصی');
  check('label-cat-id', labelExpenseCategory('dailyLabour', 'en') === 'Daily Labour');

  // --- payments ---
  check('label-pay', labelPaymentMethod('Cash', 'fa') === 'نقدی' && labelPaymentMethod('Bank Transfer', 'ps') === 'بانکي انتقال'
    && labelPaymentMethod('Hawala / Sarafi', 'en') === 'Hawala / Sarafi');
  check('label-pay-legacy', labelPaymentMethod('banktransfer', 'fa') === 'انتقال بانکی' && labelPaymentMethod('Cheque', 'fa') === 'چک بانکی');
  check('label-pay-unknown', labelPaymentMethod('mobileMoney', 'en') === 'Mobile Money' && labelPaymentMethod(undefined, 'fa') === '');

  // --- units ---
  check('label-unit', labelUnit('Ton', 'en') === 'Ton' && labelUnit('Ton', 'ps') === 'ټن');
  check('label-unit-unknown', labelUnit('crateBox', 'en') === 'Crate Box');

  // --- doc categories cover all 7 ids ---
  const docIds = ['permits', 'drawings', 'lab_reports', 'contracts', 'invoices', 'sales_contracts', 'legal'];
  check('doc-keys', docIds.every(id => typeof DOC_CATEGORY_TKEY[id] === 'string')
    && docIds.every(id => typeof (dicts[0] as Record<string, string>)[DOC_CATEGORY_TKEY[id]] === 'string'));

  // --- export dir follows language ---
  const lay: PageLayout = { version: 1, updatedAt: '', blocks: [{ id: 'b1', type: 'text', text: 'hi', style: { align: 'start' } }] };
  const htmlRtl = exportLayoutHTML(lay, 'T');
  const htmlLtr = exportLayoutHTML(lay, 'T', 'ltr');
  check('export-dir', htmlRtl.includes('dir="rtl"') && htmlRtl.includes('lang="fa"')
    && htmlLtr.includes('dir="ltr"') && htmlLtr.includes('lang="en"'));
  check('export-logical-align', htmlRtl.includes('text-align:start'));

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
