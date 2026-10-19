import React, { useEffect, useMemo, useState } from 'react';
import { FileText, X, Save, Eye, Pencil, Variable } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DocPrintLayout } from './DocPrintLayout';
import { substituteDocVars } from '../../utils/docDesign';
import type { DocumentCategory, DocumentRecord } from '../../types';

interface DocComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  editing?: DocumentRecord | null;
}

const CATEGORIES: DocumentCategory[] = [
  'contracts', 'invoices', 'sales_contracts', 'legal', 'permits', 'bill', 'receipt', 'other',
];

const VAR_KEYS = ['companyName', 'projectName', 'date', 'docNo'] as const;

/** Resolve {{variables}} for a composed document (preview + print share this). */
export const resolveComposedVars = (
  doc: { id: string; date: string; projectId: string },
  lookup: { companyName: string; projectName: string },
): Record<string, string> => ({
  companyName: lookup.companyName,
  projectName: lookup.projectName,
  date: doc.date,
  docNo: `DOC-${doc.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'DRAFT'}`,
});

/**
 * Wave 28: simple-but-powerful document composer (letters, certificates,
 * custom statements). Plain-text body + {{variables}} — no HTML, no scripts.
 */
export const DocComposerModal: React.FC<DocComposerModalProps> = ({ isOpen, onClose, editing }) => {
  const {
    tp, language, currentProject, grantedProjects, projects, appSettings,
    currentUser, addDocument, updateDocument, can,
  } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [body, setBody] = useState('');
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setShowPreview(false);
    if (editing) {
      setTitle(editing.title || '');
      setCategory(editing.category || 'other');
      setProjectId(editing.projectId || '');
      setDate(editing.date || new Date().toISOString().split('T')[0]);
      setBody(editing.content || '');
      setNotes(editing.notes || '');
    } else {
      setTitle('');
      setCategory('other');
      setProjectId(currentProject?.id || grantedProjects[0]?.id || projects[0]?.id || '');
      setDate(new Date().toISOString().split('T')[0]);
      setBody('');
      setNotes('');
    }
  }, [isOpen, editing, currentProject, grantedProjects, projects]);

  const projectName = useMemo(() => {
    const p = projects.find(x => x.id === projectId) || grantedProjects.find(x => x.id === projectId);
    return p?.name || '';
  }, [projects, grantedProjects, projectId]);

  const previewText = useMemo(() => substituteDocVars(
    body,
    resolveComposedVars(
      { id: editing?.id || `draft-${Date.now()}`, date, projectId },
      { companyName: appSettings.companyName || 'NSC', projectName },
    ),
  ), [body, editing, date, projectId, appSettings.companyName, projectName]);

  if (!isOpen) return null;
  const rtl = language !== 'en';

  const insertVar = (key: string) => {
    setBody(prev => (prev && !prev.endsWith('\n') && !prev.endsWith(' ') ? `${prev} ` : prev) + `{{${key}}}`);
  };

  const handleSave = () => {
    setFormError(null);
    if (!title.trim()) {
      setFormError(tp('Title is required.', 'عنوان سند الزامی است.', 'د سند سرلیک اړین دی.'));
      return;
    }
    if (!body.trim()) {
      setFormError(tp('Body text is required.', 'متن سند الزامی است.', 'د سند متن اړین دی.'));
      return;
    }
    if (!projectId) {
      setFormError(tp('Choose a project.', 'پروژه را انتخاب کنید.', 'پروژه وټاکئ.'));
      return;
    }
    if (editing) {
      if (!can('documents', 'edit')) return;
      updateDocument(editing.id, {
        title: title.trim(),
        category,
        projectId,
        date,
        content: body,
        notes: notes.trim() || undefined,
      });
    } else {
      addDocument({
        projectId,
        title: title.trim(),
        category,
        fileUrl: '#composed',
        fileName: `${title.trim().slice(0, 60)}.doc`,
        fileType: 'composed',
        relatedType: undefined,
        relatedId: undefined,
        date,
        notes: notes.trim() || undefined,
        content: body,
        sourceType: 'composed',
      });
    }
    onClose();
  };

  const inputCls = 'w-full px-3.5 py-2.5 bg-surface border border-line rounded-xl text-xs text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-3xl max-h-[94vh] bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-line bg-gradient-to-r from-indigo-600/10 to-transparent shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
              {editing ? <Pencil className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <h2 className="text-sm sm:text-base font-black text-ink">
              {editing
                ? tp('Edit document', 'ویرایش سند', 'سند سمول')
                : tp('New document', 'سند جدید', 'نوی سند')}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition ${showPreview ? 'bg-indigo-600 text-white' : 'bg-surface-2 text-ink'}`}
            >
              <Eye className="w-4 h-4" />
              {tp('Preview', 'پیش‌نمایش', 'مخکتنه')}
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-ink hover:bg-surface-2 rounded-xl transition" aria-label="close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
          {formError && (
            <p className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-[11px] font-bold">{formError}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Title', 'عنوان', 'سرلیک')}</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} maxLength={140} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Category', 'کتگوری', 'کټګوري')}</label>
              <select value={category} onChange={e => setCategory(e.target.value as DocumentCategory)} className={inputCls}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Project', 'پروژه', 'پروژه')}</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputCls}>
                <option value="">{tp('Choose…', 'انتخاب…', 'ټاکل…')}</option>
                {(grantedProjects.length > 0 ? grantedProjects : projects).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Date', 'تاریخ', 'نېټه')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Notes (optional)', 'یادداشت (اختیاری)', 'یادښت (اختیاري)')}</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} maxLength={200} />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="flex items-center gap-1 text-[11px] font-black text-ink">
                <Variable className="w-3.5 h-3.5 text-ink-muted" />
                {tp('Insert variable:', 'افزودن متغیر:', 'متغیر ورزياتول:')}
              </span>
              {VAR_KEYS.map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => insertVar(k)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 text-[11px] font-mono font-bold transition"
                >
                  {`{{${k}}}`}
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={showPreview ? 6 : 12}
              maxLength={12000}
              placeholder={tp('Write the document text… (Enter = new line)', 'متن سند را بنویسید… (Enter = خط جدید)', 'د سند متن ولیکئ…')}
              className={`${inputCls} font-mono leading-relaxed resize-y`}
            />
            <p className="text-[10px] text-ink-muted mt-1 text-end font-mono">{body.length} / 12000</p>
          </div>

          {showPreview && (
            <div>
              <label className="block text-[11px] font-black text-ink mb-1.5">{tp('Live preview (variables resolved)', 'پیش‌نمایش زنده', 'ژوندۍ مخکتنه')}</label>
              <div className="rounded-2xl bg-white text-slate-900 border border-line p-5 sm:p-6 shadow-inner">
                <p className="text-center text-[10px] font-bold text-slate-400 mb-2">{appSettings.companyName}</p>
                <h3 className="text-center text-sm font-black mb-1">{title || '—'}</h3>
                <p className="text-center text-[10px] text-slate-400 font-mono mb-4">{date} • {projectName}</p>
                <div className="text-xs leading-7 whitespace-pre-line">{previewText || <span className="text-slate-300">…</span>}</div>
                <div className="mt-8 flex justify-between text-center text-[10px] text-slate-400">
                  <div className="flex-1"><div className="h-8" /><div className="border-t border-slate-300 pt-1">{currentUser?.name || ''}</div></div>
                  <div className="w-8" />
                  <div className="flex-1"><div className="h-8" /><div className="border-t border-slate-300 pt-1">{tp('Signature', 'امضا', 'لاسلیک')}</div></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3.5 border-t border-line bg-surface-2/40 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-ink transition"
          >
            {tp('Cancel', 'لغو', 'لغوه')}
          </button>
          <button
            onClick={handleSave}
            className="ms-auto flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition"
          >
            <Save className="w-4 h-4" />
            {editing ? tp('Save changes', 'ذخیره تغییرات', 'بدلونونه ساتل') : tp('Create document', 'ایجاد سند', 'سند جوړول')}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Printable composed document on company letterhead (full design engine). */
export const ComposedDocPaper: React.FC<{ doc: DocumentRecord; onClose: () => void }> = ({ doc, onClose }) => {
  const { appSettings, projects, tp } = useApp();
  const projectName = projects.find(p => p.id === doc.projectId)?.name || '';
  const text = substituteDocVars(
    doc.content || '',
    resolveComposedVars(doc, { companyName: appSettings.companyName || 'NSC', projectName }),
  );
  const vars = resolveComposedVars(doc, { companyName: '', projectName: '' });
  return (
    <DocPrintLayout
      docTitle={doc.title}
      docNo={`#${vars.docNo}`}
      date={doc.date}
      notes={doc.notes}
      section="documents"
      onClose={onClose}
    >
      <div className="text-xs leading-7 whitespace-pre-line">{text}</div>
      {doc.amount !== undefined && doc.amount !== null && (
        <div className="flex justify-between py-1.5 border-t border-slate-200 mt-3 text-xs">
          <span className="text-slate-500">{tp('Referenced amount', 'مبلغ مندرج', 'یاد شوی مبلغ')}</span>
          <span className="font-mono font-bold">{doc.amount}</span>
        </div>
      )}
    </DocPrintLayout>
  );
};
