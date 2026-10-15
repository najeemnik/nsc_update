/**
 * Wave 27 — printable document design system (bill/receipt/voucher/contract).
 *
 * One sanitized `CustomBillDesign` drives every printed document:
 * Office7 (MasterAdmin) per-owner designs + owner self-service in Settings.
 * Custom templates are JSON data files — validated key-by-key, never code.
 */
import type { CustomBillDesign, DocSectionId } from '../types';

export const TEMPLATE_MARKER = 'nsc-doc-design-v1';
export const TEMPLATE_MAX_BYTES = 100 * 1024;

export interface FontOption {
  id: string;
  labelFa: string;
  labelEn: string;
  stack: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'system',
    labelFa: 'سیستمی (پیش‌فرض)',
    labelEn: 'System (default)',
    stack: "system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif",
  },
  {
    id: 'vazir',
    labelFa: 'وزیرمتن / تاهوما (فارسی بهتر)',
    labelEn: 'Vazirmatn / Tahoma',
    stack: "Vazirmatn, Tahoma, 'Segoe UI', system-ui, Arial, sans-serif",
  },
  {
    id: 'formal',
    labelFa: 'رسمی (Serif، قراردادها)',
    labelEn: 'Formal serif (contracts)',
    stack: "Georgia, 'Times New Roman', 'Noto Naskh Arabic', serif",
  },
];

export interface PaperOption {
  id: string;
  labelFa: string;
  labelEn: string;
  cssSize: string;
  maxWidthPx: number;
}

export const PAPER_OPTIONS: PaperOption[] = [
  { id: 'A4', labelFa: 'A4 استاندارد', labelEn: 'A4 standard', cssSize: 'A4', maxWidthPx: 672 },
  { id: 'A5', labelFa: 'A5 نیم‌صفحه', labelEn: 'A5 half page', cssSize: 'A5', maxWidthPx: 480 },
  { id: 'thermal', labelFa: 'حرارتی ۸۰ میلی‌متر', labelEn: '80mm thermal', cssSize: '80mm auto', maxWidthPx: 320 },
];

export const DEFAULT_SECTION_ORDER: DocSectionId[] = [
  'bank',
  'notes',
  'terms',
  'signatures',
  'stamp',
  'qr',
  'footer',
];

export const SECTION_LABELS: Record<DocSectionId, { fa: string; en: string }> = {
  bank: { fa: 'مشخصات بانکی', en: 'Bank details' },
  notes: { fa: 'یادداشت', en: 'Notes' },
  terms: { fa: 'شرایط', en: 'Terms' },
  signatures: { fa: 'امضاها', en: 'Signatures' },
  stamp: { fa: 'محل مهر', en: 'Stamp box' },
  qr: { fa: 'کد اصالت (QR)', en: 'QR verification' },
  footer: { fa: 'پاورقی', en: 'Footer' },
};

export const DEFAULT_DESIGN: Required<Pick<CustomBillDesign,
  'primaryColor' | 'accentColor' | 'paperSize' | 'fontFamily' | 'fontScale' |
  'marginMm' | 'logoSize' | 'logoPosition' | 'borderStyle' | 'sectionOrder'>> = {
  primaryColor: '#0f172a',
  accentColor: '#d97706',
  paperSize: 'A4',
  fontFamily: 'system',
  fontScale: 1,
  marginMm: 12,
  logoSize: 56,
  logoPosition: 'start',
  borderStyle: 'solid',
  sectionOrder: [...DEFAULT_SECTION_ORDER],
};

const TEXT_CAPS: Record<string, number> = {
  receiptTitle: 80,
  receiptHeader: 160,
  receiptSubheader: 160,
  receiptSubtitle: 160,
  receiptFooter: 200,
  receiptContact: 160,
  taxNumber: 40,
  companyAddress: 200,
  companyPhone: 60,
  companyEmail: 80,
  termsAndConditions: 2000,
  bankDetails: 500,
  customNote: 300,
  watermarkText: 60,
  themeColor: 24,
  customNotesHtml: 2000,
};

const cleanText = (v: unknown, cap: number): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  if (!s) return undefined;
  return s.slice(0, cap);
};

const cleanColor = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;

const cleanBool = (v: unknown, fallback: boolean): boolean =>
  v === undefined ? fallback : v === true || v === 'true' || v === 1;

const clampNum = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : (typeof v === 'number' ? v : NaN);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Legacy paper aliases from older Office7 builds. */
const PAPER_ALIASES: Record<string, string> = {
  A4: 'A4',
  A5: 'A5',
  thermal: 'thermal',
  Thermal80mm: 'thermal',
  Letter: 'A4',
  letter: 'A4',
};

const cleanPaper = (v: unknown): CustomBillDesign['paperSize'] => {
  if (typeof v !== 'string') return 'A4';
  return (PAPER_ALIASES[v.trim()] || 'A4') as CustomBillDesign['paperSize'];
};

const KNOWN_SECTIONS = new Set<string>(DEFAULT_SECTION_ORDER);

const cleanSectionOrder = (v: unknown): DocSectionId[] => {
  const out: DocSectionId[] = [];
  if (Array.isArray(v)) {
    for (const id of v) {
      if (typeof id === 'string' && KNOWN_SECTIONS.has(id) && !out.includes(id as DocSectionId)) {
        out.push(id as DocSectionId);
      }
    }
  }
  for (const id of DEFAULT_SECTION_ORDER) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
};

/**
 * Strict whitelist sanitizer — the ONLY way template JSON becomes a design.
 * Unknown keys dropped, colors/fonts/papers allow-listed, text capped.
 */
export const sanitizeDesign = (input: unknown): CustomBillDesign => {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const d: CustomBillDesign = {};
  for (const [key, cap] of Object.entries(TEXT_CAPS)) {
    const cleaned = cleanText(src[key], cap);
    if (cleaned !== undefined) (d as Record<string, unknown>)[key] = cleaned;
  }
  d.primaryColor = cleanColor(src.primaryColor, DEFAULT_DESIGN.primaryColor);
  d.accentColor = cleanColor(src.accentColor, DEFAULT_DESIGN.accentColor);
  d.themeColor = cleanText(src.themeColor, 24);
  d.paperSize = cleanPaper(src.paperSize);
  const fontId = typeof src.fontFamily === 'string' ? src.fontFamily.trim() : '';
  d.fontFamily = FONT_OPTIONS.some(f => f.id === fontId) ? fontId : 'system';
  d.fontScale = Math.round(clampNum(src.fontScale, 0.85, 1.3, 1) * 100) / 100;
  d.marginMm = Math.round(clampNum(src.marginMm, 4, 25, 12));
  d.logoSize = Math.round(clampNum(src.logoSize, 28, 96, 56));
  const lp = typeof src.logoPosition === 'string' ? src.logoPosition.trim() : '';
  d.logoPosition = lp === 'end' || lp === 'right' || lp === 'left' || lp === 'center' ? lp : 'start';
  const bs = typeof src.borderStyle === 'string' ? src.borderStyle.trim() : '';
  d.borderStyle = bs === 'double' || bs === 'dashed' || bs === 'dotted' || bs === 'none' ? bs : 'solid';
  d.sectionOrder = cleanSectionOrder(src.sectionOrder);
  d.showStampArea = cleanBool(src.showStampArea, false);
  d.showStampSignature = cleanBool(src.showStampSignature, true);
  d.showWatermark = cleanBool(src.showWatermark, false);
  d.showQrCode = cleanBool(src.showQrCode, true);
  d.showWithholdingTax = cleanBool(src.showWithholdingTax, true);
  d.showRetention = cleanBool(src.showRetention, true);
  d.showRetentionBox = cleanBool(src.showRetentionBox, true);
  return d;
};

export interface TemplateParseResult {
  ok: boolean;
  design?: CustomBillDesign;
  error?: 'too-large' | 'invalid-json' | 'not-object';
}

/** Parse an uploaded template file (JSON text). Never throws. */
export const parseTemplateJson = (text: string): TemplateParseResult => {
  if (text.length > TEMPLATE_MAX_BYTES) return { ok: false, error: 'too-large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'not-object' };
  }
  const obj = raw as Record<string, unknown>;
  const inner = obj.design && typeof obj.design === 'object' ? obj.design : obj;
  return { ok: true, design: sanitizeDesign(inner) };
};

/** Serialize the current design as a downloadable template file. */
export const exportTemplate = (design: CustomBillDesign, companyName?: string): string =>
  JSON.stringify({
    templateKind: TEMPLATE_MARKER,
    app: 'nsc-construction-finance',
    exportedAt: new Date().toISOString(),
    companyName: (companyName || '').slice(0, 120),
    design: sanitizeDesign(design),
  }, null, 2);

/** Overlay wins per key; undefined never erases the base. */
export const mergeDesign = (
  base?: CustomBillDesign,
  overlay?: CustomBillDesign,
): CustomBillDesign => {
  const out: Record<string, unknown> = { ...(base || {}) };
  if (overlay) {
    for (const [k, v] of Object.entries(overlay)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return sanitizeDesign(out);
};

export const paperOptionOf = (id?: string): PaperOption =>
  PAPER_OPTIONS.find(p => p.id === (PAPER_ALIASES[id || ''] || id)) || PAPER_OPTIONS[0];

export const fontStackOf = (id?: string): string =>
  FONT_OPTIONS.find(f => f.id === id)?.stack || FONT_OPTIONS[0].stack;

/** Short offline-verifiable checksum for QR payloads. */
export const qrChecksum = (s: string): string => {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i) * (i + 1)) % 9973;
  return sum.toString(36).toUpperCase().padStart(3, '0');
};

/** Verification payload encoded in the printed QR code. */
export const qrPayload = (parts: {
  company: string;
  docNo: string;
  date: string;
  usd: number;
  afn: number;
}): string => {
  const core = [
    'NSC1',
    parts.company.slice(0, 40).replace(/[|]/g, ''),
    parts.docNo.slice(0, 40).replace(/[|]/g, ''),
    parts.date.slice(0, 16).replace(/[|]/g, ''),
    Number(parts.usd).toFixed(2),
    Math.round(Number(parts.afn)).toString(),
  ].join('|');
  return `${core}|${qrChecksum(core)}`;
};

/** {{variable}} substitution for composed documents. Unknown keys stay literal. */
export const substituteDocVars = (body: string, vars: Record<string, string>): string =>
  body.replace(/\{\{\s*([a-zA-Z0-9_]{1,32})\s*\}\}/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : m,
  );
