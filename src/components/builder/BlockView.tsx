import React from 'react';
import type { BuilderBlock, BuilderBlockStyle } from '../../utils/pageBuilder';

const alignCls = (a?: BuilderBlockStyle['align']): string =>
  a === 'center' ? 'text-center' : a === 'end' ? 'text-left' : 'text-right';

const blockBox = (b: BuilderBlock): React.CSSProperties => ({
  ...(b.style?.color ? { color: b.style.color } : {}),
  ...(b.style?.background ? { background: b.style.background } : {}),
  ...(b.style?.fontSize !== undefined ? { fontSize: b.style.fontSize } : {}),
  ...(b.style?.marginTop !== undefined ? { marginTop: b.style.marginTop } : {}),
  ...(b.style?.marginBottom !== undefined ? { marginBottom: b.style.marginBottom } : {}),
  ...(b.style?.padding !== undefined ? { padding: b.style.padding } : {}),
  ...(b.style?.radius !== undefined ? { borderRadius: b.style.radius } : {}),
  ...(b.style?.widthPct !== undefined ? { width: `${b.style.widthPct}%` } : {}),
});

interface BlockViewProps {
  block: BuilderBlock;
  /** live stat values for `stat` blocks (dashboard passes real totals) */
  stats?: { expenses: number; paid: number; debt: number; sales: number };
  formatMoney?: (usd: number) => string;
  onNavigate?: (tab: string) => void;
  selected?: boolean;
  onSelect?: () => void;
}

/** Renders one builder content block (never dashboard_section — the dashboard owns those). */
export const BlockView: React.FC<BlockViewProps> = ({
  block: b, stats, formatMoney, onNavigate, selected, onSelect,
}) => {
  if (b.hidden) return null;
  const wrap = (children: React.ReactNode, key?: string) => (
    <div
      key={key}
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(); } : undefined}
      style={blockBox(b)}
      className={`${alignCls(b.style?.align)}${selected ? ' ring-2 ring-indigo-500 rounded-xl' : ''}${onSelect ? ' cursor-pointer' : ''}`}
    >
      {children}
    </div>
  );

  switch (b.type) {
    case 'heading': {
      const cls = b.level === 1
        ? 'text-2xl sm:text-3xl font-black text-ink'
        : b.level === 3 ? 'text-base font-bold text-ink' : 'text-xl font-black text-ink';
      return wrap(<div className={cls}>{b.text || ''}</div>);
    }
    case 'text':
      return wrap(<div className="text-sm text-ink-muted whitespace-pre-line leading-relaxed">{b.text || ''}</div>);
    case 'image':
      if (!b.url) return wrap(<div className="text-xs text-slate-400 border border-dashed border-line rounded-xl p-4">بدون تصویر</div>);
      return wrap((
        <figure className="m-0">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={b.url} alt={b.text || ''} className="max-w-full h-auto rounded-xl" loading="lazy" />
          {b.text ? <figcaption className="text-[11px] text-slate-400 mt-1">{b.text}</figcaption> : null}
        </figure>
      ));
    case 'button':
      return wrap((
        <button
          type="button"
          onClick={() => { if (b.targetTab && onNavigate) onNavigate(b.targetTab); }}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black shadow-md transition-colors"
        >
          {b.text || 'دکمه'}
        </button>
      ));
    case 'divider':
      return wrap(<hr className="border-line" />);
    case 'spacer':
      return wrap(<div style={{ height: 24 }} />);
    case 'stat': {
      const labels: Record<string, string> = { expenses: 'مصارف', paid: 'پرداخت‌ها', debt: 'بدهی', sales: 'فروش' };
      const val = stats && b.statKind ? stats[b.statKind] : 0;
      return wrap((
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm inline-block min-w-40">
          <div className="text-[11px] text-ink-muted font-bold">{labels[b.statKind || 'expenses']}</div>
          <div className="text-xl font-black text-ink mt-1">{formatMoney ? formatMoney(val) : val}</div>
        </div>
      ));
    }
    default:
      return null;
  }
};
