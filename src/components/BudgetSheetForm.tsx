import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, getBudgetTradeGroups } from '../data/chartOfAccounts';

/**
 * Budget sheet form (Wave 15): every plannable cost from the Chart of
 * Accounts listed with an amount box in front of it — nothing to pick,
 * just fill numbers. Small (minor) expenses sit collapsed per trade.
 */
interface BudgetSheetFormProps {
  currency: 'USD' | 'AFN';
  value: Record<string, number>;
  onChange: (accountCode: string, amount: number) => void;
}

export const BudgetSheetForm: React.FC<BudgetSheetFormProps> = ({ currency, value, onChange }) => {
  const { tp, language } = useApp();
  const [openMinors, setOpenMinors] = useState<Set<string>>(new Set());

  const groups = useMemo(() => getBudgetTradeGroups(), []);

  const nameOf = (a: Account): string =>
    language === 'ps' ? a.namePs : language === 'en' ? a.nameEn : a.nameFa;

  const toggleMinors = (mainCode: string) => {
    setOpenMinors(prev => {
      const next = new Set(prev);
      if (next.has(mainCode)) next.delete(mainCode);
      else next.add(mainCode);
      return next;
    });
  };

  const groupSubtotal = (codes: string[]): number =>
    codes.reduce((s, c) => s + (value[c] > 0 ? value[c] : 0), 0);

  const fmt = (n: number): string =>
    n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  const grandTotal = useMemo(
    () => Object.values(value).reduce((s, v) => s + (v > 0 ? v : 0), 0),
    [value],
  );

  const row = (acc: Account) => (
    <div key={acc.code} className="flex items-center gap-2 py-1">
      <span className="flex-1 min-w-0 text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate" title={`${acc.code} — ${nameOf(acc)}`}>
        {nameOf(acc)}
      </span>
      <div className="relative w-32 sm:w-36 shrink-0">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="0"
          value={value[acc.code] > 0 ? value[acc.code] : ''}
          onChange={e => {
            const v = parseFloat(e.target.value);
            onChange(acc.code, Number.isFinite(v) && v > 0 ? v : 0);
          }}
          className="w-full ps-2 pe-10 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 font-mono font-bold text-[11px] text-ink focus:ring-2 focus:ring-amber-500/30 focus:outline-none"
        />
        <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">
          {currency}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {groups.map(g => {
        const allCodes = [...g.majors, ...g.minors].map(a => a.code);
        const sub = groupSubtotal(allCodes);
        const minorsOpen = openMinors.has(g.main.code);
        return (
          <div key={g.main.code} className="border border-line rounded-2xl overflow-hidden bg-white dark:bg-slate-800/60">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-line">
              <span className="flex-1 min-w-0 text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                {nameOf(g.main)}
              </span>
              {sub > 0 && (
                <span className="text-[11px] font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {fmt(sub)} {currency}
                </span>
              )}
            </div>
            <div className="px-3 py-1.5 divide-y divide-slate-100 dark:divide-slate-800">
              {g.majors.map(row)}
            </div>
            {g.minors.length > 0 && (
              <div className="border-t border-dashed border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => toggleMinors(g.main.code)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-slate-500 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  <span>
                    {tp('Small expenses (optional)', 'مصارف کوچک (اختیاری)', 'واړه لګښتونه (اختیاري)')} ({g.minors.length})
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${minorsOpen ? 'rotate-180' : ''}`} />
                </button>
                {minorsOpen && (
                  <div className="px-3 pb-2 divide-y divide-slate-100 dark:divide-slate-800">
                    {g.minors.map(row)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="sticky bottom-0 flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900 text-white shadow-lg">
        <span className="text-xs font-black">
          {tp('Total budget', 'مجموع بودجه', 'ټوله بودجه')}
        </span>
        <span className="text-sm font-mono font-black text-amber-400">
          {fmt(grandTotal)} {currency}
        </span>
      </div>
    </div>
  );
};
