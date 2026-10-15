/**
 * Wave 25 — attachment registry helpers (pure logic; React UI lives in
 * `src/components/docs/AttachmentField.tsx` + `AttachmentViewer.tsx`).
 *
 * Attachments live INSIDE their owning record (localStorage, origin-isolated),
 * so they survive export/backup/offline exactly like the record itself.
 * Access is gated by the owning section's permissions (see `attachmentGate`).
 */
import type { AttachmentRef, StoredAttachment } from '../types';

export const ATTACHMENT_LIMITS = {
  maxFiles: 10,
  maxBytesPerRecord: 4_000_000, // localStorage quota guard
} as const;

let seq = 0;
export const newAttachmentId = (): string =>
  `att-${Date.now().toString(36)}-${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** Build a StoredAttachment from validated output bytes. */
export const makeAttachment = (opts: {
  name: string;
  kind: StoredAttachment['kind'];
  mime: string;
  dataUrl: string;
  size: number;
  uploadedBy?: string;
  pageCount?: number;
  width?: number;
  height?: number;
}): StoredAttachment => ({
  id: newAttachmentId(),
  name: opts.name.slice(0, 120) || 'scan',
  kind: opts.kind,
  mime: opts.mime,
  size: Math.max(0, Math.floor(opts.size)),
  data: opts.dataUrl,
  pageCount: opts.pageCount,
  width: opts.width,
  height: opts.height,
  uploadedAt: new Date().toISOString(),
  uploadedBy: opts.uploadedBy,
});

/** Legacy strings → normalized objects for uniform rendering. */
export const normalizeAttachments = (refs?: AttachmentRef[]): StoredAttachment[] => {
  if (!refs) return [];
  return refs.map((r, i): StoredAttachment => {
    if (typeof r === 'string') {
      const m = /^data:([^;,]+);base64,/.exec(r);
      const mime = m ? m[1] : 'image/jpeg';
      return {
        id: `legacy-${i}`,
        name: `receipt-${i + 1}`,
        kind: mime === 'application/pdf' ? 'pdf' : 'photo',
        mime,
        size: Math.round((r.length * 3) / 4),
        data: r,
        uploadedAt: '',
      };
    }
    return r;
  });
};

/** Safe render source: only data: image/* or application/pdf URLs. */
export const attachmentSrc = (a: StoredAttachment): string | null => {
  if (!a || typeof a.data !== 'string') return null;
  const ok = /^(data:image\/(jpeg|png|webp|gif);base64,|data:application\/pdf;base64,)/.test(a.data.trim());
  return ok ? a.data : null;
};

export const totalAttachmentBytes = (refs?: AttachmentRef[]): number =>
  normalizeAttachments(refs).reduce((s, a) => s + (a.size || 0), 0);

/** Extra gate for destructive attachment ops (delete/rename). */
export type AttachmentGate = (action: 'view' | 'download' | 'manage') => boolean;

export const formatBytes = (n: number): string => {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
