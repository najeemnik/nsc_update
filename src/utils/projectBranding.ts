/**
 * Wave 29 — per-project wallpaper + owner branding resolution (pure).
 *
 * Precedence: project wallpaper → global AppSettings wallpaper → none.
 * URLs are strictly allow-listed: only data:image/* or same-origin relative
 * paths. Anything else (javascript:, data:text/html, svg, remote http) is
 * rejected so a malicious project record can never inject content.
 */
import type { Project } from '../types';

export const BG_SIZE_OPTIONS = [
  { id: 'cover', fa: 'پوشش کامل (Cover)', en: 'Cover (full)' },
  { id: 'contain', fa: 'نمایش کامل (Contain)', en: 'Contain (fit)' },
  { id: 'repeat', fa: 'کاشی‌کاری (Repeat)', en: 'Tile (repeat)' },
  { id: 'stretch', fa: 'کشش تمام‌صفحه (Stretch)', en: 'Stretch' },
] as const;

export const BG_POSITION_OPTIONS = [
  { id: 'center', fa: 'وسط', en: 'Center' },
  { id: 'top', fa: 'بالا', en: 'Top' },
  { id: 'bottom', fa: 'پایین', en: 'Bottom' },
  { id: 'left', fa: 'چپ', en: 'Left' },
  { id: 'right', fa: 'راست', en: 'Right' },
  { id: 'top left', fa: 'بالا-چپ', en: 'Top left' },
  { id: 'top right', fa: 'بالا-راست', en: 'Top right' },
  { id: 'bottom left', fa: 'پایین-چپ', en: 'Bottom left' },
  { id: 'bottom right', fa: 'پایین-راست', en: 'Bottom right' },
] as const;

export const BG_LIMITS = {
  opacityMin: 5,
  opacityMax: 60,
  blurMax: 12,
  uploadMaxBytes: 1_500_000,
  uploadMaxDim: 1920,
} as const;

const KNOWN_SIZES: Set<string> = new Set(['cover', 'contain', 'repeat', 'stretch']);
const KNOWN_POSITIONS: Set<string> = new Set(BG_POSITION_OPTIONS.map(p => p.id));

/**
 * Strict wallpaper URL allow-list.
 * Accepts: data:image/jpeg|png|webp|gif;base64,… and same-origin relative
 * paths (/assets/…, ./…, ../… without scheme). Rejects everything else.
 */
export const sanitizeBgUrl = (url: unknown): string | undefined => {
  if (typeof url !== 'string') return undefined;
  const u = url.trim();
  if (!u || u.length > 2_000_000) return undefined;
  if (/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(u)) return u;
  if (/^(\/|\.\/|\.\.\/)[\w\-./%]+$/.test(u) && !u.includes('\\') && !/[<>"']/.test(u)) return u;
  return undefined;
};

export interface ResolvedBg {
  url?: string;
  size: 'cover' | 'contain' | 'repeat' | 'stretch';
  position: string;
  opacity: number; // 0..1 for the layer
  blur: number;    // px
}

export const sanitizeProjectBg = (p: Partial<Project>): ResolvedBg => {
  const pos = p.backgroundPosition || '';
  return {
    url: sanitizeBgUrl(p.backgroundImageUrl),
    size: (KNOWN_SIZES.has(p.backgroundSize || '') ? p.backgroundSize : 'cover') as ResolvedBg['size'],
    position: KNOWN_POSITIONS.has(pos) ? pos : 'center',
    opacity: Math.min(BG_LIMITS.opacityMax, Math.max(BG_LIMITS.opacityMin, Number(p.backgroundOpacity) || 12)) / 100,
    blur: Math.min(BG_LIMITS.blurMax, Math.max(0, Number(p.backgroundBlur) || 0)),
  };
};

/** Project wallpaper wins; otherwise the global AppSettings wallpaper. */
export const resolveWallpaper = (
  project: Partial<Project> | undefined | null,
  global: { backgroundImageUrl?: string; backgroundOpacity?: number },
): ResolvedBg => {
  const specific = sanitizeProjectBg(project || {});
  if (specific.url) return specific;
  const url = sanitizeBgUrl(global.backgroundImageUrl);
  if (!url) return { ...specific, url: undefined };
  return {
    ...specific,
    url,
    opacity: Math.min(BG_LIMITS.opacityMax, Math.max(BG_LIMITS.opacityMin, Number(global.backgroundOpacity) || 12)) / 100,
  };
};

/** Inline style for the fixed wallpaper layer (below content, above canvas). */
export const wallpaperLayerStyle = (bg: ResolvedBg): React.CSSProperties => {
  if (!bg.url) return { display: 'none' };
  const repeat = bg.size === 'repeat';
  // bg.url is allow-listed (base64 or quote-free relative path) — safe in url("…").
  return {
    backgroundImage: `url("${bg.url}")`,
    backgroundSize: bg.size === 'stretch' ? '100% 100%' : bg.size === 'repeat' ? 'auto' : bg.size,
    backgroundPosition: bg.position,
    backgroundRepeat: repeat ? 'repeat' : 'no-repeat',
    opacity: bg.opacity,
    filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined,
  };
};
