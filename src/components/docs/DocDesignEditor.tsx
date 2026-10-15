import React, { useRef, useState } from 'react';
import { Upload, Download, RefreshCw, Type, Palette, MoveUp, MoveDown, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  FONT_OPTIONS, PAPER_OPTIONS, SECTION_LABELS, DEFAULT_SECTION_ORDER,
  TEMPLATE_MAX_BYTES, parseTemplateJson, exportTemplate,
} from '../../utils/docDesign';
import { sniffImageMime } from '../../utils/scanEngine';
import type { CustomBillDesign, DocSectionId } from '../../types';

interface DocDesignEditorProps {
  design: CustomBillDesign;
  onChange: (d: CustomBillDesign) => void;
  logoUrl?: string;
  onLogoChange: (url: string) => void;
  companyName?: string;
}

/**
 * Wave 27: self-service document design editor (Settings → Documents & Print).
 * Same sanitized core as the Office7 studio: logo, texts, colors, font, paper,
 * margins, section order, custom JSON templates. Every control is functional.
 */
export const DocDesignEditor: React.FC<DocDesignEditorProps> = ({
  design, onChange, logoUrl, onLogoChange, companyName,
}) => {
  const { tp } = useApp();
  const [templateErr, setTemplateErr] = useState('');
  const [logoErr, setLogoErr] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<CustomBillDesign>) => onChange({ ...design, ...patch });

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setLogoErr('');
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setLogoErr(tp('Logo must be under 1 MB.', 'لوگو باید کمتر از ۱ مگابایت باشد.', 'لوګو باید تر ۱ مېګابایټ کم وي.'));
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    if (!sniffImageMime(buf)) {
      setLogoErr(tp('Only a valid photo (JPG/PNG/WebP/GIF).', 'فقط عکس معتبر (JPG/PNG/WebP/GIF).', 'یوازې سم عکس (JPG/PNG/WebP/GIF).'));
      return;
    }
    try {
      const bmp = await createImageBitmap(new Blob([buf as unknown as BlobPart]));
      const s = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * s));
      c.height = Math.max(1, Math.round(bmp.height * s));
      c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      let url = c.toDataURL('image/png');
      if (url.length > 400000) url = c.toDataURL('image/jpeg', 0.85);
      onLogoChange(url);
    } catch {
      setLogoErr(tp('Could not read the logo file.', 'خواندن فایل لوگو ناموفق بود.', 'د لوګو فایل ونه لوستل شو.'));
    }
  };

  const handleTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setTemplateErr('');
    if (!file) return;
    if (file.size > TEMPLATE_MAX_BYTES) {
      setTemplateErr(tp('Template file is over 100 KB.', 'فایل تمپلت بیش از ۱۰۰ کیلوبایت است.', 'د تمپلېټ فایل تر ۱۰۰ کېلوبایټ زیات دی.'));
      return;
    }
    const res = parseTemplateJson(await file.text());
    if (!res.ok || !res.design) {
      setTemplateErr(tp('Invalid file — a template must be design JSON.', 'فایل معتبر نیست — تمپلت باید JSON طرح باشد.', 'فایل سم نه دی — تمپلېټ باید د طرحې JSON وي.'));
      return;
    }
    if (!confirm(tp('Replace the current design with the uploaded template?', 'طرح فعلی با تمپلت آپلودشده جایگزین شود؟', 'اوسنی طرح له پورته شوي تمپلېټ سره بدله شي؟'))) return;
    onChange(res.design);
  };

  const handleDownload = () => {
    const blob = new Blob([exportTemplate(design, companyName)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `doc-template-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  };

  const moveSection = (id: DocSectionId, dir: -1 | 1) => {
    const cur = design.sectionOrder && design.sectionOrder.length > 0 ? [...design.sectionOrder] : [...DEFAULT_SECTION_ORDER];
    const i = cur.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    set({ sectionOrder: cur });
  };

  const order = design.sectionOrder && design.sectionOrder.length > 0 ? design.sectionOrder : DEFAULT_SECTION_ORDER;

  const textInput = 'w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

  return (
    <div className="space-y-4">
      {/* Logo */}
      <div>
        <label className="block text-[11px] font-black text-ink mb-1.5">{tp('Company logo (photo upload)', 'لوگوی شرکت (آپلود عکس)', 'د شرکت لوګو (د عکس پورته کول)')}</label>
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="w-12 h-12 rounded-xl object-contain bg-surface-2 border border-line p-1" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-[10px] font-black text-ink-muted">NSC</div>
          )}
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
          >
            <Upload className="w-3.5 h-3.5" /> {tp('Upload logo', 'آپلود لوگو', 'لوګو پورته کول')}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={() => onLogoChange('')}
              className="px-3 py-2 rounded-xl bg-surface-2 text-ink text-xs font-bold transition"
            >
              {tp('Remove', 'حذف', 'لرې کول')}
            </button>
          )}
          <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleLogo} />
        </div>
        {logoErr && <p className="flex items-center gap-1 text-[11px] text-rose-500 font-bold mt-1"><AlertTriangle className="w-3.5 h-3.5" />{logoErr}</p>}
      </div>

      {/* Texts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          { k: 'receiptTitle', label: tp('Document title', 'عنوان سند', 'د سند سرلیک') },
          { k: 'receiptSubheader', label: tp('Subtitle', 'زیرعنوان', 'فرعي سرلیک') },
          { k: 'companyPhone', label: tp('Phone', 'تلفن', 'تلفن') },
          { k: 'companyAddress', label: tp('Address', 'آدرس', 'پته') },
          { k: 'taxNumber', label: tp('Tax number', 'نمبر مالیاتی', 'مالیاتي نمبر') },
          { k: 'receiptContact', label: tp('Contact line', 'خط تماس', 'د اړیکې کرښه') },
        ] as const).map(f => (
          <div key={f.k}>
            <label className="block text-[11px] font-bold text-ink-muted mb-1">{f.label}</label>
            <input
              type="text"
              value={(design[f.k] as string) || ''}
              onChange={e => set({ [f.k]: e.target.value } as Partial<CustomBillDesign>)}
              className={textInput}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Bank details (printed on bills)', 'مشخصات بانکی (چاپ روی بل)', 'بانکي مشخصات (په بل چاپېږي)')}</label>
        <textarea
          rows={2}
          value={design.bankDetails || ''}
          onChange={e => set({ bankDetails: e.target.value })}
          className={textInput}
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Terms & conditions', 'شرایط و ضوابط', 'شرایط او ضوابط')}</label>
        <textarea
          rows={2}
          value={design.termsAndConditions || ''}
          onChange={e => set({ termsAndConditions: e.target.value })}
          className={textInput}
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Footer line', 'متن پاورقی', 'د پاورقی متن')}</label>
        <input
          type="text"
          value={design.receiptFooter || ''}
          onChange={e => set({ receiptFooter: e.target.value })}
          className={textInput}
        />
      </div>

      {/* Colors */}
      <div>
        <label className="block text-[11px] font-black text-ink mb-1.5 flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-ink-muted" /> {tp('Brand colors', 'رنگ سازمانی', 'سازماني رنګ')}
        </label>
        <div className="flex flex-wrap items-center gap-4">
          {([
            { k: 'primaryColor', label: tp('Primary', 'اصلی', 'اصلي') },
            { k: 'accentColor', label: tp('Accent', 'تاکیدی', 'ټینګاري') },
          ] as const).map(f => (
            <div key={f.k} className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(design[f.k] || '') ? (design[f.k] as string) : '#0f172a'}
                onChange={e => set({ [f.k]: e.target.value } as Partial<CustomBillDesign>)}
                className="w-9 h-9 rounded-xl border border-line cursor-pointer bg-transparent"
              />
              <span className="text-[11px] font-bold text-ink-muted">{f.label}</span>
              <span className="text-[11px] font-mono text-ink-muted">{design[f.k] || ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Font + paper + margins */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-ink-muted mb-1 flex items-center gap-1">
            <Type className="w-3.5 h-3.5" /> {tp('Print font', 'فونت چاپی', 'چاپي فونټ')}
          </label>
          <select
            value={design.fontFamily || 'system'}
            onChange={e => set({ fontFamily: e.target.value })}
            className={textInput}
          >
            {FONT_OPTIONS.map(f => (
              <option key={f.id} value={f.id}>{f.labelFa}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Paper size', 'سایز کاغذ', 'د کاغذ سایز')}</label>
          <select
            value={design.paperSize || 'A4'}
            onChange={e => set({ paperSize: e.target.value as CustomBillDesign['paperSize'] })}
            className={textInput}
          >
            {PAPER_OPTIONS.map(p => (
              <option key={p.id} value={p.id}>{p.labelFa}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { k: 'fontScale', label: tp('Font scale', 'مقیاس فونت', 'د فونټ مقیاس'), min: 0.85, max: 1.3, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
          { k: 'marginMm', label: tp('Margin (mm)', 'حاشیه (م‌م)', 'حاشیه (م‌م)'), min: 4, max: 25, step: 1, fmt: (v: number) => `${v}mm` },
          { k: 'logoSize', label: tp('Logo size', 'اندازه لوگو', 'د لوګو سایز'), min: 28, max: 96, step: 2, fmt: (v: number) => `${v}px` },
        ] as const).map(s => (
          <div key={s.k}>
            <div className="flex justify-between text-[11px] font-bold text-ink-muted mb-1">
              <span>{s.label}</span>
              <span className="font-mono">{s.fmt((design[s.k] as number) ?? (s.k === 'fontScale' ? 1 : s.k === 'marginMm' ? 12 : 56))}</span>
            </div>
            <input
              type="range" min={s.min} max={s.max} step={s.step}
              value={(design[s.k] as number) ?? (s.k === 'fontScale' ? 1 : s.k === 'marginMm' ? 12 : 56)}
              onChange={e => set({ [s.k]: Number(e.target.value) } as Partial<CustomBillDesign>)}
              className="w-full h-2 accent-indigo-600 cursor-pointer"
            />
          </div>
        ))}
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {([
          { k: 'showQrCode', label: tp('QR verification code', 'کد اصالت QR', 'د QR تایید کوډ'), def: true },
          { k: 'showStampArea', label: tp('Stamp box', 'محل مهر', 'د ټاپې ځای'), def: false },
          { k: 'showWatermark', label: tp('Watermark', 'واترمارک', 'واټرمارک'), def: false },
        ] as const).map(t => (
          <label key={t.k} className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2/60 cursor-pointer text-xs font-bold text-ink">
            <span>{t.label}</span>
            <input
              type="checkbox"
              checked={design[t.k] !== undefined ? design[t.k] === true : t.def}
              onChange={e => set({ [t.k]: e.target.checked } as Partial<CustomBillDesign>)}
              className="w-4 h-4 accent-indigo-600"
            />
          </label>
        ))}
      </div>
      <div>
        <label className="block text-[11px] font-bold text-ink-muted mb-1">{tp('Watermark text', 'متن واترمارک', 'د واټرمارک متن')}</label>
        <input
          type="text"
          value={design.watermarkText || ''}
          onChange={e => set({ watermarkText: e.target.value })}
          className={textInput}
        />
      </div>

      {/* Section order */}
      <div>
        <label className="block text-[11px] font-black text-ink mb-1.5">{tp('Section order (below totals)', 'ترتیب بخش‌ها (پایین جمع)', 'د برخو ترتیب (تر ټولو لاندې)')}</label>
        <div className="space-y-1">
          {order.map(id => (
            <div key={id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface-2/60 text-xs font-bold text-ink">
              <span className="flex-1">{SECTION_LABELS[id]?.fa || id}</span>
              <button type="button" onClick={() => moveSection(id, -1)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition" aria-label="move up">
                <MoveUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => moveSection(id, 1)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition" aria-label="move down">
                <MoveDown className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Template */}
      <div>
        <label className="block text-[11px] font-black text-ink mb-1.5">{tp('Custom template (JSON file)', 'تمپلت دلخواه (فایل JSON)', 'خپل تمپلېټ (JSON فایل)')}</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => templateRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
          >
            <Upload className="w-3.5 h-3.5" /> {tp('Upload template', 'آپلود تمپلت', 'تمپلېټ پورته کول')}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 text-ink text-xs font-bold transition"
          >
            <Download className="w-3.5 h-3.5" /> {tp('Download current', 'دانلود طرح فعلی', 'اوسنی طرح ښکته کول')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(tp('Reset the design to system defaults?', 'طرح به پیش‌فرض سیستم برگردد؟', 'طرح دې ډیفالټ ته وګرځي؟'))) onChange({});
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 text-ink text-xs font-bold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {tp('Defaults', 'پیش‌فرض', 'ډیفالټ')}
          </button>
          <input ref={templateRef} type="file" accept=".json,application/json" className="hidden" onChange={handleTemplate} />
        </div>
        {templateErr && <p className="flex items-center gap-1 text-[11px] text-rose-500 font-bold mt-1"><AlertTriangle className="w-3.5 h-3.5" />{templateErr}</p>}
      </div>
    </div>
  );
};
