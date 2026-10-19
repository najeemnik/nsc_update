/**
 * Wave 25 — bill scanner engine.
 *
 * Pure, dependency-free image pipeline (works offline, no WASM, no CDN):
 *  validate → load → flatten (4-corner perspective warp) → enhance
 *  (brightness / contrast / sharpness / color·gray·B&W) → image or PDF output.
 *
 * Security: every input is re-decoded through the browser image pipeline and
 * re-encoded to JPEG/PNG — no uploaded byte is ever stored or rendered as-is.
 * Only raster images are accepted (JPEG/PNG/WebP/GIF-first-frame); SVG, HTML,
 * PDF and executables are rejected by magic bytes, never by extension/MIME.
 */

export interface CornerPoints {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
}

export interface ScanAdjust {
  brightness: number; // -100..100
  contrast: number;   // -100..100
  sharpness: number;  // 0..100
  mode: 'color' | 'gray' | 'bw';
  bwThreshold?: number; // 0..255, default Otsu
}

export interface RawImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

/** Hard caps (DoS / quota protection). */
export const SCAN_LIMITS = {
  maxInputBytes: 15 * 1024 * 1024,
  maxPixels: 24_000_000,
  maxOutputDim: 2480,      // ~A4 @300dpi long edge
  defaultOutputDim: 1754,  // ~A4 @200dpi — crisp bills, small files
  jpegQuality: 0.85,
  maxStoredBytes: 2_500_000,
} as const;

const JPEG_SOI = [0xff, 0xd8, 0xff];
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

const startsWith = (b: Uint8Array, sig: number[]): boolean =>
  sig.every((v, i) => b[i] === v);

/** Detect a raster image from magic bytes. Returns canonical MIME or null. */
export const sniffImageMime = (bytes: Uint8Array): string | null => {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, JPEG_SOI)) return 'image/jpeg';
  if (startsWith(bytes, PNG_SIG)) return 'image/png';
  if (startsWith(bytes, WEBP_RIFF) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (startsWith(bytes, GIF87) || startsWith(bytes, GIF89)) return 'image/gif';
  return null;
};

/** Detect a PDF from magic bytes (%PDF-). */
export const sniffPdf = (bytes: Uint8Array): boolean =>
  bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;

export interface FileCheck {
  ok: boolean;
  mime?: string;
  error?: string;
}

/**
 * Validate raw upload bytes. Images are re-encoded downstream; PDFs are
 * accepted for ATTACHMENT ONLY (never rendered from raw bytes — sandboxed).
 */
export const validateUploadBytes = (bytes: Uint8Array, allowPdf: boolean): FileCheck => {
  if (!bytes || bytes.length === 0) return { ok: false, error: 'empty-file' };
  if (bytes.length > SCAN_LIMITS.maxInputBytes) return { ok: false, error: 'too-large' };
  const img = sniffImageMime(bytes);
  if (img) return { ok: true, mime: img };
  if (allowPdf && sniffPdf(bytes)) return { ok: true, mime: 'application/pdf' };
  return { ok: false, error: 'unsupported-type' };
};

// ---------------- homography (4-corner flatten) ----------------

type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Solve Ax=b via Gauss-Jordan (n=8). Returns null when singular. */
export const solveLinear = (a: number[][], b: number[]): number[] | null => {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const div = m[col][col];
    for (let c = col; c <= n; c++) m[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col];
      if (f !== 0) for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map(row => row[n]);
};

/** Homography mapping src quad → dst quad (point order TL,TR,BR,BL). */
export const homography = (
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[],
): Mat3 | null => {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: xp, y: yp } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -xp * x, -xp * y]);
    b.push(xp);
    a.push([0, 0, 0, x, y, 1, -yp * x, -yp * y]);
    b.push(yp);
  }
  const h = solveLinear(a, b);
  return h ? [...h, 1] as Mat3 : null;
};

export const invertMat3 = (m: Mat3): Mat3 | null => {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  return [
    A / det, (c * h - b * i) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, (c * d - a * f) / det,
    C / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
};

export const applyMat3 = (m: Mat3, x: number, y: number): { x: number; y: number } => {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
};

const quadSize = (c: CornerPoints): { w: number; h: number } => {
  const dist = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    Math.hypot(p.x - q.x, p.y - q.y);
  const w = Math.max(dist(c.tl, c.tr), dist(c.bl, c.br));
  const h = Math.max(dist(c.tl, c.bl), dist(c.tr, c.br));
  return { w, h };
};

/** Default corners: 4% inset quad (fractions of width/height). */
export const defaultCorners = (): CornerPoints => ({
  tl: { x: 0.04, y: 0.04 },
  tr: { x: 0.96, y: 0.04 },
  br: { x: 0.96, y: 0.96 },
  bl: { x: 0.04, y: 0.96 },
});

/**
 * Warp src by corners (fractions 0..1) into a flat rectangle.
 * Pure function over pixel buffers — canvas-agnostic and unit-testable.
 */
export const warpPerspective = (
  src: RawImage,
  corners: CornerPoints,
  outLongEdge: number = SCAN_LIMITS.defaultOutputDim,
): RawImage | null => {
  const px = (p: { x: number; y: number }) => ({
    x: Math.min(1, Math.max(0, p.x)) * src.width,
    y: Math.min(1, Math.max(0, p.y)) * src.height,
  });
  const s = [px(corners.tl), px(corners.tr), px(corners.br), px(corners.bl)];
  const { w, h } = quadSize({ tl: s[0], tr: s[1], br: s[2], bl: s[3] });
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 8 || h < 8) return null;
  const scale = Math.min(1, outLongEdge / Math.max(w, h));
  const ow = Math.max(8, Math.round(w * scale));
  const oh = Math.max(8, Math.round(h * scale));
  if (ow * oh > SCAN_LIMITS.maxPixels) return null;
  const d = [
    { x: 0, y: 0 }, { x: ow, y: 0 }, { x: ow, y: oh }, { x: 0, y: oh },
  ];
  const hMat = homography(d, s); // dst → src (inverse map, no holes)
  if (!hMat) return null;
  const out = new Uint8ClampedArray(ow * oh * 4);
  const sw = src.width;
  const sh = src.height;
  const sd = src.data;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const p = applyMat3(hMat, x + 0.5, y + 0.5);
      const sx = Math.min(sw - 1, Math.max(0, p.x));
      const sy = Math.min(sh - 1, Math.max(0, p.y));
      // bilinear sample
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const oi = (y * ow + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v00 = sd[(y0 * sw + x0) * 4 + ch];
        const v10 = sd[(y0 * sw + x1) * 4 + ch];
        const v01 = sd[(y1 * sw + x0) * 4 + ch];
        const v11 = sd[(y1 * sw + x1) * 4 + ch];
        out[oi + ch] = (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
      }
      out[oi + 3] = 255;
    }
  }
  return { width: ow, height: oh, data: out };
};

// ---------------- enhancement ----------------

/** Otsu's optimal B&W threshold from a luma histogram. */
export const otsuThreshold = (hist: number[] | Uint32Array, total: number): number => {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestT = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return bestT;
};

export const defaultAdjust = (): ScanAdjust => ({
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  mode: 'color',
});

/**
 * Apply brightness/contrast/sharpness/mode to a pixel buffer (in place).
 * level = brightness -100..100, contrast -100..100, sharpness 0..100.
 */
export const applyAdjust = (img: RawImage, adj: ScanAdjust): RawImage => {
  const { width: w, height: h, data: d } = img;
  const bShift = (adj.brightness / 100) * 90;
  const cGain = adj.contrast >= 0
    ? 1 + (adj.contrast / 100) * 1.6
    : 1 + (adj.contrast / 100) * 0.7;
  const mode = adj.mode;
  let bwT = 127;
  if (mode === 'bw' && adj.bwThreshold === undefined) {
    const hist = new Uint32Array(256);
    const step = Math.max(1, Math.floor((w * h) / 60000));
    let n = 0;
    for (let i = 0; i < w * h; i += step) {
      const o = i * 4;
      hist[Math.round(0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2])]++;
      n++;
    }
    bwT = otsuThreshold(hist, n);
  } else if (adj.bwThreshold !== undefined) {
    bwT = adj.bwThreshold;
  }

  const lumaOf = (o: number) => 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];

  // sharpen kernel strength 0..1
  const k = Math.min(1, Math.max(0, adj.sharpness / 100));
  if (k > 0) {
    // work from a copy so neighbours stay original; result lands in d
    const src = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const o = (y * w + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const lap =
            4 * src[o + ch] -
            src[o - 4 + ch] - src[o + 4 + ch] - src[o - w * 4 + ch] - src[o + w * 4 + ch];
          d[o + ch] = src[o + ch] + (lap * k * 0.5);
        }
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    let r = d[o];
    let g = d[o + 1];
    let b = d[o + 2];
    if (mode !== 'color') {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (mode === 'bw') {
        const v = l >= bwT ? 255 : 0;
        r = v; g = v; b = v;
      } else {
        r = l; g = l; b = l;
      }
    }
    if (mode !== 'bw') {
      r = (r - 128) * cGain + 128 + bShift;
      g = (g - 128) * cGain + 128 + bShift;
      b = (b - 128) * cGain + 128 + bShift;
    } else if (bShift !== 0) {
      // brightness shifts the threshold instead of washing out B&W
      const shifted = lumaOf(o) + bShift >= bwT ? 255 : 0;
      r = shifted; g = shifted; b = shifted;
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  return img;
};

// ---------------- minimal PDF writer (no dependency) ----------------

const asciiBytes = (s: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
};

/**
 * Build a multi-page PDF embedding one JPEG per page (DCTDecode).
 * `pages`: raw JPEG bytes + pixel size each. Pure function — testable in Node.
 */
export const encodePdfFromJpegs = (
  pages: { jpeg: Uint8Array; width: number; height: number }[],
): Uint8Array => {
  if (pages.length === 0) throw new Error('no-pages');
  const chunks: number[][] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (bytes: number[] | Uint8Array) => {
    const arr = Array.isArray(bytes) ? bytes : Array.from(bytes);
    chunks.push(arr);
    len += arr.length;
  };
  push(asciiBytes('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
  const obj = (n: number, body: number[] | Uint8Array) => {
    offsets[n] = len;
    push(asciiBytes(`${n} 0 obj\n`));
    push(body);
    push(asciiBytes('\nendobj\n'));
  };
  const pageCount = pages.length;
  const imgObjStart = 3 + pageCount * 2;
  // 1: catalog, 2: pages
  obj(1, asciiBytes('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, asciiBytes(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`));
  pages.forEach((pg, i) => {
    const pageObj = 3 + i * 2;
    const contentObj = 4 + i * 2;
    const imgObj = imgObjStart + i;
    // 72dpi page sized to image aspect, capped to A4-ish ratio
    const wPt = Math.min(595, Math.max(200, Math.round((pg.width / pg.height) * 500)));
    const hPt = Math.round((wPt * pg.height) / pg.width);
    obj(pageObj, asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>`));
    const content = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im0 Do\nQ\n`;
    obj(contentObj, asciiBytes(`<< /Length ${content.length} >>\nstream\n${content}endstream`));
  });
  pages.forEach((pg, i) => {
    const head = `<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`;
    offsets[imgObjStart + i] = len;
    push(asciiBytes(`${imgObjStart + i} 0 obj\n`));
    push(asciiBytes(head));
    push(pg.jpeg);
    push(asciiBytes('\nendstream\nendobj\n'));
  });
  const xrefAt = len;
  const totalObjs = imgObjStart + pageCount;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= totalObjs; n++) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  push(asciiBytes(xref));
  push(asciiBytes(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`));
  const out = new Uint8Array(len);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
};

// ---------------- browser helpers (canvas/File — not used in Node tests) ----------------

/** Read a File/Blob fully as bytes (with size pre-check). */
export const readFileBytes = async (file: Blob): Promise<Uint8Array> => {
  if (file.size > SCAN_LIMITS.maxInputBytes) throw new Error('too-large');
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
};

/** Decode bytes to pixels via the browser pipeline (EXIF auto-applied). */
export const decodeToRaw = async (bytes: Uint8Array): Promise<RawImage> => {
  const blob = new Blob([bytes as unknown as BlobPart], { type: sniffImageMime(bytes) || 'image/jpeg' });
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    bmp = await createImageBitmap(blob);
  }
  if (bmp.width * bmp.height > SCAN_LIMITS.maxPixels) {
    bmp.close();
    throw new Error('too-large');
  }
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bmp.close();
    throw new Error('no-canvas');
  }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: id.data };
};

/** Paint a RawImage into a canvas (sized automatically). */
export const paintToCanvas = (img: RawImage, canvas: HTMLCanvasElement): void => {
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  ctx.putImageData(new ImageData(img.data as Uint8ClampedArray<ArrayBuffer>, img.width, img.height), 0, 0);
};

/** Canvas → JPEG bytes. */
export const canvasToJpegBytes = (canvas: HTMLCanvasElement, quality: number = SCAN_LIMITS.jpegQuality): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('encode-failed'));
          return;
        }
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)), reject);
      },
      'image/jpeg',
      quality,
    );
  });

/** Bytes → data: URL (chunked to avoid stack overflow). */
export const bytesToDataUrl = (bytes: Uint8Array, mime: string): string => {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return `data:${mime};base64,${btoa(bin)}`;
};

/** Parse a data: URL back to bytes + mime (for viewer/download). */
export const dataUrlToBytes = (url: string): { mime: string; bytes: Uint8Array } | null => {
  const m = /^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(url.trim());
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/\s/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { mime: m[1], bytes: out };
  } catch {
    return null;
  }
};
