/**
 * Wave 27 verification: document design sanitizer, templates, QR payload, vars.
 * Run: npm run test:docdesign
 */
import {
  sanitizeDesign,
  parseTemplateJson,
  exportTemplate,
  mergeDesign,
  paperOptionOf,
  fontStackOf,
  qrChecksum,
  qrPayload,
  substituteDocVars,
  DEFAULT_SECTION_ORDER,
  TEMPLATE_MARKER,
} from '../src/utils/docDesign';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

function main() {
  // --- sanitize: whitelist + caps ---
  const evil = sanitizeDesign({
    primaryColor: 'red',
    accentColor: '#12ab',
    receiptTitle: 'x'.repeat(500),
    paperSize: 'EvilPaper',
    fontFamily: 'comic-evil',
    fontScale: 99,
    marginMm: -5,
    logoSize: 5000,
    sectionOrder: ['qr', 'qr', 'nope', 'bank'],
    showQrCode: 'yes',
    __proto__: { polluted: true },
    constructor: { x: 1 },
    customNotesHtml: '<script>alert(1)</script>',
  } as unknown as object);
  check('san-color-fallback', evil.primaryColor === '#0f172a' && evil.accentColor === '#d97706');
  check('san-text-cap', (evil.receiptTitle || '').length === 80);
  check('san-paper-fallback', evil.paperSize === 'A4');
  check('san-font-fallback', evil.fontFamily === 'system');
  check('san-clamps', evil.fontScale === 1.3 && evil.marginMm === 4 && evil.logoSize === 96);
  check('san-sections', JSON.stringify(evil.sectionOrder) === JSON.stringify(['qr', 'bank', 'notes', 'terms', 'signatures', 'stamp', 'footer']), JSON.stringify(evil.sectionOrder));
  check('san-bool-strict', evil.showQrCode === false); // only true/'true'/1 count as true
  check('san-no-proto', !('polluted' in ({} as Record<string, unknown>)) && !('polluted' in (evil as Record<string, unknown>)));
  check('san-html-kept-text', evil.customNotesHtml === '<script>alert(1)</script>'); // stored as inert text; never rendered as HTML

  const legacy = sanitizeDesign({ paperSize: 'Thermal80mm' });
  check('san-legacy-thermal', legacy.paperSize === 'thermal');
  check('san-legacy-letter', sanitizeDesign({ paperSize: 'Letter' }).paperSize === 'A4');
  check('san-empty', sanitizeDesign(undefined).paperSize === 'A4' && sanitizeDesign(null).fontFamily === 'system');
  check('san-default-order', JSON.stringify(sanitizeDesign({}).sectionOrder) === JSON.stringify(DEFAULT_SECTION_ORDER));

  // --- template parse ---
  check('tpl-too-large', parseTemplateJson('x'.repeat(101 * 1024)).error === 'too-large');
  check('tpl-bad-json', parseTemplateJson('{nope').error === 'invalid-json');
  check('tpl-not-object', parseTemplateJson('[1,2]').error === 'not-object');
  check('tpl-bare', parseTemplateJson('{"primaryColor":"#112233"}').design?.primaryColor === '#112233');
  const wrapped = parseTemplateJson(JSON.stringify({ templateKind: TEMPLATE_MARKER, design: { paperSize: 'A5' } }));
  check('tpl-wrapped', wrapped.ok === true && wrapped.design?.paperSize === 'A5');
  const evilTpl = parseTemplateJson('{"primaryColor":"javascript:alert(1)","sectionOrder":["bank","<img>"]}');
  check('tpl-evil-sanitized', evilTpl.design?.primaryColor === '#0f172a' && (evilTpl.design?.sectionOrder || [])[0] === 'bank');

  // --- export roundtrip ---
  const exported = exportTemplate({ primaryColor: '#aabbcc', paperSize: 'A5' }, 'Test Co');
  check('exp-marker', exported.includes(TEMPLATE_MARKER));
  const rt = parseTemplateJson(exported);
  check('exp-roundtrip', rt.ok === true && rt.design?.primaryColor === '#aabbcc' && rt.design?.paperSize === 'A5');

  // --- merge ---
  const merged = mergeDesign({ primaryColor: '#111111', receiptTitle: 'Base' }, { primaryColor: '#222222', receiptTitle: undefined });
  check('merge-wins', merged.primaryColor === '#222222');
  check('merge-undefined-keeps', merged.receiptTitle === 'Base');

  // --- paper/font lookups ---
  check('paper-a4', paperOptionOf('A4').cssSize === 'A4');
  check('paper-alias', paperOptionOf('Thermal80mm').id === 'thermal');
  check('paper-fallback', paperOptionOf('???').id === 'A4');
  check('font-stack', fontStackOf('formal').includes('Georgia'));
  check('font-fallback', fontStackOf('nope').includes('system-ui'));

  // --- qr payload ---
  const c1 = qrChecksum('abc');
  check('qr-checksum-deterministic', c1 === qrChecksum('abc') && c1.length === 3);
  const p = qrPayload({ company: 'Test|Co', docNo: 'PAY-1', date: '2026-01-02', usd: 10.5, afn: 735 });
  const parts = p.split('|');
  check('qr-shape', parts.length === 7 && parts[0] === 'NSC1' && parts[1] === 'TestCo', p);
  check('qr-checksum-verifies', parts[6] === qrChecksum(parts.slice(0, 6).join('|')));
  check('qr-money', parts[4] === '10.50' && parts[5] === '735');

  // --- composed-doc variables ---
  check('vars-basic', substituteDocVars('Hello {{name}}!', { name: 'Ali' }) === 'Hello Ali!');
  check('vars-spaces', substituteDocVars('{{  date  }}', { date: '2026' }) === '2026');
  check('vars-unknown-kept', substituteDocVars('{{nope}}', {}) === '{{nope}}');
  check('vars-multi', substituteDocVars('{{a}}-{{a}}', { a: 'x' }) === 'x-x');
  check('vars-no-eval', substituteDocVars('{{__proto__}}', {}) === '{{__proto__}}');

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
