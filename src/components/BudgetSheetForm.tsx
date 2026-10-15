import React, { useMemo, useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, getBudgetTradeGroups } from '../data/chartOfAccounts';

/**
 * Budget sheet form (Wave 15+16): every plannable cost from the Chart of
 * Accounts listed with an amount box in front of it — nothing to pick,
 * just fill numbers. Small (minor) expenses sit collapsed per trade.
 * Wave 16: each trade can grow user-defined custom rows (editable name +
 * amount), stored as independent budget lines under the trade main.
 */
export interface BudgetSheetLine {
  /** COA code for standard rows, `custom-<unique>` for user rows */
  key: string;
  /** Trade main code for customs, exact COA code for standard rows */
  accountCode: string;
  /** Set only on user-defined rows (editable in the form) */
  customName?: string;
  amount: number;
}

interface BudgetSheetFormProps {
  currency: 'USD' | 'AFN';
  lines: BudgetSheetLine[];
  onChange: (lines: BudgetSheetLine[]) => void;
}

export const BudgetSheetForm: React.FC<BudgetSheetFormProps> = ({ currency, lines, onChange }) => {
  const { tp, language } = useApp();
  const [openMinors, setOpenMinors] = useState<Set<string>>(new Set());

  const groups = useMemo(() => getBudgetTradeGroups(), []);

  const nameOf = (a: Account): string =>
    language === 'ps' ? a.namePs : language === 'en' ? a.nameEn : a.nameFa;

  const amountOf = (key: string): number => {
    const l = lines.find(x => x.key === key);
    return l && l.amount > 0 ? l.amount : 0;
  };

  const setLine = (key: string, accountCode: string, amount: number, customName?: string) => {
    const rest = lines.filter(x => x.key !== key);
    if (amount > 0 || (customName !== undefined && customName.trim() !== '')) {
      onChange([...rest, { key, accountCode, amount, ...(customName !== undefined ? { customName } : {}) }]);
    } else {
      onChange(rest);
    }
  };

  const addCustom = (mainCode: string) => {
    const key = `custom-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    onChange([...lines, { key, accountCode: mainCode, customName: '', amount: 0 }]);
  };

  const removeCustom = (key: string) => {
    onChange(lines.filter(x => x.key !== key));
  };

  const toggleMinors = (mainCode: string) => {
    setOpenMinors(prev => {
      const next = new Set(prev);
      if (next.has(mainCode)) next.delete(mainCode);
      else next.add(mainCode);
      return next;
    });
  };

  const customsOf = (mainCode: string): BudgetSheetLine[] =>
    lines.filter(x => x.customName !== undefined && x.accountCode === mainCode);

  const groupSubtotal = (mainCode: string, codes: string[]): number => {
    const inGroup = new Set(codes);
    return lines.reduce((s, x) => {
      const belongs = x.customName !== undefined ? x.accountCode === mainCode : inGroup.has(x.key);
      return s + (belongs && x.amount > 0 ? x.amount : 0);
    }, 0);
  };

  const fmt = (n: number): string =>
    n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  const grandTotal = useMemo(
    () => lines.reduce((s, x) => s + (x.amount > 0 ? x.amount : 0), 0),
    [lines],
  );

  const amountBox = (val: number, setVal: (v: number) => void) => (
    <div className="relative w-32 sm:w-36 shrink-0">
      <input
        type="number"
        min="0"
        step="any"
        placeholder="0"
        value={val > 0 ? val : ''}
        onChange={e => {
          const v = parseFloat(e.target.value);
          setVal(Number.isFinite(v) && v > 0 ? v : 0);
        }}
        className="w-full ps-2 pe-10 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 font-mono font-bold text-[11px] text-ink focus:ring-2 focus:ring-amber-500/30 focus:outline-none"
      />
      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">
        {currency}
      </span>
    </div>
  );

  const standardRow = (acc: Account) => (
    <div key={acc.code} className="flex items-center gap-2 py-1">
      <span className="flex-1 min-w-0 text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate" title={`${acc.code} — ${nameOf(acc)}`}>
        {nameOf(acc)}
      </span>
      {amountBox(amountOf(acc.code), v => setLine(acc.code, acc.code, v))}
    </div>
  );

  const customRow = (line: BudgetSheetLine) => (
    <div key={line.key} className="flex items-center gap-2 py-1">
      <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
        {tp('NEW', 'جدید', 'نوی')}
      </span>
      <input
        type="text"
        placeholder={tp('Expense name…', 'نام مصرف…', 'د لګښت نوم…')}
        value={line.customName || ''}
        onChange={e => setLine(line.key, line.accountCode, line.amount, e.target.value)}
        className="flex-1 min-w-0 px-2 py-1.5 border border-indigo-200 dark:border-indigo-800 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 text-[11px] font-bold text-ink focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
      />
      {amountBox(line.amount, v => setLine(line.key, line.accountCode, v, line.customName || ''))}
      <button
        type="button"
        onClick={() => removeCustom(line.key)}
        title={tp('Remove', 'حذف', 'لرې کول')}
        className="shrink-0 p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {groups.map(g => {
        const allCodes = [...g.majors, ...g.minors].map(a => a.code);
        const customs = customsOf(g.main.code);
        const sub = groupSubtotal(g.main.code, allCodes);
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
              {g.majors.map(standardRow)}
              {customs.map(customRow)}
            </div>
            <div className="px-3 pb-2">
              <button
                type="button"
                onClick={() => addCustom(g.main.code)}
                className="w-full py-1.5 border border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 text-indigo-600 dark:text-indigo-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tp('Add new expense', 'افزودن مصرف جدید', 'نوی لګښت ورزياتول')}</span>
              </button>
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
                    {g.minors.map(standardRow)}
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
