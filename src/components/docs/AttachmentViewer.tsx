import React, { useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Trash2, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { attachmentSrc } from '../../utils/attachments';
import { dataUrlToBytes } from '../../utils/scanEngine';
import type { StoredAttachment } from '../../types';

interface AttachmentViewerProps {
  attachments: StoredAttachment[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** Caller-computed permission gates (section-aware). */
  canDownload: boolean;
  canDelete: boolean;
  onDelete?: (attachment: StoredAttachment) => void;
}

/**
 * Wave 26: secure attachment lightbox.
 * - Only validated data: image/* renders in <img> (no script context).
 * - PDFs render inside a sandboxed <iframe> (scripts + top-nav blocked).
 * - Download goes through an ephemeral Blob URL that is always revoked.
 */
export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  attachments, index, onIndex, onClose, canDownload, canDelete, onDelete,
}) => {
  const { tp, language } = useApp();
  const rtl = language !== 'en';
  const current = attachments[index];
  const src = current ? attachmentSrc(current) : null;
  const isPdf = !!current && current.mime === 'application/pdf';

  const step = useCallback((dir: 1 | -1) => {
    if (attachments.length <= 1) return;
    onIndex((index + dir + attachments.length) % attachments.length);
  }, [attachments.length, index, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') step(rtl ? 1 : -1);
      if (e.key === 'ArrowRight') step(rtl ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step, rtl]);

  const handleDownload = useCallback(() => {
    if (!current || !src || !canDownload) return;
    const parsed = dataUrlToBytes(src);
    if (!parsed) return;
    const blob = new Blob([parsed.bytes as unknown as BlobPart], { type: parsed.mime });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = current.name || 'attachment';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }, [current, src, canDownload]);

  const handleDelete = useCallback(() => {
    if (!current || !canDelete || !onDelete) return;
    if (!confirm(tp(`Delete "${current.name}"?`, `«${current.name}» حذف شود؟`, `«${current.name}» ړنګ شي؟`))) return;
    onDelete(current);
  }, [current, canDelete, onDelete, tp]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/90 backdrop-blur-sm" dir={rtl ? 'rtl' : 'ltr'}>
      {/* top bar */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-white truncate">{current.name}</span>
          {attachments.length > 1 && (
            <span className="text-[10px] font-mono text-slate-400 shrink-0">{index + 1} / {attachments.length}</span>
          )}
        </div>
        <div className="ms-auto flex items-center gap-1.5 shrink-0">
          {canDownload && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black transition"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{tp('Download', 'دانلود', 'ښکته کول')}</span>
            </button>
          )}
          {canDelete && onDelete && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-[11px] font-black transition"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">{tp('Delete', 'حذف', 'ړنګول')}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            aria-label="close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* content */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-2 sm:px-10 pb-4">
        {attachments.length > 1 && (
          <button
            onClick={() => step(-1)}
            className="absolute start-2 sm:start-4 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition"
            aria-label="previous"
          >
            {rtl ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
          </button>
        )}
        {!src ? (
          <p className="text-xs text-rose-300 font-bold">{tp('This file cannot be displayed safely.', 'این فایل به‌صورت امن قابل نمایش نیست.', 'دا فایل په خوندي توګه نه شي ښودل کېدلی.')}</p>
        ) : isPdf ? (
          <iframe
            title={current.name}
            src={src}
            sandbox="allow-same-origin"
            className="w-full max-w-3xl h-full rounded-2xl bg-white shadow-2xl"
          />
        ) : (
          <img
            src={src}
            alt={current.name}
            draggable={false}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl select-none"
          />
        )}
        {attachments.length > 1 && (
          <button
            onClick={() => step(1)}
            className="absolute end-2 sm:end-4 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition"
            aria-label="next"
          >
            {rtl ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
};
