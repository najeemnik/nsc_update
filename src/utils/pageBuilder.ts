/**
 * Visual Builder engine — Wave 32.
 *
 * Block model + pure ops (create/move/update/remove/duplicate),
 * undo/redo history, sanitized persistence (draft local / published),
 * JSON import/export and escaped HTML export.
 *
 * Security: every load path goes through sanitizeLayout — block types,
 * style keys and URLs are allow-listed; text is length-capped; the HTML
 * exporter escapes all text/attributes (no raw HTML blocks exist).
 */
import type { User } from '../types';

// ---------- types ----------
export type BuilderBlockType =
  | 'dashboard_section' | 'heading' | 'text' | 'image'
  | 'button' | 'divider' | 'spacer' | 'stat';

export interface BuilderBlockStyle {
  color?: string;
  background?: string;
  fontSize?: number;
  align?: 'start' | 'center' | 'end';
  marginTop?: number;
  marginBottom?: number;
  padding?: number;
  radius?: number;
  widthPct?: number;
}

export interface BuilderBlock {
  id: string;
  type: BuilderBlockType;
  /** dashboard_section → registry id; others → content props */
  refId?: string;
  text?: string;
  url?: string;
  targetTab?: string;
  level?: 1 | 2 | 3;
  statKind?: 'expenses' | 'paid' | 'debt' | 'sales';
  style?: BuilderBlockStyle;
  hidden?: boolean;
}

export interface PageLayout {
  version: 1;
  updatedAt: string;
  blocks: BuilderBlock[];
}

export interface DashboardSectionDef {
  id: string;
  labelFa: string;
  labelEn: string;
}

/** Live dashboard sections the builder can show/hide/reorder. */
export const DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'banner', labelFa: 'بنر خوش‌آمد', labelEn: 'Welcome banner' },
  { id: 'statCards', labelFa: 'کارت‌های آماری', labelEn: 'Stat cards' },
  { id: 'charts', labelFa: 'نمودارها', labelEn: 'Charts' },
  { id: 'recentGrid', labelFa: 'فعالیت‌های اخیر', labelEn: 'Recent activity' },
];

export const DASHBOARD_SECTION_IDS = DASHBOARD_SECTIONS.map(s => s.id);

// ---------- constants ----------
export const BUILDER_MAX_BLOCKS = 100;
export const BUILDER_MAX_TEXT = 5000;
export const BUILDER_MAX_URL = 2000;
export const BUILDER_HISTORY_CAP = 50;
export const BUILDER_FILE_MAX_BYTES = 300 * 1024;

const BLOCK_TYPES: BuilderBlockType[] = [
  'dashboard_section', 'heading', 'text', 'image', 'button', 'divider', 'spacer', 'stat',
];
const STAT_KINDS = ['expenses', 'paid', 'debt', 'sales'] as const;
const ALIGN_VALUES = ['start', 'center', 'end'] as const;

const PUBLISH_PREFIX = 'nsc_builder_pub_v1::';
const DRAFT_PREFIX = 'nsc_builder_draft_v1::';

export const dashboardPageKey = (companyName?: string): string =>
  `dashboard::${(companyName || 'default').trim().slice(0, 80) || 'default'}`;

// ---------- factories ----------
let blockSeq = 0;
export const makeBlockId = (): string =>
  `blk_${Date.now().toString(36)}_${(blockSeq += 1).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const createBlock = (type: BuilderBlockType, partial?: Partial<BuilderBlock>): BuilderBlock => {
  const base: BuilderBlock = { id: makeBlockId(), type, ...partial };
  if (type === 'heading' && base.text === undefined) { base.text = 'عنوان جدید'; base.level = 2; }
  if (type === 'text' && base.text === undefined) base.text = 'متن خود را اینجا بنویسید…';
  if (type === 'button' && base.text === undefined) { base.text = 'دکمه'; base.targetTab = 'reports'; }
  if (type === 'stat' && base.statKind === undefined) base.statKind = 'expenses';
  return base;
};

export const defaultDashboardLayout = (): PageLayout => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  blocks: DASHBOARD_SECTION_IDS.map(refId => ({ id: makeBlockId(), type: 'dashboard_section' as const, refId })),
});

// ---------- pure ops ----------
export const moveBlock = (blocks: BuilderBlock[], id: string, dir: -1 | 1): BuilderBlock[] => {
  const i = blocks.findIndex(b => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const next = blocks.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export const moveBlockTo = (blocks: BuilderBlock[], id: string, toIndex: number): BuilderBlock[] => {
  const from = blocks.findIndex(b => b.id === id);
  if (from < 0) return blocks;
  const clamped = Math.max(0, Math.min(blocks.length - 1, toIndex));
  if (clamped === from) return blocks;
  const next = blocks.slice();
  const [blk] = next.splice(from, 1);
  next.splice(clamped, 0, blk);
  return next;
};

export const updateBlock = (blocks: BuilderBlock[], id: string, patch: Partial<BuilderBlock>): BuilderBlock[] =>
  blocks.map(b => (b.id === id ? sanitizeBlock({ ...b, ...patch, id: b.id, type: b.type }) : b));

export const updateBlockStyle = (blocks: BuilderBlock[], id: string, patch: Partial<BuilderBlockStyle>): BuilderBlock[] =>
  blocks.map(b => (b.id === id
    ? { ...b, style: sanitizeStyle({ ...(b.style || {}), ...patch }) }
    : b));

export const removeBlock = (blocks: BuilderBlock[], id: string): BuilderBlock[] =>
  blocks.filter(b => b.id !== id);

export const duplicateBlock = (blocks: BuilderBlock[], id: string): BuilderBlock[] => {
  const i = blocks.findIndex(b => b.id === id);
  if (i < 0 || blocks.length >= BUILDER_MAX_BLOCKS) return blocks;
  const copy: BuilderBlock = { ...blocks[i], id: makeBlockId() };
  if (copy.style) copy.style = { ...copy.style };
  const next = blocks.slice();
  next.splice(i + 1, 0, copy);
  return next;
};

// ---------- history (pure) ----------
export interface BuilderHistory {
  past: PageLayout[];
  future: PageLayout[];
}

export const pushHistory = (h: BuilderHistory, layout: PageLayout): BuilderHistory => ({
  past: [...h.past, layout].slice(-BUILDER_HISTORY_CAP),
  future: [],
});

export const undoHistory = (h: BuilderHistory, current: PageLayout): { layout: PageLayout; history: BuilderHistory } | null => {
  if (!h.past.length) return null;
  const prev = h.past[h.past.length - 1];
  return {
    layout: prev,
    history: { past: h.past.slice(0, -1), future: [current, ...h.future].slice(0, BUILDER_HISTORY_CAP) },
  };
};

export const redoHistory = (h: BuilderHistory, current: PageLayout): { layout: PageLayout; history: BuilderHistory } | null => {
  if (!h.future.length) return null;
  const [next, ...rest] = h.future;
  return {
    layout: next,
    history: { past: [...h.past, current].slice(-BUILDER_HISTORY_CAP), future: rest },
  };
};

// ---------- sanitize ----------
const asText = (v: unknown, max = BUILDER_MAX_TEXT): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
};

const SAFE_URL = /^(https?:\/\/|data:image\/(png|jpeg|gif|webp);base64,)/i;
const asSafeUrl = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, BUILDER_MAX_URL);
  if (!t) return undefined;
  return SAFE_URL.test(t) ? t : undefined;
};

const asColor = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, 32);
  if (!t) return undefined;
  return /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]{1,64}\)|hsla?\([^)]{1,64}\)|[a-z]{3,20})$/.test(t) ? t : undefined;
};

const asNum = (v: unknown, min: number, max: number): number | undefined => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.max(min, Math.min(max, Math.round(v)));
};

export const sanitizeStyle = (input: unknown): BuilderBlockStyle | undefined => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const r = input as Record<string, unknown>;
  const out: BuilderBlockStyle = {};
  const color = asColor(r.color);
  if (color) out.color = color;
  const bg = asColor(r.background);
  if (bg) out.background = bg;
  const fs = asNum(r.fontSize, 8, 96);
  if (fs !== undefined) out.fontSize = fs;
  if (typeof r.align === 'string' && (ALIGN_VALUES as readonly string[]).includes(r.align)) {
    out.align = r.align as BuilderBlockStyle['align'];
  }
  const mt = asNum(r.marginTop, 0, 200);
  if (mt !== undefined) out.marginTop = mt;
  const mb = asNum(r.marginBottom, 0, 200);
  if (mb !== undefined) out.marginBottom = mb;
  const pad = asNum(r.padding, 0, 120);
  if (pad !== undefined) out.padding = pad;
  const rad = asNum(r.radius, 0, 100);
  if (rad !== undefined) out.radius = rad;
  const w = asNum(r.widthPct, 10, 100);
  if (w !== undefined) out.widthPct = w;
  return Object.keys(out).length ? out : undefined;
};

export const sanitizeBlock = (input: unknown): BuilderBlock => {
  const r = (input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {}) as Record<string, unknown>;
  const type = (typeof r.type === 'string' && (BLOCK_TYPES as string[]).includes(r.type))
    ? (r.type as BuilderBlockType) : 'text';
  const blk: BuilderBlock = {
    id: typeof r.id === 'string' && r.id.trim() ? r.id.trim().slice(0, 64) : makeBlockId(),
    type,
  };
  if (type === 'dashboard_section') {
    blk.refId = typeof r.refId === 'string' && DASHBOARD_SECTION_IDS.includes(r.refId) ? r.refId : 'banner';
  }
  const text = asText(r.text);
  if (text !== undefined && (type === 'heading' || type === 'text' || type === 'button')) blk.text = text;
  if (type === 'image') {
    const url = asSafeUrl(r.url);
    if (url) blk.url = url;
    const cap = asText(r.text, 300);
    if (cap !== undefined) blk.text = cap;
  }
  if (type === 'button' && typeof r.targetTab === 'string' && /^[a-z_]{2,30}$/.test(r.targetTab)) {
    blk.targetTab = r.targetTab;
  }
  if (type === 'heading' && (r.level === 1 || r.level === 2 || r.level === 3)) blk.level = r.level;
  if (type === 'stat' && typeof r.statKind === 'string' && (STAT_KINDS as readonly string[]).includes(r.statKind)) {
    blk.statKind = r.statKind as BuilderBlock['statKind'];
  }
  const style = sanitizeStyle(r.style);
  if (style) blk.style = style;
  if (r.hidden === true) blk.hidden = true;
  return blk;
};

export const sanitizeLayout = (input: unknown): PageLayout => {
  const fallback = defaultDashboardLayout();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fallback;
  const r = input as Record<string, unknown>;
  if (!Array.isArray(r.blocks)) return fallback;
  const blocks = r.blocks.slice(0, BUILDER_MAX_BLOCKS).map(sanitizeBlock);
  if (!blocks.length) return fallback;
  return {
    version: 1,
    updatedAt: typeof r.updatedAt === 'string' && !Number.isNaN(new Date(r.updatedAt).getTime())
      ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    blocks,
  };
};

// ---------- persistence ----------
const safeGet = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key: string, val: string): boolean => {
  try { localStorage.setItem(key, val); return true; } catch { return false; }
};

export const loadPublishedLayout = (pageKey: string): PageLayout | null => {
  const raw = safeGet(PUBLISH_PREFIX + pageKey);
  if (!raw) return null;
  try {
    return sanitizeLayout(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const savePublishedLayout = (pageKey: string, layout: PageLayout): boolean =>
  safeSet(PUBLISH_PREFIX + pageKey, JSON.stringify({ ...layout, updatedAt: new Date().toISOString() }));

export const loadDraftLayout = (pageKey: string): PageLayout | null => {
  const raw = safeGet(DRAFT_PREFIX + pageKey);
  if (!raw) return null;
  try {
    return sanitizeLayout(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveDraftLayout = (pageKey: string, layout: PageLayout): boolean =>
  safeSet(DRAFT_PREFIX + pageKey, JSON.stringify(layout));

export const clearDraftLayout = (pageKey: string): void => {
  try { localStorage.removeItem(DRAFT_PREFIX + pageKey); } catch { /* noop */ }
};

/** Effective dashboard blocks: published layout or the legacy default order. */
export const resolveDashboardBlocks = (companyName?: string): BuilderBlock[] => {
  const pub = loadPublishedLayout(dashboardPageKey(companyName));
  if (pub) return pub.blocks.filter(b => !b.hidden);
  return defaultDashboardLayout().blocks;
};

// ---------- import / export ----------
export const exportLayoutJSON = (layout: PageLayout): string =>
  JSON.stringify({ kind: 'nsc-builder-layout', version: 1, layout: sanitizeLayout(layout) }, null, 2);

export const parseLayoutFile = (raw: string): PageLayout => {
  if (raw.length > BUILDER_FILE_MAX_BYTES) {
    throw new Error('فایل بیش از حد بزرگ است (حداکثر ~۳۰۰ کیلوبایت).');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('فایل معتبر نیست (JSON خراب است).');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ساختار فایل نامعتبر است.');
  }
  const r = parsed as Record<string, unknown>;
  const inner = r.kind === 'nsc-builder-layout' ? r.layout : parsed;
  const layout = sanitizeLayout(inner);
  return layout;
};

const escHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const styleAttr = (st?: BuilderBlockStyle): string => {
  if (!st) return '';
  const parts: string[] = [];
  if (st.color) parts.push(`color:${escHtml(st.color)}`);
  if (st.background) parts.push(`background:${escHtml(st.background)}`);
  if (st.fontSize !== undefined) parts.push(`font-size:${st.fontSize}px`);
  if (st.align) parts.push(`text-align:${st.align}`);
  if (st.marginTop !== undefined) parts.push(`margin-top:${st.marginTop}px`);
  if (st.marginBottom !== undefined) parts.push(`margin-bottom:${st.marginBottom}px`);
  if (st.padding !== undefined) parts.push(`padding:${st.padding}px`);
  if (st.radius !== undefined) parts.push(`border-radius:${st.radius}px`);
  if (st.widthPct !== undefined) parts.push(`width:${st.widthPct}%`);
  return parts.length ? ` style="${parts.join(';')}"` : '';
};

/** Static HTML snapshot of content blocks (dashboard_section refs become placeholders). */
export const exportLayoutHTML = (layout: PageLayout, title: string, dir: 'rtl' | 'ltr' = 'rtl'): string => {
  const clean = sanitizeLayout(layout);
  const body = clean.blocks.filter(b => !b.hidden).map(b => {
    const st = styleAttr(b.style);
    switch (b.type) {
      case 'heading': {
        const tag = b.level === 1 ? 'h1' : b.level === 3 ? 'h3' : 'h2';
        return `<${tag}${st}>${escHtml(b.text || '')}</${tag}>`;
      }
      case 'text':
        return `<p${st}>${escHtml(b.text || '').replace(/\n/g, '<br>')}</p>`;
      case 'image':
        return b.url
          ? `<figure${st}><img src="${escHtml(b.url)}" alt="${escHtml(b.text || '')}" style="max-width:100%"/>${b.text ? `<figcaption>${escHtml(b.text)}</figcaption>` : ''}</figure>`
          : '';
      case 'button':
        return `<p${st}><span style="display:inline-block;padding:10px 22px;border-radius:10px;background:#4f46e5;color:#fff">${escHtml(b.text || '')}</span></p>`;
      case 'divider':
        return `<hr${st}/>`;
      case 'spacer':
        return `<div${st}>&nbsp;</div>`;
      case 'stat':
        return `<p${st}>[${escHtml(b.statKind || 'stat')}]</p>`;
      case 'dashboard_section':
        return `<!-- live section: ${escHtml(b.refId || '')} -->`;
      default:
        return '';
    }
  }).join('\n');
  return `<!DOCTYPE html>\n<html lang="${dir === 'ltr' ? 'en' : 'fa'}" dir="${dir}">\n<head><meta charset="utf-8"><title>${escHtml(title)}</title></head>\n<body>\n${body}\n</body>\n</html>`;
};

export const downloadTextFile = (filename: string, text: string, mime: string): void => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/** Builder is for company owners (+ master); employees need an explicit grant. */
export const canUseBuilder = (user: User | null): boolean => {
  if (!user) return false;
  if (user.isMasterSuperAdmin) return true;
  if (user.role === 'admin') return true;
  return user.permissions?.allowedTabs?.includes('builder') === true;
};
