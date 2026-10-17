/**
 * Wave 32 verification: visual builder engine (ops / history / sanitize / export).
 * Run: npm run test:builder
 */
import {
  BUILDER_MAX_BLOCKS,
  createBlock,
  dashboardPageKey,
  defaultDashboardLayout,
  duplicateBlock,
  exportLayoutHTML,
  moveBlock,
  moveBlockTo,
  parseLayoutFile,
  pushHistory,
  redoHistory,
  removeBlock,
  sanitizeBlock,
  sanitizeLayout,
  sanitizeStyle,
  undoHistory,
  updateBlock,
  updateBlockStyle,
  canUseBuilder,
  type BuilderBlock,
  type BuilderHistory,
  type PageLayout,
} from '../src/utils/pageBuilder';
import type { User } from '../src/types';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const asUser = (o: object): User => o as unknown as User;
const throws = (fn: () => unknown): boolean => {
  try { fn(); return false; } catch { return true; }
};
const mk = (type: BuilderBlock['type'] = 'text', extra: Partial<BuilderBlock> = {}): BuilderBlock =>
  ({ id: `t_${Math.random().toString(36).slice(2)}`, type, ...extra });

function main() {
  // --- factories ---
  const h = createBlock('heading');
  check('create-heading-defaults', h.text === 'عنوان جدید' && h.level === 2 && h.id.length > 4);
  check('create-button-defaults', createBlock('button').targetTab === 'reports');
  check('create-stat-defaults', createBlock('stat').statKind === 'expenses');
  const dd = defaultDashboardLayout();
  check('default-layout', dd.version === 1 && dd.blocks.length === 4
    && dd.blocks.map(b => b.refId).join(',') === 'banner,statCards,charts,recentGrid');

  // --- move / update / remove / duplicate ---
  const three = [mk('text', { id: 'a' }), mk('text', { id: 'b' }), mk('text', { id: 'c' })];
  check('move-up', moveBlock(three, 'b', -1).map(b => b.id).join('') === 'bac');
  check('move-bounds', moveBlock(three, 'a', -1) === three && moveBlock(three, 'zzz', 1) === three);
  check('move-to', moveBlockTo(three, 'a', 2).map(b => b.id).join('') === 'bca');
  check('move-to-clamp', moveBlockTo(three, 'c', 99).map(b => b.id).join('') === 'abc');
  const upd = updateBlock(three, 'b', { text: 'hi', id: 'HACK', type: 'image' });
  check('update-keeps-id-type', upd[1].id === 'b' && upd[1].type === 'text' && upd[1].text === 'hi');
  const sty = updateBlockStyle(three, 'a', { fontSize: 999, color: 'red', marginTop: -5 });
  check('style-clamped', sty[0].style?.fontSize === 96 && sty[0].style?.color === 'red' && sty[0].style?.marginTop === 0);
  check('remove', removeBlock(three, 'b').length === 2);
  const dup = duplicateBlock(three, 'a');
  check('duplicate', dup.length === 4 && dup[1].type === 'text' && dup[1].id !== 'a');
  const full = Array.from({ length: BUILDER_MAX_BLOCKS }, (_, i) => mk('text', { id: `f${i}` }));
  check('duplicate-cap', duplicateBlock(full, 'f0') === full);

  // --- history ---
  const lay = (n: number): PageLayout => ({ version: 1, updatedAt: '', blocks: [mk('text', { id: `l${n}` })] });
  let hist: BuilderHistory = { past: [], future: [] };
  hist = pushHistory(hist, lay(1));
  hist = pushHistory(hist, lay(2));
  const u1 = undoHistory(hist, lay(3));
  check('undo', !!u1 && u1.layout.blocks[0].id === 'l2' && u1.history.future.length === 1);
  const r1 = u1 ? redoHistory(u1.history, u1.layout) : null;
  check('redo', !!r1 && r1.layout.blocks[0].id === 'l3');
  check('undo-empty', undoHistory({ past: [], future: [] }, lay(9)) === null);
  let big: BuilderHistory = { past: [], future: [] };
  for (let i = 0; i < 60; i += 1) big = pushHistory(big, lay(i));
  check('history-cap', big.past.length === 50);

  // --- sanitize block ---
  check('block-unknown-type', sanitizeBlock({ type: 'marquee', text: 'x' }).type === 'text');
  check('block-ref-fallback', sanitizeBlock({ type: 'dashboard_section', refId: 'evil' }).refId === 'banner');
  check('block-js-url-dropped', sanitizeBlock({ type: 'image', url: 'javascript:alert(1)' }).url === undefined);
  check('block-https-kept', sanitizeBlock({ type: 'image', url: 'https://x.test/a.png' }).url === 'https://x.test/a.png');
  check('block-dataimg-kept', sanitizeBlock({ type: 'image', url: 'data:image/png;base64,AAA' }).url === 'data:image/png;base64,AAA');
  check('block-tab-regex', sanitizeBlock({ type: 'button', targetTab: '../admin' }).targetTab === undefined
    && sanitizeBlock({ type: 'button', targetTab: 'reports' }).targetTab === 'reports');
  check('block-level', sanitizeBlock({ type: 'heading', level: 9 }).level === undefined);
  check('block-hidden', sanitizeBlock({ type: 'text', hidden: true }).hidden === true
    && sanitizeBlock({ type: 'text', hidden: 'yes' }).hidden === undefined);
  check('block-text-cap', (sanitizeBlock({ type: 'text', text: 'x'.repeat(6000) }).text || '').length === 5000);

  // --- sanitize style ---
  check('style-evil-color', sanitizeStyle({ color: 'expression(alert(1))' }) === undefined);
  check('style-hex-ok', sanitizeStyle({ color: '#aabbcc', background: 'white' })?.background === 'white');
  check('style-align', sanitizeStyle({ align: 'middle' }) === undefined && sanitizeStyle({ align: 'center' })?.align === 'center');

  // --- sanitize layout ---
  check('layout-fallback', sanitizeLayout(null).blocks.length === 4 && sanitizeLayout({ blocks: [] }).blocks.length === 4);
  const capped = sanitizeLayout({ blocks: Array.from({ length: 150 }, () => ({ type: 'text', text: 't' })) });
  check('layout-cap-100', capped.blocks.length === 100, String(capped.blocks.length));

  // --- page key ---
  check('pagekey', dashboardPageKey('  ACME Co  ') === 'dashboard::ACME Co' && dashboardPageKey() === 'dashboard::default');

  // --- import/export ---
  const file = JSON.stringify({ kind: 'nsc-builder-layout', version: 1, layout: lay(1) });
  check('parse-wrapped', parseLayoutFile(file).blocks.length === 1);
  check('parse-bare', parseLayoutFile(JSON.stringify(lay(2))).blocks.length === 1);
  check('parse-broken', throws(() => parseLayoutFile('{nope')));
  check('parse-oversized', throws(() => parseLayoutFile(`{"blocks":[],"pad":"${'y'.repeat(400 * 1024)}"}`)));
  const evilLayout: PageLayout = {
    version: 1, updatedAt: '', blocks: [
      mk('text', { text: '<script>alert("x")</script>' }),
      mk('image', { url: 'https://x.test/a.png', text: '"><img src=x onerror=1>' }),
      mk('dashboard_section', { refId: 'charts' }),
    ],
  };
  const html = exportLayoutHTML(evilLayout, 'T<title>');
  check('html-escaped', !html.includes('<script>') && html.includes('&lt;script&gt;')
    && html.includes('&quot;') && html.includes('T&lt;title&gt;'));
  check('html-section-comment', html.includes('<!-- live section: charts -->'));

  // --- access ---
  check('access-null', canUseBuilder(null) === false);
  check('access-master', canUseBuilder(asUser({ isMasterSuperAdmin: true, role: 'admin' })) === true);
  check('access-owner', canUseBuilder(asUser({ role: 'admin' })) === false);
  check('access-employee-denied', canUseBuilder(asUser({ role: 'employee', permissions: {} })) === false);
  check('access-employee-grant', canUseBuilder(asUser({ role: 'employee', permissions: { allowedTabs: ['builder'] } })) === false);

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
