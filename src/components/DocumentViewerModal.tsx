import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Download, FileText, ShieldAlert } from 'lucide-react';

export interface ViewerDoc {
  /** Displayed file name — the ONLY text shown. Raw URLs are never rendered. */
  title: string;
  url: string;
}

const driveIdOf = (url: string): string | null => {
  const m1 = url.match(/\/file\/d\/([^/?#]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([^&#]+)/);
  return m2 ? m2[1] : null;
};

/** Embeddable preview source. Google Drive links become /preview embeds. */
export const viewerSrcOf = (url: string): string | null => {
  if (!url || url.startsWith('#')) return null;
  const id = driveIdOf(url);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return url;
};

/**
 * Wave 38: in-app document viewer. Files open inside the app with only
 * their NAME in the header — the raw link/format is never shown anywhere.
 */
export const DocumentViewerModal: React.FC<{ doc: ViewerDoc | null; onClose: () => void }> = ({ doc, onClose }) => {
  const { tp } = useApp();
  if (!doc) return null;
  const src = viewerSrcOf(doc.url);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <FileText className="w-4 h-4 text-cyan-600 shrink-0" />
          <h3 className="flex-1 min-w-0 truncate text-sm font-black text-ink" title={doc.title}>
            {doc.title}
          </h3>
          {src && (
            <a
              href={doc.url}
              download={doc.title}
              className="p-2 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-slate-800 rounded-xl transition"
              title={tp('Download', 'دانلود', 'ښکته کول')}
            >
              <Download className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-ink rounded-xl hover:bg-surface-2 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-slate-100 dark:bg-slate-950">
          {src ? (
            <iframe src={src} title={doc.title} className="w-full h-[70dvh] bg-white" />
          ) : (
            <div className="h-[30dvh] flex flex-col items-center justify-center gap-2 text-ink-muted text-xs font-bold p-6 text-center">
              <ShieldAlert className="w-6 h-6" />
              <span>{tp('No preview available for this file.', 'پیش‌نمایش برای این فایل موجود نیست.', 'د دې فایل لپاره مخکتنه نشته.')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
