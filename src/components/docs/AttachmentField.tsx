import React, { useRef, useState } from 'react';
import { Camera, Upload, FileText, X, Paperclip, ScanLine, AlertTriangle, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  SCAN_LIMITS, validateUploadBytes, readFileBytes, decodeToRaw,
  paintToCanvas, canvasToJpegBytes, bytesToDataUrl, sniffImageMime, sniffPdf,
} from '../../utils/scanEngine';
import {
  normalizeAttachments, attachmentSrc, totalAttachmentBytes,
  makeAttachment, formatBytes, ATTACHMENT_LIMITS,
} from '../../utils/attachments';
import { ScanModal } from './ScanModal';
import { AttachmentViewer } from './AttachmentViewer';
import type { AttachmentRef, StoredAttachment } from '../../types';

interface AttachmentFieldProps {
  value: AttachmentRef[];
  onChange: (next: AttachmentRef[]) => void;
  label?: string;
  acceptPdf?: boolean;
  compact?: boolean;
}

/**
 * Wave 25+26: reusable attachment picker for every financial form.
 * Camera (real device camera, rear preferred) · Scan studio · Upload · PDF.
 * All images are re-encoded to JPEG before storage — uploads never persist raw.
 */
export const AttachmentField: React.FC<AttachmentFieldProps> = ({
  value, onChange, label, acceptPdf = true, compact = false,
}) => {
  const { tp, currentUser } = useApp();
  const [scanOpen, setScanOpen] = useState(false);
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const list = normalizeAttachments(value);
  const usedBytes = totalAttachmentBytes(value);

  const trErr = (code: string): string => {
    switch (code) {
      case 'too-large': return tp('File too large (max 15 MB).', 'فایل بزرگ است (حداکثر ۱۵ مگابایت).', 'فایل لوی دی (تر ۱۵ مېګابایټه).');
      case 'unsupported-type': return tp('Only JPG/PNG/WebP photos (and PDF) are accepted.', 'فقط عکس JPG/PNG/WebP (و PDF) پذیرفته می‌شود.', 'یوازې JPG/PNG/WebP عکس (او PDF) منل کېږي.');
      case 'too-many': return tp('Maximum 10 attachments per record.', 'حداکثر ۱۰ ضمیمه برای هر ثبت.', 'تر ۱۰ ضمیمو پورې په هر ثبت کې.');
      case 'quota': return tp('Attachment quota exceeded for this record (4 MB).', 'سقف ضمیمه این ثبت (۴ مگابایت) پر شد.', 'د دې ثبت د ضمیمو حد (۴ مېګابایټه) ډک شو.');
      case 'decode-failed': return tp('Could not read this file.', 'این فایل خوانده نشد.', 'دا فایل ونه لوستل شو.');
      default: return tp('Something went wrong.', 'خطایی رخ داد.', 'ستونزه پېښه شوه.');
    }
  };

  const shrinkToCap = async (canvas: HTMLCanvasElement): Promise<{ bytes: Uint8Array; w: number; h: number }> => {
    let quality = SCAN_LIMITS.jpegQuality;
    let c: HTMLCanvasElement = canvas;
    let bytes = await canvasToJpegBytes(c, quality);
    while (bytes.length > SCAN_LIMITS.maxStoredBytes && quality > 0.45) {
      quality -= 0.12;
      bytes = await canvasToJpegBytes(c, quality);
    }
    if (bytes.length > SCAN_LIMITS.maxStoredBytes) {
      const s = Math.sqrt(SCAN_LIMITS.maxStoredBytes / bytes.length);
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.round(c.width * s));
      small.height = Math.max(1, Math.round(c.height * s));
      small.getContext('2d')?.drawImage(c, 0, 0, small.width, small.height);
      c = small;
      bytes = await canvasToJpegBytes(c, 0.72);
    }
    return { bytes, w: c.width, h: c.height };
  };

  const ingestImages = async (files: FileList | null, kind: 'photo' | 'file') => {
    if (!files || files.length === 0) return;
    setError(null);
    if (list.length >= ATTACHMENT_LIMITS.maxFiles) {
      setError(trErr('too-many'));
      return;
    }
    setBusy(true);
    try {
      const fresh: StoredAttachment[] = [];
      let running = usedBytes;
      for (const file of Array.from(files).slice(0, ATTACHMENT_LIMITS.maxFiles - list.length)) {
        const bytes = await readFileBytes(file).catch(() => null);
        if (!bytes) {
          setError(trErr('too-large'));
          continue;
        }
        const check = validateUploadBytes(bytes, false);
        if (!check.ok || !sniffImageMime(bytes)) {
          setError(trErr(check.error || 'unsupported-type'));
          continue;
        }
        try {
          const raw = await decodeToRaw(bytes);
          // downscale to the scan long-edge before encode (quota protection)
          const s = Math.min(1, SCAN_LIMITS.defaultOutputDim / Math.max(raw.width, raw.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(raw.width * s));
          c.height = Math.max(1, Math.round(raw.height * s));
          const full = document.createElement('canvas');
          paintToCanvas(raw, full);
          c.getContext('2d')?.drawImage(full, 0, 0, c.width, c.height);
          const { bytes: out, w, h } = await shrinkToCap(c);
          if (running + out.length > ATTACHMENT_LIMITS.maxBytesPerRecord) {
            setError(trErr('quota'));
            break;
          }
          running += out.length;
          fresh.push(makeAttachment({
            name: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'photo',
            kind,
            mime: 'image/jpeg',
            dataUrl: bytesToDataUrl(out, 'image/jpeg'),
            size: out.length,
            uploadedBy: currentUser?.name || currentUser?.username,
            width: w,
            height: h,
          }));
        } catch {
          setError(trErr('decode-failed'));
        }
      }
      if (fresh.length > 0) onChange([...value, ...fresh]);
    } finally {
      setBusy(false);
    }
  };

  const ingestPdf = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    if (list.length >= ATTACHMENT_LIMITS.maxFiles) {
      setError(trErr('too-many'));
      return;
    }
    setBusy(true);
    try {
      const fresh: StoredAttachment[] = [];
      let running = usedBytes;
      for (const file of Array.from(files).slice(0, ATTACHMENT_LIMITS.maxFiles - list.length)) {
        const bytes = await readFileBytes(file).catch(() => null);
        if (!bytes) {
          setError(trErr('too-large'));
          continue;
        }
        const check = validateUploadBytes(bytes, true);
        if (!check.ok || !sniffPdf(bytes)) {
          setError(trErr('unsupported-type'));
          continue;
        }
        if (running + bytes.length > ATTACHMENT_LIMITS.maxBytesPerRecord) {
          setError(trErr('quota'));
          break;
        }
        running += bytes.length;
        fresh.push(makeAttachment({
          name: file.name.slice(0, 80) || 'document.pdf',
          kind: 'pdf',
          mime: 'application/pdf',
          dataUrl: bytesToDataUrl(bytes, 'application/pdf'),
          size: bytes.length,
          uploadedBy: currentUser?.name || currentUser?.username,
        }));
      }
      if (fresh.length > 0) onChange([...value, ...fresh]);
    } finally {
      setBusy(false);
    }
  };

  const removeAt = (idx: number) => {
    const target = list[idx];
    if (!target) return;
    if (!confirm(tp(`Remove "${target.name}"?`, `«${target.name}» حذف شود؟`, `«${target.name}» لیرې شي؟`))) return;
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-2xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[11px] font-black text-ink">
          <Paperclip className="w-3.5 h-3.5 text-ink-muted" />
          {label || tp('Attachments (bill scan / photo / PDF)', 'ضمیمه‌ها (اسکن بل / عکس / PDF)', 'ضمیمې (د بل سکین / عکس / PDF)')}
        </span>
        <span className="text-[10px] font-mono text-ink-muted">{formatBytes(usedBytes)} / {formatBytes(ATTACHMENT_LIMITS.maxBytesPerRecord)}</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-[11px] font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {list.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
          {list.map((a, i) => {
            const src = attachmentSrc(a);
            return (
              <div key={a.id} className="relative shrink-0 w-16">
                <button
                  type="button"
                  onClick={() => src && setViewIdx(i)}
                  className="block w-16 h-16 rounded-xl overflow-hidden border border-line bg-black/60"
                  title={a.name}
                >
                  {src && a.mime.startsWith('image/') ? (
                    <img src={src} alt={a.name} className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <span className="w-full h-full flex flex-col items-center justify-center text-rose-500 gap-0.5">
                      <FileText className="w-5 h-5" />
                      <span className="text-[8px] font-black">PDF</span>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow"
                  aria-label="remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-[8px] text-ink-muted truncate mt-0.5 text-center">{formatBytes(a.size)}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          disabled={busy || list.length >= ATTACHMENT_LIMITS.maxFiles}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-black transition active:scale-[0.98]"
        >
          <ScanLine className="w-4 h-4" />
          {!compact && tp('Scan', 'اسکن', 'سکین')}
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy || list.length >= ATTACHMENT_LIMITS.maxFiles}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-black transition active:scale-[0.98]"
          title={tp('Take photo (rear camera)', 'گرفتن عکس (کمره عقب)', 'عکس اخیستل (شاته کامره)')}
        >
          <Camera className="w-4 h-4" />
          {!compact && tp('Photo', 'عکس', 'عکس')}
        </button>
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          disabled={busy || list.length >= ATTACHMENT_LIMITS.maxFiles}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-surface border border-line hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-ink text-[11px] font-black transition active:scale-[0.98]"
        >
          <Upload className="w-4 h-4" />
          {!compact && tp('Upload', 'آپلود', 'پورته کول')}
        </button>
        {acceptPdf ? (
          <button
            type="button"
            onClick={() => pdfRef.current?.click()}
            disabled={busy || list.length >= ATTACHMENT_LIMITS.maxFiles}
            className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-surface border border-line hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-ink text-[11px] font-black transition active:scale-[0.98]"
          >
            <FileText className="w-4 h-4" />
            {!compact && 'PDF'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => list.length > 0 && setViewIdx(0)}
            disabled={list.length === 0}
            className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-surface border border-line hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-ink text-[11px] font-black transition active:scale-[0.98]"
          >
            <Eye className="w-4 h-4" />
            {!compact && tp('View', 'نمایش', 'کتل')}
          </button>
        )}
      </div>
      {busy && <p className="mt-2 text-center text-[11px] text-ink-muted animate-pulse">{tp('Processing…', 'در حال پردازش…', 'پروسس کېږي…')}</p>}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          ingestImages(e.target.files, 'photo');
          e.target.value = '';
        }}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={e => {
          ingestImages(e.target.files, 'file');
          e.target.value = '';
        }}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={e => {
          ingestPdf(e.target.files);
          e.target.value = '';
        }}
      />

      <ScanModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onDone={fresh => {
          const room = ATTACHMENT_LIMITS.maxFiles - list.length;
          let running = usedBytes;
          const kept: StoredAttachment[] = [];
          for (const a of fresh.slice(0, Math.max(0, room))) {
            if (running + a.size > ATTACHMENT_LIMITS.maxBytesPerRecord) {
              setError(trErr('quota'));
              break;
            }
            running += a.size;
            kept.push(a);
          }
          if (kept.length > 0) onChange([...value, ...kept]);
        }}
      />
      {viewIdx !== null && list[viewIdx] && (
        <AttachmentViewer
          attachments={list}
          index={viewIdx}
          onIndex={setViewIdx}
          onClose={() => setViewIdx(null)}
          canDownload
          canDelete={false}
        />
      )}
    </div>
  );
};
