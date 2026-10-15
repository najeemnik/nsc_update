import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BUILDER_MAX_BLOCKS,
  DASHBOARD_SECTIONS,
  canUseBuilder,
  clearDraftLayout,
  createBlock,
  dashboardPageKey,
  defaultDashboardLayout,
  downloadTextFile,
  duplicateBlock,
  exportLayoutHTML,
  exportLayoutJSON,
  loadDraftLayout,
  loadPublishedLayout,
  moveBlock,
  moveBlockTo,
  parseLayoutFile,
  redoHistory,
  removeBlock,
  sanitizeBlock,
  sanitizeLayout,
  saveDraftLayout,
  undoHistory,
  updateBlock,
  updateBlockStyle,
  type BuilderBlock,
  type BuilderBlockStyle,
  type BuilderBlockType,
  type BuilderHistory,
  type PageLayout,
} from '../../utils/pageBuilder';
import { BlockView } from '../builder/BlockView';
import {
  Type, Heading1, Image as ImageIcon, MousePointerClick, Minus, MoveVertical,
  BarChart3, LayoutDashboard, Undo2, Redo2, Save, Rocket, Download, Upload,
  Trash2, Copy, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, Monitor,
  Tablet, Smartphone, Layers, ShieldAlert,
} from 'lucide-react';

interface BuilderViewProps {
  setActiveTab?: (tab: string) => void;
}

type Device = 'desktop' | 'tablet' | 'mobile';

const BLOCK_LABEL: Record<BuilderBlockType, string> = {
  dashboard_section: 'بخش داشبورد',
  heading: 'عنوان',
  text: 'متن',
  image: 'تصویر',
  button: 'دکمه',
  divider: 'خط جداکننده',
  spacer: 'فاصله',
  stat: 'آمار زنده',
};

const PALETTE: Array<{ type: BuilderBlockType; icon: React.ReactNode; hint: string }> = [
  { type: 'heading', icon: <Heading1 className="w-4 h-4" />, hint: 'عنوان H1/H2/H3' },
  { type: 'text', icon: <Type className="w-4 h-4" />, hint: 'پاراگراف متن' },
  { type: 'image', icon: <ImageIcon className="w-4 h-4" />, hint: 'تصویر + کپشن' },
  { type: 'button', icon: <MousePointerClick className="w-4 h-4" />, hint: 'دکمهٔ ناوبری' },
  { type: 'stat', icon: <BarChart3 className="w-4 h-4" />, hint: 'عدد زندهٔ مالی' },
  { type: 'divider', icon: <Minus className="w-4 h-4" />, hint: 'خط' },
  { type: 'spacer', icon: <MoveVertical className="w-4 h-4" />, hint: 'فاصلهٔ عمودی' },
];

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: 'max-w-4xl',
  tablet: 'max-w-[720px]',
  mobile: 'max-w-[390px]',
};

export const BuilderView: React.FC<BuilderViewProps> = ({ setActiveTab }) => {
  const { currentUser, publishPageLayout, builderRev, tp, language } = useApp();
  const pageKey = useMemo(
    () => dashboardPageKey(currentUser?.companyName || currentUser?.username),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.id],
  );
  const [layout, setLayout] = useState<PageLayout>(() => loadDraftLayout(pageKey) || loadPublishedLayout(pageKey) || defaultDashboardLayout());
  const [history, setHistory] = useState<BuilderHistory>({ past: [], future: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    setLayout(loadDraftLayout(pageKey) || loadPublishedLayout(pageKey) || defaultDashboardLayout());
    setHistory({ past: [], future: [] });
    setSelectedId(null);
    setDirty(false);
  }, [pageKey]);

  // External publish (another tab/device impersonation) refreshes the base silently.
  useEffect(() => { setDirty(true); }, [builderRev]);

  if (!canUseBuilder(currentUser)) {
    return (
      <div className="max-w-lg mx-auto mt-10 p-6 rounded-3xl bg-surface border border-line text-center space-y-3">
        <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
        <h2 className="font-black text-ink">{tp('No access', 'عدم دسترسی', 'لاسرسی نشته')}</h2>
        <p className="text-xs text-ink-muted leading-relaxed">
          {tp('The visual builder is available to company owners. Ask your administrator to grant the Builder tab.',
            'بیلدر تصویری مخصوص مالک شرکت است. از مدیر بخواهید تب «بیلدر» را برایتان فعال کند.',
            'بصري جوړونکی د شرکت د خاوند لپاره دی. له مدیر څخه وغواړئ چې «جوړونکی» ټب درته فعال کړي.')}
        </p>
      </div>
    );
  }

  const selected = layout.blocks.find(b => b.id === selectedId) || null;

  const commit = (blocks: BuilderBlock[]) => {
    setHistory(h => ({ past: [...h.past, layout].slice(-50), future: [] }));
    setLayout(prev => ({ ...prev, updatedAt: new Date().toISOString(), blocks }));
    setDirty(true);
  };

  const addBlock = (type: BuilderBlockType, refId?: string) => {
    if (layout.blocks.length >= BUILDER_MAX_BLOCKS) {
      setNotice(tp('Block limit reached (100).', 'سقف بلاک (۱۰۰) پر شد.', 'د بلاکونو حد (۱۰۰) ډک شو.'));
      return;
    }
    const blk = sanitizeBlock(createBlock(type, refId ? { refId } : undefined));
    commit([...layout.blocks, blk]);
    setSelectedId(blk.id);
  };

  const doUndo = () => {
    const r = undoHistory(history, layout);
    if (!r) return;
    setLayout(r.layout);
    setHistory(r.history);
    setDirty(true);
  };
  const doRedo = () => {
    const r = redoHistory(history, layout);
    if (!r) return;
    setLayout(r.layout);
    setHistory(r.history);
    setDirty(true);
  };

  const handleSaveDraft = () => {
    if (saveDraftLayout(pageKey, layout)) {
      setNotice(tp('Draft saved on this device.', 'پیش‌نویس در این دستگاه ذخیره شد.', 'مسوده په دې وسیله کې خوندي شوه.'));
      setTimeout(() => setNotice(null), 3000);
    }
  };
  const handlePublish = () => {
    publishPageLayout(pageKey, layout);
    setDirty(false);
    setNotice(tp('Published! The dashboard now uses this layout.', 'منتشر شد! داشبورد از این چیدمان استفاده می‌کند.', 'خپور شو! ډشبورډ اوس له دې چیدمان څخه کار اخلي.'));
    setTimeout(() => setNotice(null), 4000);
  };

  const handleReset = () => {
    if (!window.confirm(tp('Reset to the default dashboard?', 'به چیدمان پیش‌فرض داشبورد برگردد؟', 'ډیفالټ ډشبورډ ته ستون شي؟') as string)) return;
    const fresh = defaultDashboardLayout();
    commit(fresh.blocks);
    setSelectedId(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseLayoutFile(await file.text());
      commit(parsed.blocks);
      setNotice(tp('Layout imported (not published yet).', 'چیدمان وارد شد (هنوز منتشر نشده).', 'چیدمان وارد شو (تر اوسه نه دی خپور شوی).'));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Invalid file.');
    }
  };

  const presentSections = new Set(
    layout.blocks.filter(b => b.type === 'dashboard_section').map(b => b.refId),
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="p-3 rounded-2xl bg-surface border border-line shadow-sm flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 font-black text-ink text-sm">
          <LayoutDashboard className="w-5 h-5 text-indigo-500" />
          <span>{tp('Visual builder — Dashboard page', 'بیلدر تصویری — صفحهٔ داشبورد', 'بصري جوړونکی — د ډشبورډ پاڼه')}</span>
          {dirty && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold">{tp('unsaved', 'ذخیره‌نشده', 'نه‌خوندي')}</span>}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-2/60 border border-line">
          {([['desktop', <Monitor key="d" className="w-4 h-4" />], ['tablet', <Tablet key="t" className="w-4 h-4" />], ['mobile', <Smartphone key="m" className="w-4 h-4" />]] as Array<[Device, React.ReactNode]>).map(([d, icon]) => (
            <button key={d} type="button" onClick={() => setDevice(d)} title={d}
              className={`p-2 rounded-lg transition-colors ${device === d ? 'bg-indigo-600 text-white' : 'text-ink-muted hover:text-ink'}`}>
              {icon}
            </button>
          ))}
        </div>
        <button type="button" onClick={doUndo} disabled={!history.past.length} title="Undo"
          className="p-2 rounded-xl border border-line text-ink-muted hover:text-ink disabled:opacity-40 transition-colors">
          <Undo2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={doRedo} disabled={!history.future.length} title="Redo"
          className="p-2 rounded-xl border border-line text-ink-muted hover:text-ink disabled:opacity-40 transition-colors">
          <Redo2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleSaveDraft}
          className="px-3 py-2 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-xs font-black flex items-center gap-1.5 transition-colors">
          <Save className="w-4 h-4" /><span className="hidden sm:inline">{tp('Draft', 'پیش‌نویس', 'مسوده')}</span>
        </button>
        <button type="button" onClick={handlePublish}
          className="px-4 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all">
          <Rocket className="w-4 h-4" /><span>{tp('Publish', 'انتشار', 'خپرول')}</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_260px] gap-4 items-start">
        {/* Palette + layers */}
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-surface border border-line space-y-2">
            <h3 className="text-[11px] font-black text-ink-muted uppercase">{tp('Add block', 'افزودن بلاک', 'بلاک ورګډوه')}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {PALETTE.map(p => (
                <button key={p.type} type="button" onClick={() => addBlock(p.type)} title={p.hint}
                  className="flex items-center gap-2 p-2 rounded-xl border border-line hover:border-indigo-400 hover:bg-indigo-500/5 text-xs font-bold text-ink transition-colors">
                  <span className="text-indigo-500">{p.icon}</span>
                  <span>{BLOCK_LABEL[p.type]}</span>
                </button>
              ))}
            </div>
            <h3 className="text-[11px] font-black text-ink-muted uppercase pt-2">{tp('Live sections', 'بخش‌های زنده', 'ژوندۍ برخې')}</h3>
            <div className="space-y-1.5">
              {DASHBOARD_SECTIONS.map(s => {
                const used = presentSections.has(s.id);
                return (
                  <button key={s.id} type="button" disabled={used} onClick={() => addBlock('dashboard_section', s.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-xl border border-line text-xs font-bold transition-colors disabled:opacity-40 text-ink hover:border-emerald-400 hover:bg-emerald-500/5">
                    <LayoutDashboard className="w-4 h-4 text-emerald-500" />
                    <span>{s.labelFa}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-surface border border-line space-y-1.5">
            <h3 className="text-[11px] font-black text-ink-muted uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />{tp('Layers', 'لایه‌ها', 'پرتوونه')} ({layout.blocks.length})
            </h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {layout.blocks.map((b, i) => (
                <div key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${selectedId === b.id ? 'bg-indigo-600 text-white' : 'hover:bg-surface-2 text-ink'}`}>
                  <span className="text-[10px] opacity-60 w-5 shrink-0">{i + 1}</span>
                  <span className="flex-1 truncate">
                    {b.type === 'dashboard_section'
                      ? (DASHBOARD_SECTIONS.find(s => s.id === b.refId)?.labelFa || b.refId)
                      : `${BLOCK_LABEL[b.type]}${b.text ? ` — ${b.text.slice(0, 14)}` : ''}`}
                  </span>
                  <button type="button" title={b.hidden ? 'show' : 'hide'}
                    onClick={(e) => { e.stopPropagation(); commit(layout.blocks.map(x => x.id === b.id ? { ...x, hidden: !x.hidden } : x)); }}
                    className="p-1 opacity-70 hover:opacity-100">
                    {b.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-surface border border-line grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => downloadTextFile(`dashboard-${pageKey.replace(/[^a-z0-9]+/gi, '-')}.json`, exportLayoutJSON(layout), 'application/json')}
              className="p-2 rounded-xl border border-line text-[11px] font-black text-ink hover:border-indigo-400 flex items-center justify-center gap-1">
              <Download className="w-3.5 h-3.5" /> JSON
            </button>
            <button type="button" onClick={() => downloadTextFile('dashboard-export.html', exportLayoutHTML(layout, 'Dashboard', language === 'en' ? 'ltr' : 'rtl'), 'text/html')}
              className="p-2 rounded-xl border border-line text-[11px] font-black text-ink hover:border-indigo-400 flex items-center justify-center gap-1">
              <Download className="w-3.5 h-3.5" /> HTML
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="p-2 rounded-xl border border-line text-[11px] font-black text-ink hover:border-indigo-400 flex items-center justify-center gap-1">
              <Upload className="w-3.5 h-3.5" /> {tp('Import', 'وارد', 'واردول')}
            </button>
            <button type="button" onClick={handleReset}
              className="p-2 rounded-xl border border-rose-300 text-[11px] font-black text-rose-600 hover:bg-rose-500/10 flex items-center justify-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> {tp('Reset', 'ریست', 'ریسټ')}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
          </div>
        </div>

        {/* Canvas */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface-2/40 border border-line min-h-[420px]">
          <div className={`mx-auto space-y-3 transition-all ${DEVICE_WIDTH[device]}`}>
            {layout.blocks.map((b, i) => (
              <div key={b.id}
                draggable
                onDragStart={() => { dragId.current = b.id; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId.current && dragId.current !== b.id) { commit(moveBlockTo(layout.blocks, dragId.current, i)); } dragId.current = null; }}
                onClick={() => setSelectedId(b.id)}
                className={`relative rounded-2xl border-2 transition-colors ${selectedId === b.id ? 'border-indigo-500' : 'border-transparent hover:border-indigo-300'} ${b.hidden ? 'opacity-40' : ''}`}
              >
                {b.type === 'dashboard_section' ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-dashed border-emerald-500/50 text-center">
                    <LayoutDashboard className="w-5 h-5 mx-auto text-emerald-500" />
                    <div className="text-xs font-black text-ink mt-1">
                      {DASHBOARD_SECTIONS.find(s => s.id === b.refId)?.labelFa || b.refId}
                    </div>
                    <div className="text-[10px] text-ink-muted">{tp('live preview on the dashboard', 'پیش‌نمایش زنده در داشبورد', 'په ډشبورډ کې ژوندۍ مخکتنه')}</div>
                  </div>
                ) : (
                  <div className="p-2 rounded-2xl bg-surface border border-line pointer-events-none">
                    <BlockView block={b} stats={{ expenses: 12500, paid: 9200, debt: 3300, sales: 48000 }} formatMoney={(v) => `$${v.toLocaleString()}`} />
                  </div>
                )}
                {selectedId === b.id && (
                  <div className="absolute -top-3 start-2 flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-900 text-white shadow-lg" onClick={(e) => e.stopPropagation()}>
                    <ToolBtn title="up" onClick={() => commit(moveBlock(layout.blocks, b.id, -1))}><ChevronUp className="w-3.5 h-3.5" /></ToolBtn>
                    <ToolBtn title="down" onClick={() => commit(moveBlock(layout.blocks, b.id, 1))}><ChevronDown className="w-3.5 h-3.5" /></ToolBtn>
                    <ToolBtn title="duplicate" onClick={() => commit(duplicateBlock(layout.blocks, b.id))}><Copy className="w-3.5 h-3.5" /></ToolBtn>
                    <ToolBtn title="delete" onClick={() => { commit(removeBlock(layout.blocks, b.id)); setSelectedId(null); }}><Trash2 className="w-3.5 h-3.5" /></ToolBtn>
                  </div>
                )}
              </div>
            ))}
            {layout.blocks.length === 0 && (
              <p className="text-center text-xs text-ink-muted py-10">{tp('Canvas is empty — add blocks from the palette.', 'بوم خالی است — از پالت بلاک اضافه کنید.', 'توخته تش دی — له پالټ څخه بلاکونه ورګډ کړئ.')}</p>
            )}
          </div>
        </div>

        {/* Inspector */}
        <div className="p-3 rounded-2xl bg-surface border border-line space-y-3 lg:sticky lg:top-3">
          <h3 className="text-[11px] font-black text-ink-muted uppercase">{tp('Block settings', 'تنظیمات بلاک', 'د بلاک امستنې')}</h3>
          {!selected && <p className="text-xs text-ink-muted">{tp('Select a block on the canvas.', 'یک بلاک را در بوم انتخاب کنید.', 'په توخته کې یو بلاک وټاکئ.')}</p>}
          {selected && (
            <Inspector
              block={selected}
              onPatch={(patch) => commit(updateBlock(layout.blocks, selected.id, patch))}
              onStyle={(patch) => commit(updateBlockStyle(layout.blocks, selected.id, patch))}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const ToolBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button type="button" title={title} onClick={onClick} className="p-1.5 rounded-md hover:bg-white/20 transition-colors">
    {children}
  </button>
);

const Inspector: React.FC<{
  block: BuilderBlock;
  onPatch: (patch: Partial<BuilderBlock>) => void;
  onStyle: (patch: Partial<BuilderBlockStyle>) => void;
}> = ({ block: b, onPatch, onStyle }) => {
  const { tp } = useApp();
  const inputCls = 'w-full px-2.5 py-1.5 bg-surface-2/60 border border-line rounded-lg text-ink text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40';
  const labelCls = 'block text-[11px] font-bold text-ink-muted mb-1';
  return (
    <div className="space-y-3">
      <div className="text-xs font-black text-ink px-2 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
        {BLOCK_LABEL[b.type]}
      </div>
      {(b.type === 'heading' || b.type === 'text' || b.type === 'button') && (
        <div>
          <label className={labelCls}>{tp('Text', 'متن', 'متن')}</label>
          {b.type === 'text' ? (
            <textarea value={b.text || ''} rows={4} onChange={(e) => onPatch({ text: e.target.value })} className={inputCls} />
          ) : (
            <input value={b.text || ''} onChange={(e) => onPatch({ text: e.target.value })} className={inputCls} />
          )}
        </div>
      )}
      {b.type === 'heading' && (
        <div>
          <label className={labelCls}>{tp('Level', 'سطح', 'کچه')}</label>
          <div className="flex gap-1">
            {([1, 2, 3] as const).map(l => (
              <button key={l} type="button" onClick={() => onPatch({ level: l })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black border transition-colors ${b.level === l ? 'bg-indigo-600 text-white border-indigo-600' : 'border-line text-ink'}`}>
                H{l}
              </button>
            ))}
          </div>
        </div>
      )}
      {b.type === 'image' && (
        <>
          <div>
            <label className={labelCls}>{tp('Image URL (https)', 'آدرس تصویر (https)', 'د انځور پته (https)')}</label>
            <input value={b.url || ''} dir="ltr" placeholder="https://…" onChange={(e) => onPatch({ url: e.target.value })} className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className={labelCls}>{tp('Caption', 'کپشن', 'سرلیک')}</label>
            <input value={b.text || ''} onChange={(e) => onPatch({ text: e.target.value })} className={inputCls} />
          </div>
        </>
      )}
      {b.type === 'button' && (
        <div>
          <label className={labelCls}>{tp('Target tab', 'تب مقصد', 'ټاکلې پاڼه')}</label>
          <input value={b.targetTab || ''} dir="ltr" placeholder="reports" onChange={(e) => onPatch({ targetTab: e.target.value })} className={`${inputCls} font-mono`} />
        </div>
      )}
      {b.type === 'stat' && (
        <div>
          <label className={labelCls}>{tp('Metric', 'شاخص', 'شاخص')}</label>
          <select value={b.statKind || 'expenses'} onChange={(e) => onPatch({ statKind: e.target.value as BuilderBlock['statKind'] })} className={inputCls}>
            <option value="expenses">مصارف</option>
            <option value="paid">پرداخت‌ها</option>
            <option value="debt">بدهی</option>
            <option value="sales">فروش</option>
          </select>
        </div>
      )}
      {b.type !== 'dashboard_section' && b.type !== 'divider' && b.type !== 'spacer' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{tp('Text color', 'رنگ متن', 'د متن رنګ')}</label>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(b.style?.color || '') ? b.style!.color : '#0f172a'}
                onChange={(e) => onStyle({ color: e.target.value })} className="w-full h-8 rounded-lg border border-line bg-transparent cursor-pointer" />
            </div>
            <div>
              <label className={labelCls}>{tp('Background', 'پس‌زمینه', 'شالید')}</label>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(b.style?.background || '') ? b.style!.background : '#ffffff'}
                onChange={(e) => onStyle({ background: e.target.value })} className="w-full h-8 rounded-lg border border-line bg-transparent cursor-pointer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{tp('Font size', 'اندازه فونت', 'د فونټ کچه')} ({b.style?.fontSize || '—'})</label>
              <input type="range" min={10} max={48} value={b.style?.fontSize || 16} onChange={(e) => onStyle({ fontSize: Number(e.target.value) })} className="w-full accent-indigo-600" />
            </div>
            <div>
              <label className={labelCls}>{tp('Align', 'تراز', 'برابرول')}</label>
              <select value={b.style?.align || 'start'} onChange={(e) => onStyle({ align: e.target.value as BuilderBlockStyle['align'] })} className={inputCls}>
                <option value="start">راست</option>
                <option value="center">وسط</option>
                <option value="end">چپ</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{tp('Margin', 'حاشیه خارجی', 'بهرنۍ حاشیه')} ({b.style?.marginTop || 0}/{b.style?.marginBottom || 0})</label>
              <input type="range" min={0} max={80} value={b.style?.marginTop || 0}
                onChange={(e) => onStyle({ marginTop: Number(e.target.value), marginBottom: Number(e.target.value) })} className="w-full accent-indigo-600" />
            </div>
            <div>
              <label className={labelCls}>{tp('Padding', 'حاشیه داخلی', 'دنننۍ حاشیه')} ({b.style?.padding || 0})</label>
              <input type="range" min={0} max={48} value={b.style?.padding || 0} onChange={(e) => onStyle({ padding: Number(e.target.value) })} className="w-full accent-indigo-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{tp('Radius', 'گردی گوشه', 'ګردوالی')} ({b.style?.radius || 0})</label>
              <input type="range" min={0} max={48} value={b.style?.radius || 0} onChange={(e) => onStyle({ radius: Number(e.target.value) })} className="w-full accent-indigo-600" />
            </div>
            <div>
              <label className={labelCls}>{tp('Width %', 'عرض ٪', 'پلنوالی ٪')} ({b.style?.widthPct || 100})</label>
              <input type="range" min={20} max={100} step={5} value={b.style?.widthPct || 100} onChange={(e) => onStyle({ widthPct: Number(e.target.value) })} className="w-full accent-indigo-600" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
