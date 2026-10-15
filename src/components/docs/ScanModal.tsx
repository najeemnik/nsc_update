import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Upload, FileText, X, Check, RotateCw, Plus, Image as ImageIcon, ChevronLeft, ChevronRight, ScanLine, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  RawImage, CornerPoints, ScanAdjust, SCAN_LIMITS,
  defaultCorners, defaultAdjust, validateUploadBytes, readFileBytes,
  decodeToRaw, warpPerspective, applyAdjust, paintToCanvas,
  canvasToJpegBytes, bytesToDataUrl, encodePdfFromJpegs, sniffImageMime,
} from '../../utils/scanEngine';
import { makeAttachment } from '../../utils/attachments';
import type { StoredAttachment } from '../../types';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: (attachments: StoredAttachment[]) => void;
  title?: string;
}

interface ScanPage {
  id: string;
  raw: RawImage;
  corners: CornerPoints;
  rotation: 0 | 90 | 180 | 270;
  adjust: ScanAdjust;
}

type Step = 'source' | 'crop' | 'adjust';

const CORNER_KEYS: (keyof CornerPoints)[] = ['tl', 'tr', 'br', 'bl'];

/** Pure 90°-step rotation of a pixel buffer. */
const rotateRaw = (img: RawImage, deg: 0 | 90 | 180 | 270): RawImage => {
  if (deg === 0) return img;
  const { width: w, height: h, data } = img;
  const swap = deg === 90 || deg === 270;
  const ow = swap ? h : w;
  const oh = swap ? w : h;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let sx = 0;
      let sy = 0;
      if (deg === 90) { sx = y; sy = h - 1 - x; }
      else if (deg === 180) { sx = w - 1 - x; sy = h - 1 - y; }
      else { sx = w - 1 - y; sy = x; }
      const si = (sy * w + sx) * 4;
      const oi = (y * ow + x) * 4;
      out[oi] = data[si]; out[oi + 1] = data[si + 1]; out[oi + 2] = data[si + 2]; out[oi + 3] = 255;
    }
  }
  return { width: ow, height: oh, data: out };
};

const cloneRaw = (img: RawImage): RawImage =>
  ({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) });

let pageSeq = 0;

export const ScanModal: React.FC<ScanModalProps> = ({ isOpen, onClose, onDone, title }) => {
  const { tp, language, currentUser } = useApp();
  const [step, setStep] = useState<Step>('source');
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragKey = useRef<keyof CornerPoints | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const active = pages[activeIdx] || null;
  const rtl = language !== 'en';

  const errText = useCallback((code: string): string => {
    switch (code) {
      case 'empty-file': return tp('File is empty.', 'فایل خالی است.', 'فایل تش دی.');
      case 'too-large': return tp('File is too large (max 15 MB).', 'فایل بیش از حد بزرگ است (حداکثر ۱۵ مگابایت).', 'فایل ډېر لوی دی (تر ۱۵ مېګابایټه).');
      case 'unsupported-type': return tp('Only photos (JPG/PNG/WebP) are accepted for scanning.', 'برای اسکن فقط عکس (JPG/PNG/WebP) پذیرفته می‌شود.', 'د سکین لپاره یوازې عکس (JPG/PNG/WebP) منل کېږي.');
      case 'too-small': return tp('Selected area is too small — widen the corners.', 'ناحیه انتخاب‌شده خیلی کوچک است — گوشه‌ها را بازتر کنید.', 'ټاکل شوې ساحه ډېره کوچنۍ ده — کونجونه پراخ کړئ.');
      case 'decode-failed': return tp('Could not read this image.', 'این عکس خوانده نشد.', 'دا عکس ونه لوستل شو.');
      default: return tp('Something went wrong.', 'خطایی رخ داد.', 'ستونزه پېښه شوه.');
    }
  }, [tp]);

  const reset = useCallback(() => {
    setStep('source');
    setPages([]);
    setActiveIdx(0);
    setError(null);
    setBusy(false);
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  // paint crop-step base image (rotated raw)
  useEffect(() => {
    if (!isOpen || step !== 'crop' || !active || !cropCanvasRef.current) return;
    try {
      paintToCanvas(rotateRaw(active.raw, active.rotation), cropCanvasRef.current);
    } catch {
      setError(errText('decode-failed'));
    }
  }, [isOpen, step, active, errText]);

  // live adjust preview (debounced, low-res for speed)
  useEffect(() => {
    if (!isOpen || step !== 'adjust' || !active) return;
    const t = setTimeout(() => {
      try {
        const rotated = rotateRaw(active.raw, active.rotation);
        const flat = warpPerspective(rotated, active.corners, 900);
        if (!flat) {
          setPreviewUrl(null);
          setError(errText('too-small'));
          return;
        }
        setError(null);
        applyAdjust(flat, active.adjust);
        const c = document.createElement('canvas');
        paintToCanvas(flat, c);
        setPreviewUrl(c.toDataURL('image/jpeg', 0.7));
      } catch {
        setPreviewUrl(null);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [isOpen, step, active, errText]);

  const ingestFiles = useCallback(async (files: FileList | null, fromCamera: boolean) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const fresh: ScanPage[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        const bytes = await readFileBytes(file).catch(() => null);
        if (!bytes) {
          setError(errText(file.size > SCAN_LIMITS.maxInputBytes ? 'too-large' : 'decode-failed'));
          continue;
        }
        const check = validateUploadBytes(bytes, false);
        if (!check.ok || !sniffImageMime(bytes)) {
          setError(errText(check.error || 'unsupported-type'));
          continue;
        }
        try {
          const raw = await decodeToRaw(bytes);
          fresh.push({
            id: `pg-${Date.now()}-${pageSeq++}`,
            raw,
            corners: defaultCorners(),
            rotation: 0,
            adjust: defaultAdjust(),
          });
        } catch {
          setError(errText('decode-failed'));
        }
      }
      if (fresh.length > 0) {
        setPages(prev => {
          setActiveIdx(prev.length);
          return [...prev, ...fresh].slice(0, 10);
        });
        setStep(fromCamera || pages.length === 0 ? 'crop' : step);
        if (!fromCamera && pages.length > 0) setStep('adjust');
        else setStep('crop');
      }
    } finally {
      setBusy(false);
    }
  }, [errText, pages.length, step]);

  const updateCorners = useCallback((idx: number, corners: CornerPoints) => {
    setPages(prev => prev.map((p, i) => (i === idx ? { ...p, corners } : p)));
  }, []);

  const updateAdjust = useCallback((idx: number, patch: Partial<ScanAdjust>) => {
    setPages(prev => prev.map((p, i) => (i === idx ? { ...p, adjust: { ...p.adjust, ...patch } } : p)));
  }, []);

  const rotateActive = useCallback(() => {
    setPages(prev => prev.map((p, i) => {
      if (i !== activeIdx) return p;
      const rotation = ((p.rotation + 90) % 360) as ScanPage['rotation'];
      return { ...p, rotation, corners: defaultCorners() };
    }));
  }, [activeIdx]);

  // corner dragging (pointer events — mouse + touch)
  const cornerPos = (e: React.PointerEvent, key: keyof CornerPoints) => {
    const frame = frameRef.current;
    if (!frame) return;
    const r = frame.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    if (!active) return;
    updateCorners(activeIdx, { ...active.corners, [key]: { x, y } });
  };

  const exportPages = useCallback(async (wantImages: boolean, wantPdf: boolean) => {
    if (pages.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const out: StoredAttachment[] = [];
      const jpegs: { jpeg: Uint8Array; width: number; height: number }[] = [];
      const stamp = new Date().toISOString().split('T')[0];
      for (let i = 0; i < pages.length; i++) {
        const pg = pages[i];
        const rotated = rotateRaw(pg.raw, pg.rotation);
        const flat = warpPerspective(rotated, pg.corners, SCAN_LIMITS.defaultOutputDim);
        if (!flat) {
          setError(errText('too-small'));
          setActiveIdx(i);
          setStep('crop');
          setBusy(false);
          return;
        }
        applyAdjust(flat, pg.adjust);
        const c = document.createElement('canvas');
        paintToCanvas(flat, c);
        // shrink until under the per-file cap
        let quality = SCAN_LIMITS.jpegQuality;
        let bytes = await canvasToJpegBytes(c, quality);
        let dim = Math.max(c.width, c.height);
        while (bytes.length > SCAN_LIMITS.maxStoredBytes && (quality > 0.5 || dim > 1000)) {
          if (quality > 0.5) {
            quality -= 0.12;
          } else {
            dim = Math.round(dim * 0.8);
            const s = Math.min(1, dim / Math.max(c.width, c.height));
            const small = document.createElement('canvas');
            small.width = Math.round(c.width * s);
            small.height = Math.round(c.height * s);
            small.getContext('2d')?.drawImage(c, 0, 0, small.width, small.height);
            bytes = await canvasToJpegBytes(small, quality);
            jpegs.push({ jpeg: bytes, width: small.width, height: small.height });
            break;
          }
          bytes = await canvasToJpegBytes(c, quality);
        }
        if (jpegs.length === i) jpegs.push({ jpeg: bytes, width: c.width, height: c.height });
        else jpegs[i] = { jpeg: bytes, width: jpegs[i]?.width || c.width, height: jpegs[i]?.height || c.height };
        if (wantImages) {
          out.push(makeAttachment({
            name: `scan-${stamp}-p${i + 1}.jpg`,
            kind: 'scan',
            mime: 'image/jpeg',
            dataUrl: bytesToDataUrl(bytes, 'image/jpeg'),
            size: bytes.length,
            uploadedBy: currentUser?.name || currentUser?.username,
            width: c.width,
            height: c.height,
          }));
        }
      }
      if (wantPdf) {
        const pdfBytes = encodePdfFromJpegs(jpegs);
        out.push(makeAttachment({
          name: `scan-${stamp}.pdf`,
          kind: 'pdf',
          mime: 'application/pdf',
          dataUrl: bytesToDataUrl(pdfBytes, 'application/pdf'),
          size: pdfBytes.length,
          uploadedBy: currentUser?.name || currentUser?.username,
          pageCount: jpegs.length,
        }));
      }
      onDone(out);
      onClose();
    } catch {
      setError(errText('decode-failed'));
    } finally {
      setBusy(false);
    }
  }, [pages, currentUser, errText, onDone, onClose]);

  const steps = useMemo(() => ([
    { id: 'source', label: tp('Capture', 'گرفتن', 'اخیستل') },
    { id: 'crop', label: tp('Corners', 'گوشه‌ها', 'کونجونه') },
    { id: 'adjust', label: tp('Enhance', 'بهبود', 'ښه کول') },
  ]), [tp]);

  if (!isOpen) return null;

  const polyPoints = active
    ? CORNER_KEYS.map(k => `${(active.corners[k].x * 100).toFixed(2)},${(active.corners[k].y * 100).toFixed(2)}`).join(' ')
    : '';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm sm:p-4" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-3xl bg-surface border border-line sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-line bg-gradient-to-r from-indigo-600/10 to-transparent shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-ink">{title || tp('Bill Scanner', 'اسکنر بل', 'د بل سکینر')}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                {steps.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {i > 0 && <div className="w-4 h-px bg-line" />}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${step === s.id ? 'bg-indigo-600 text-white' : 'bg-surface-2 text-ink-muted'}`}>
                      {i + 1}. {s.label}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-ink hover:bg-surface-2 rounded-xl transition" aria-label="close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-4 sm:mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-[11px] font-bold shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0">
          {step === 'source' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={busy}
                className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm transition active:scale-[0.98]"
              >
                <Camera className="w-8 h-8" />
                {tp('Take Photo (rear camera)', 'گرفتن عکس (کمره عقب)', 'عکس اخیستل (شاته کامره)')}
                <span className="text-[10px] font-medium opacity-80">{tp('Opens your device camera', 'کمره دستگاه باز می‌شود', 'د دستګاه کامره خلاصېږي')}</span>
              </button>
              <button
                onClick={() => uploadRef.current?.click()}
                disabled={busy}
                className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-surface-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-ink font-black text-sm transition active:scale-[0.98]"
              >
                <Upload className="w-8 h-8" />
                {tp('Upload Bill Photo', 'آپلود عکس بل', 'د بل عکس پورته کول')}
                <span className="text-[10px] font-medium opacity-70">JPG / PNG / WebP • {tp('up to 10 pages', 'تا ۱۰ صفحه', 'تر ۱۰ مخه')}</span>
              </button>
              {busy && <p className="col-span-full text-center text-xs text-ink-muted animate-pulse">{tp('Reading…', 'در حال خواندن…', 'لوستل کېږي…')}</p>}
            </div>
          )}

          {step === 'crop' && active && (
            <div className="space-y-3">
              <p className="text-[11px] text-ink-muted font-semibold">
                {tp('Drag the 4 corner handles to the bill edges, then continue.', '۴ دستگیره گوشه را روی لبه‌های بل بکشید، بعد ادامه دهید.', '۴ کونجونه د بل څنډو ته کش کړئ، بیا مخته ولاړ شئ.')}
              </p>
              <div ref={frameRef} className="relative rounded-2xl overflow-hidden bg-black/80 border border-line select-none" style={{ touchAction: 'none' }}>
                <canvas ref={cropCanvasRef} className="w-full h-auto block" />
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points={polyPoints} fill="rgba(99,102,241,0.18)" stroke="#818cf8" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                </svg>
                {CORNER_KEYS.map(k => (
                  <button
                    key={k}
                    aria-label={`corner-${k}`}
                    className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-indigo-500 border-[3px] border-white shadow-lg cursor-grab active:cursor-grabbing active:scale-110 transition-transform"
                    style={{ left: `${active.corners[k].x * 100}%`, top: `${active.corners[k].y * 100}%`, touchAction: 'none' }}
                    onPointerDown={e => {
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      dragKey.current = k;
                    }}
                    onPointerMove={e => {
                      if (dragKey.current === k) cornerPos(e, k);
                    }}
                    onPointerUp={() => { dragKey.current = null; }}
                    onPointerCancel={() => { dragKey.current = null; }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => updateCorners(activeIdx, defaultCorners())} className="px-3 py-2 rounded-xl bg-surface-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-ink transition">
                  {tp('Full Page', 'تمام صفحه', 'بشپړ مخ')}
                </button>
                <button onClick={rotateActive} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-ink transition">
                  <RotateCw className="w-4 h-4" /> {tp('Rotate', 'چرخش', 'څرخول')}
                </button>
                <span className="ms-auto text-[11px] text-ink-muted font-semibold">
                  {tp('Page', 'صفحه', 'مخ')} {activeIdx + 1} / {pages.length}
                </span>
              </div>
            </div>
          )}

          {step === 'adjust' && active && (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-line bg-black/80">
                {previewUrl ? (
                  <img src={previewUrl} alt="scan preview" className="w-full h-auto block max-h-[46vh] object-contain mx-auto" draggable={false} />
                ) : (
                  <div className="py-14 text-center text-xs text-slate-400 animate-pulse">{tp('Rendering preview…', 'پیش‌نمایش…', 'مخکتنه…')}</div>
                )}
              </div>

              {/* mode */}
              <div className="grid grid-cols-3 gap-2">
                {(['color', 'gray', 'bw'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => updateAdjust(activeIdx, { mode: m })}
                    className={`py-2.5 rounded-xl text-xs font-black transition active:scale-[0.98] ${active.adjust.mode === m ? 'bg-indigo-600 text-white' : 'bg-surface-2 text-ink hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {m === 'color' ? tp('Color', 'رنگی', 'رنګه') : m === 'gray' ? tp('Gray', 'خاکستری', 'خړ') : tp('B&W', 'سیاه‌وسفید', 'تور او سپین')}
                  </button>
                ))}
              </div>

              {/* sliders */}
              {([
                { k: 'brightness', label: tp('Brightness', 'روشنایی', 'روښنايي'), min: -100, max: 100 },
                { k: 'contrast', label: tp('Contrast', 'تضاد', 'تضاد'), min: -100, max: 100 },
                { k: 'sharpness', label: tp('Sharpness', 'وضاحت', 'وضاحت'), min: 0, max: 100 },
              ] as const).map(s => (
                <div key={s.k}>
                  <div className="flex justify-between text-[11px] font-bold text-ink-muted mb-1">
                    <span>{s.label}</span>
                    <span className="font-mono">{active.adjust[s.k]}</span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    value={active.adjust[s.k]}
                    onChange={e => updateAdjust(activeIdx, { [s.k]: Number(e.target.value) } as Partial<ScanAdjust>)}
                    className="w-full h-2 accent-indigo-600 cursor-pointer"
                  />
                </div>
              ))}
              {active.adjust.mode === 'bw' && (
                <button
                  onClick={() => updateAdjust(activeIdx, { bwThreshold: active.adjust.bwThreshold === undefined ? 127 : undefined })}
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  {active.adjust.bwThreshold === undefined
                    ? tp('Auto threshold (Otsu) — tap for manual', 'آستانه خودکار — برای دستی بزنید', 'اتومات حد — د لاسي لپاره ووهئ')
                    : tp('Manual threshold 127 — tap for auto', 'آستانه دستی ۱۲۷ — برای خودکار بزنید', 'لاسي حد ۱۲۷ — د اتومات لپاره ووهئ')}
                </button>
              )}

              {/* pages strip */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-ink">{tp('Pages', 'صفحه‌ها', 'مخونه')} ({pages.length}/10)</span>
                  <button
                    onClick={() => uploadRef.current?.click()}
                    disabled={pages.length >= 10 || busy}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" /> {tp('Add page', 'افزودن صفحه', 'مخ ورزياتول')}
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pages.map((p, i) => (
                    <div key={p.id} className="relative shrink-0">
                      <button
                        onClick={() => { setActiveIdx(i); setStep('crop'); }}
                        className={`block w-16 h-20 rounded-xl overflow-hidden border-2 transition ${i === activeIdx ? 'border-indigo-500' : 'border-line'}`}
                      >
                        <MiniThumb raw={p.raw} />
                      </button>
                      {pages.length > 1 && (
                        <button
                          onClick={() => {
                            setPages(prev => prev.filter((_, j) => j !== i));
                            setActiveIdx(a => Math.max(0, Math.min(a, pages.length - 2)));
                          }}
                          className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow"
                          aria-label="remove page"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3.5 border-t border-line bg-surface-2/40 shrink-0">
          {step !== 'source' && pages.length > 0 && (
            <button
              onClick={() => setStep(step === 'adjust' ? 'crop' : 'source')}
              className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-surface-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-ink transition"
            >
              {rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {tp('Back', 'قبلی', 'شاته')}
            </button>
          )}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {step === 'crop' && (
              <button
                onClick={() => setStep('adjust')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition"
              >
                <Check className="w-4 h-4" /> {tp('Continue', 'ادامه', 'مخته')}
              </button>
            )}
            {step === 'adjust' && (
              <>
                <button
                  onClick={() => exportPages(true, false)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black transition"
                >
                  <ImageIcon className="w-4 h-4" /> {tp('Save Images', 'ذخیره عکس', 'عکسونه ساتل')}
                </button>
                <button
                  onClick={() => exportPages(false, true)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black transition"
                >
                  <FileText className="w-4 h-4" /> {tp('Save PDF', 'ذخیره PDF', 'PDF ساتل')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* hidden inputs: camera opens the REAL device camera, rear preferred */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => {
            ingestFiles(e.target.files, true);
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
            ingestFiles(e.target.files, false);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};

const MiniThumb: React.FC<{ raw: RawImage }> = ({ raw }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const s = Math.min(1, 120 / Math.max(raw.width, raw.height));
      const c = ref.current;
      c.width = Math.max(1, Math.round(raw.width * s));
      c.height = Math.max(1, Math.round(raw.height * s));
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const full = document.createElement('canvas');
      full.width = raw.width;
      full.height = raw.height;
      full.getContext('2d')?.putImageData(new ImageData(raw.data as Uint8ClampedArray<ArrayBuffer>, raw.width, raw.height), 0, 0);
      ctx.drawImage(full, 0, 0, c.width, c.height);
    } catch {
      /* ignore */
    }
  }, [raw]);
  return <canvas ref={ref} className="w-full h-full object-cover" />;
};
