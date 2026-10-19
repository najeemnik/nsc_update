import React, { useMemo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { normalizeAttachments } from '../../utils/attachments';
import { AttachmentViewer } from './AttachmentViewer';
import type { AttachmentRef, StoredAttachment } from '../../types';

interface AttachmentClipProps {
  refs?: AttachmentRef[];
  receiptUrl?: string;
  /** owning section for permission gates (view/export/edit). */
  section: string;
  onRefsChange?: (next: AttachmentRef[]) => void;
  onReceiptRemove?: () => void;
  title?: string;
}

/**
 * Wave 26: paperclip button + count badge that opens the secure viewer.
 * View/download/delete are gated by the owning section's permissions.
 */
export const AttachmentClip: React.FC<AttachmentClipProps> = ({
  refs, receiptUrl, section, onRefsChange, onReceiptRemove, title,
}) => {
  const { can, tp } = useApp();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const list: StoredAttachment[] = useMemo(() => {
    const base = normalizeAttachments(refs);
    if (receiptUrl) {
      base.unshift({
        id: 'legacy-receipt',
        name: 'receipt',
        kind: 'photo',
        mime: 'image/jpeg',
        size: Math.round((receiptUrl.length * 3) / 4),
        data: receiptUrl,
        uploadedAt: '',
      });
    }
    return base;
  }, [refs, receiptUrl]);

  if (list.length === 0) {
    return <span className="text-slate-300 dark:text-slate-600">—</span>;
  }
  if (!can(section, 'view')) return null;

  const handleDelete = (att: StoredAttachment) => {
    if (att.id === 'legacy-receipt') {
      onReceiptRemove?.();
      setOpen(false);
      return;
    }
    if (!refs || !onRefsChange) return;
    const idx = normalizeAttachments(refs).findIndex(a => a.id === att.id);
    if (idx < 0) return;
    const next = refs.filter((_, i) => i !== idx);
    onRefsChange(next.length > 0 ? next : []);
    if (next.length === (receiptUrl ? 1 : 0)) setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
        className="relative inline-flex p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
        title={title || tp('View attachments', 'نمایش ضمیمه‌ها', 'ضمیمې کتل')}
      >
        <Paperclip className="w-4 h-4" />
        {list.length > 1 && (
          <span className="absolute -top-1 -end-1 min-w-4 h-4 px-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
            {list.length}
          </span>
        )}
      </button>
      {open && (
        <AttachmentViewer
          attachments={list}
          index={Math.min(index, list.length - 1)}
          onIndex={setIndex}
          onClose={() => setOpen(false)}
          canDownload={can(section, 'export')}
          canDelete={(!!onRefsChange || !!onReceiptRemove) && can(section, 'edit')}
          onDelete={handleDelete}
        />
      )}
    </>
  );
};
