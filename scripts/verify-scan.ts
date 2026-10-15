/**
 * Wave 25 verification: scan engine (pure) + attachment helpers.
 * Run: npm run test:scan
 */
import {
  sniffImageMime,
  sniffPdf,
  validateUploadBytes,
  solveLinear,
  homography,
  invertMat3,
  applyMat3,
  warpPerspective,
  otsuThreshold,
  applyAdjust,
  encodePdfFromJpegs,
  bytesToDataUrl,
  dataUrlToBytes,
  SCAN_LIMITS,
  type RawImage,
} from '../src/utils/scanEngine';
import {
  normalizeAttachments,
  attachmentSrc,
  totalAttachmentBytes,
  makeAttachment,
  formatBytes,
} from '../src/utils/attachments';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const u8 = (arr: number[]): Uint8Array => new Uint8Array(arr);

function main() {
  // --- magic-byte sniffing ---
  check('sniff-jpeg', sniffImageMime(u8([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])) === 'image/jpeg');
  check('sniff-png', sniffImageMime(u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])) === 'image/png');
  check('sniff-webp', sniffImageMime(u8([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])) === 'image/webp');
  check('sniff-gif', sniffImageMime(u8([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0])) === 'image/gif');
  check('sniff-rejects-svg', sniffImageMime(u8([0x3c, 0x73, 0x76, 0x67, 0, 0, 0, 0, 0, 0, 0, 0])) === null);
  check('sniff-rejects-html', sniffImageMime(u8([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0, 0, 0, 0, 0])) === null);
  check('sniff-rejects-short', sniffImageMime(u8([0xff, 0xd8])) === null);
  check('sniff-pdf', sniffPdf(u8([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])) === true);
  check('sniff-pdf-no', sniffPdf(u8([0x25, 0x50, 0x44, 0x46, 0x58])) === false);

  // --- upload validation ---
  const jpeg = u8([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
  check('val-ok-image', validateUploadBytes(jpeg, false).ok === true);
  check('val-empty', validateUploadBytes(u8([]), true).ok === false);
  check('val-too-large', validateUploadBytes(new Uint8Array(SCAN_LIMITS.maxInputBytes + 1), true).error === 'too-large');
  check('val-pdf-gated', validateUploadBytes(u8([0x25, 0x50, 0x44, 0x46, 0x2d]), false).ok === false);
  check('val-pdf-allowed', validateUploadBytes(u8([0x25, 0x50, 0x44, 0x46, 0x2d]), true).mime === 'application/pdf');
  check('val-svg-rejected', validateUploadBytes(u8([0x3c, 0x73, 0x76, 0x67, 0x3e, 0, 0, 0, 0, 0, 0, 0]), true).error === 'unsupported-type');

  // --- linear algebra ---
  const ident = solveLinear([[1, 0], [0, 1]], [5, 7]);
  check('solve-ident', !!ident && Math.abs(ident[0] - 5) < 1e-9 && Math.abs(ident[1] - 7) < 1e-9);
  check('solve-singular', solveLinear([[1, 2], [2, 4]], [1, 2]) === null);
  const src = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const dst = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
  const h = homography(src, dst);
  check('h-exists', !!h);
  if (h) {
    const p = applyMat3(h, 10, 10);
    check('h-maps-corner', Math.abs(p.x - 20) < 1e-6 && Math.abs(p.y - 20) < 1e-6, `got=${p.x},${p.y}`);
    const inv = invertMat3(h);
    check('h-invert', !!inv);
    if (inv) {
      const q = applyMat3(inv, 20, 20);
      check('h-roundtrip', Math.abs(q.x - 10) < 1e-6 && Math.abs(q.y - 10) < 1e-6);
    }
  }

  // --- warp: full-quad identity preserves content ---
  const mk = (w: number, hgt: number, fn: (x: number, y: number) => [number, number, number]): RawImage => {
    const data = new Uint8ClampedArray(w * hgt * 4);
    for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const o = (y * w + x) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
    return { width: w, height: hgt, data };
  };
  const solid = mk(16, 16, () => [200, 100, 50]);
  const full = { tl: { x: 0, y: 0 }, tr: { x: 1, y: 0 }, br: { x: 1, y: 1 }, bl: { x: 0, y: 1 } };
  const warped = warpPerspective(solid, full, 64);
  check('warp-fullkeeps-size', !!warped && warped.width === 16 && warped.height === 16);
  check('warp-solid-preserved', !!warped && warped.data[0] === 200 && warped.data[1] === 100 && warped.data[2] === 50);
  const half = warpPerspective(solid, { tl: { x: 0, y: 0 }, tr: { x: 0.5, y: 0 }, br: { x: 0.5, y: 1 }, bl: { x: 0, y: 1 } }, 64);
  check('warp-crop-half', !!half && half.width === 8 && half.height === 16, half ? `got=${half.width}x${half.height}` : 'null');
  const degen = warpPerspective(solid, { tl: { x: 0.5, y: 0.5 }, tr: { x: 0.5, y: 0.5 }, br: { x: 0.5, y: 0.5 }, bl: { x: 0.5, y: 0.5 } }, 64);
  check('warp-degenerate-null', degen === null);
  const grad = mk(32, 8, x => [x * 8, 0, 0]);
  const gw = warpPerspective(grad, full, 64);
  check('warp-gradient-kept', !!gw && gw.data[0] <= 4 && gw.data[(31 * 4)] >= 244, gw ? `l=${gw.data[0]} r=${gw.data[124]}` : 'null');

  // --- otsu + adjust ---
  const hist = new Uint32Array(256);
  for (let i = 0; i < 100; i++) hist[10]++;
  for (let i = 0; i < 100; i++) hist[240]++;
  const t = otsuThreshold(hist, 200);
  check('otsu-bimodal', t >= 10 && t < 240, `got=${t}`);
  const gray = applyAdjust(mk(4, 4, () => [200, 100, 50]), { brightness: 0, contrast: 0, sharpness: 0, mode: 'gray' });
  check('adj-gray-equal', gray.data[0] === gray.data[1] && gray.data[1] === gray.data[2]);
  const bright = applyAdjust(mk(2, 2, () => [100, 100, 100]), { brightness: 100, contrast: 0, sharpness: 0, mode: 'color' });
  check('adj-bright-up', bright.data[0] > 150, `got=${bright.data[0]}`);
  const dark = applyAdjust(mk(2, 2, () => [100, 100, 100]), { brightness: -100, contrast: 0, sharpness: 0, mode: 'color' });
  check('adj-bright-down', dark.data[0] < 60, `got=${dark.data[0]}`);
  const bw = applyAdjust(mk(2, 2, () => [200, 200, 200]), { brightness: 0, contrast: 0, sharpness: 0, mode: 'bw', bwThreshold: 127 });
  check('adj-bw-white', bw.data[0] === 255);
  const bw2 = applyAdjust(mk(2, 2, () => [50, 50, 50]), { brightness: 0, contrast: 0, sharpness: 0, mode: 'bw', bwThreshold: 127 });
  check('adj-bw-black', bw2.data[0] === 0);
  const sharp = applyAdjust(mk(5, 5, (x) => (x === 2 ? [255, 255, 255] : [0, 0, 0])), { brightness: 0, contrast: 0, sharpness: 100, mode: 'color' });
  check('adj-sharp-runs', sharp.width === 5 && sharp.data.length === 100);

  // --- pdf writer ---
  const fakeJpeg = u8([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = encodePdfFromJpegs([{ jpeg: fakeJpeg, width: 100, height: 200 }]);
  const head = String.fromCharCode(...pdf.subarray(0, 8));
  const tail = String.fromCharCode(...pdf.subarray(pdf.length - 5));
  check('pdf-header', head.startsWith('%PDF-1.4'), head);
  check('pdf-eof', tail === '%%EOF', tail);
  check('pdf-sniffable', sniffPdf(pdf) === true);
  const pdf2 = encodePdfFromJpegs([
    { jpeg: fakeJpeg, width: 100, height: 100 },
    { jpeg: fakeJpeg, width: 100, height: 100 },
  ]);
  const txt = String.fromCharCode(...pdf2.subarray(0, 400));
  check('pdf-two-pages', txt.includes('/Count 2'));
  let threw = false;
  try { encodePdfFromJpegs([]); } catch { threw = true; }
  check('pdf-empty-throws', threw);

  // --- dataurl roundtrip ---
  const durl = bytesToDataUrl(u8([1, 2, 3, 250]), 'image/jpeg');
  check('durl-prefix', durl.startsWith('data:image/jpeg;base64,'));
  const back = dataUrlToBytes(durl);
  check('durl-roundtrip', !!back && back.mime === 'image/jpeg' && back.bytes.length === 4 && back.bytes[3] === 250);
  check('durl-reject-js', dataUrlToBytes('javascript:alert(1)') === null);
  check('durl-reject-plain', dataUrlToBytes('data:text/html,<b>x</b>') === null);

  // --- attachments ---
  const legacy = normalizeAttachments(['data:image/jpeg;base64,/9j/']);
  check('att-legacy-norm', legacy.length === 1 && legacy[0].kind === 'photo' && legacy[0].mime === 'image/jpeg');
  check('att-empty', normalizeAttachments(undefined).length === 0);
  const made = makeAttachment({ name: 'bill-1', kind: 'scan', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,xx', size: 1000 });
  check('att-made', !!made.id && made.uploadedAt.length > 0 && made.size === 1000);
  check('att-src-ok', attachmentSrc(made) === made.data);
  check('att-src-reject', attachmentSrc({ ...made, data: 'javascript:alert(1)' }) === null);
  check('att-src-reject-svg', attachmentSrc({ ...made, data: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }) === null);
  check('att-total', totalAttachmentBytes(['data:image/jpeg;base64,/9j/', made]) > 1000);
  check('att-fmt', formatBytes(1536) === '2 KB' && formatBytes(2_500_000) === '2.4 MB');

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
