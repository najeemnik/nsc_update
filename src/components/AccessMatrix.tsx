import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { GrantAction, ProjectGrant } from '../types';
import { ALL_ACTIONS, COMPANY_SECTIONS, emptyGrant, fullGrant } from '../utils/permissions';
import { Check, Eye, Pencil, Ban, Star } from 'lucide-react';

/** Sidebar order (super_admin excluded — master only, never grantable). */
const SECTION_ORDER = [
  'dashboard', 'projects', 'steel', 'concrete', 'expenses', 'contractors',
  'labor', 'suppliers', 'assets', 'apartments', 'payments', 'budget',
  'documents', 'reports', 'accounting', 'users', 'settings', 'audit_logs',
];

const SECTION_LABEL: Record<string, [string, string, string]> = {
  dashboard: ['Dashboard', 'داشبورد', 'ډشبورډ'],
  projects: ['Projects', 'پروژه‌ها', 'پروژې'],
  steel: ['Steel', 'آهن‌آلات', 'اوسپنه'],
  concrete: ['Concrete', 'کانکریت', 'کانکرېټ'],
  expenses: ['Expenses', 'مصارف', 'لګښتونه'],
  contractors: ['Contractors', 'قراردادی‌ها', 'قراردادیان'],
  labor: ['Labor', 'کارگران', 'کارګران'],
  suppliers: ['Suppliers', 'تمویل‌کنندگان', 'تمویلوونکي'],
  assets: ['Assets', 'دارایی‌ها', 'شتمنۍ'],
  apartments: ['Apartments', 'آپارتمان‌ها', 'اپارتمانونه'],
  payments: ['Payments', 'پرداخت‌ها', 'تادیات'],
  budget: ['Budget', 'بودجه', 'بودیجه'],
  documents: ['Documents', 'اسناد', 'اسناد'],
  reports: ['Reports', 'گزارش‌ها', 'راپورونه'],
  accounting: ['Accounting', 'حسابداری', 'محاسبه'],
  users: ['Staff', 'کارمندان', 'کارکوونکي'],
  settings: ['Settings', 'تنظیمات', 'امستنې'],
  audit_logs: ['Audit log', 'لاگ حسابرسی', 'پلټنې لاګ'],
};

const ACTION_LABEL: Record<GrantAction, [string, string, string]> = {
  view: ['View', 'دیدن', 'لیدل'],
  create: ['Create', 'ایجاد', 'جوړول'],
  edit: ['Edit', 'ویرایش', 'سمول'],
  del: ['Delete', 'حذف', 'ړنګول'],
  approve: ['Approve', 'تأیید', 'تایید'],
  print: ['Print', 'چاپ', 'چاپ'],
  export: ['Export', 'خروجی', 'ایستل'],
};

interface AccessMatrixProps {
  grants: ProjectGrant[];
  onChange: (grants: ProjectGrant[]) => void;
}

export const AccessMatrix: React.FC<AccessMatrixProps> = ({ grants, onChange }) => {
  const { projects, tp } = useApp();
  const [activeEntry, setActiveEntry] = useState<string>('*');

  const wildcardOn = grants.some(g => g.projectId === '*');
  const entryIds = grants.map(g => g.projectId);
  const effectiveActive = entryIds.includes(activeEntry) ? activeEntry : entryIds[0];

  const toggleWildcard = () => {
    if (wildcardOn) {
      onChange(grants.filter(g => g.projectId !== '*'));
    } else {
      onChange([...grants, { projectId: '*', sections: {} }]);
      setActiveEntry('*');
    }
  };

  const toggleProject = (id: string) => {
    if (entryIds.includes(id)) {
      onChange(grants.filter(g => g.projectId !== id));
    } else {
      onChange([...grants, { projectId: id, sections: {} }]);
      setActiveEntry(id);
    }
  };

  const active = grants.find(g => g.projectId === effectiveActive);

  const setCell = (section: string, action: GrantAction, value: boolean) => {
    if (!active) return;
    const row = { ...emptyGrant(), ...active.sections[section] };
    row[action] = value;
    if (action === 'view' && !value) {
      // Unchecking view clears the whole row (actions imply view).
      for (const a of ALL_ACTIONS) row[a] = false;
    }
    if (action !== 'view' && value) row.view = true;
    onChange(grants.map(g => g.projectId === active.projectId
      ? { ...g, sections: { ...g.sections, [section]: row } }
      : g));
  };

  const setRow = (section: string, kind: 'view' | 'entry' | 'full' | 'none') => {
    if (!active) return;
    const row = kind === 'full'
      ? fullGrant()
      : kind === 'entry'
        ? { ...emptyGrant(), view: true, create: true, edit: true }
        : kind === 'view'
          ? { ...emptyGrant(), view: true }
          : emptyGrant();
    onChange(grants.map(g => g.projectId === active.projectId
      ? { ...g, sections: { ...g.sections, [section]: row } }
      : g));
  };

  const applyPresetToActive = (kind: 'full' | 'entry' | 'view' | 'none') => {
    if (!active) return;
    const sections: ProjectGrant['sections'] = {};
    for (const s of SECTION_ORDER) {
      if (kind === 'full') sections[s] = fullGrant();
      else if (kind === 'entry' && !COMPANY_SECTIONS.has(s)) sections[s] = { ...emptyGrant(), view: true, create: true, edit: true };
      else if (kind === 'view' && !COMPANY_SECTIONS.has(s)) sections[s] = { ...emptyGrant(), view: true };
      else sections[s] = emptyGrant();
    }
    onChange(grants.map(g => g.projectId === active.projectId ? { ...g, sections } : g));
  };

  const entryName = (id: string) =>
    id === '*' ? tp('All projects', 'همه پروژه‌ها', 'ټولې پروژې') : projects.find(p => p.id === id)?.name || id;

  return (
    <div className="space-y-3">
      {/* Scope: wildcard + per-project picks */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleWildcard}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
            wildcardOn
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300'
              : 'bg-surface-2 border-line text-ink-muted hover:text-ink'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${wildcardOn ? 'fill-amber-500 text-amber-500' : ''}`} />
          {tp('All projects (current + future)', 'همه پروژه‌ها (فعلی و آینده)', 'ټولې پروژې (اوسنۍ او راتلونکې)')}
        </button>
        {projects.map(p => {
          const on = entryIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleProject(p.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                on
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-surface-2 border-line text-ink-muted hover:text-ink'
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {grants.length === 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
          {tp('Pick at least one scope above, then tick the allowed actions per section below.',
            'اول از بالا حداقل یک محدوده انتخاب کنید، بعد دسترسی هر بخش را تیک بزنید.',
            'لومړی له پورته څخه لږ تر لږه یوه ساحه وټاکئ، بیا د هرې برخې لاسرسی په نښه کړئ.')}
        </p>
      )}

      {active && (
        <>
          {/* Entry tabs + presets */}
          <div className="flex flex-wrap items-center gap-2">
            {grants.map(g => (
              <button
                key={g.projectId}
                type="button"
                onClick={() => setActiveEntry(g.projectId)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                  g.projectId === effectiveActive
                    ? 'bg-ink text-canvas dark:bg-white dark:text-slate-900'
                    : 'bg-surface-2 text-ink-muted hover:text-ink'
                }`}
              >
                {g.projectId === '*' ? '★ ' : ''}{entryName(g.projectId)}
              </button>
            ))}
            <span className="flex-1" />
            <span className="text-[10px] font-bold text-ink-muted">
              {tp('Preset for this entry:', 'قالب آماده برای همین سطر:', 'د همدې ننوتنې لپاره چمتو قالب:')}
            </span>
            {(['full', 'entry', 'view', 'none'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => applyPresetToActive(k)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-surface-2 text-ink-muted hover:text-ink border border-line transition"
              >
                {k === 'full' ? tp('Full', 'کامل', 'بشپړ')
                  : k === 'entry' ? tp('Data entry', 'ثبت معلومات', 'معلومات ثبتول')
                  : k === 'view' ? tp('View only', 'فقط دیدن', 'یوازې لیدل')
                  : tp('None', 'هیچ', 'هېڅ')}
              </button>
            ))}
          </div>

          {/* Matrix */}
          <div className="overflow-x-auto scroll-touch rounded-2xl border border-line">
            <table className="w-full text-[11px] border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-surface-2/70 text-ink-muted">
                  <th className="text-start py-2.5 px-3 font-bold sticky start-0 bg-surface-2">
                    {tp('Section', 'بخش', 'برخه')}
                  </th>
                  {ALL_ACTIONS.map(a => (
                    <th key={a} className="py-2.5 px-1.5 font-bold text-center whitespace-nowrap">
                      {tp(...ACTION_LABEL[a])}
                    </th>
                  ))}
                  <th className="py-2.5 px-1.5 font-bold text-center">
                    {tp('Row', 'سطر', 'قطار')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {SECTION_ORDER.map(s => {
                  const row = { ...emptyGrant(), ...active.sections[s] };
                  return (
                    <tr key={s} className="hover:bg-surface-2/40">
                      <td className="py-2 px-3 font-bold text-ink whitespace-nowrap sticky start-0 bg-surface">
                        {tp(...SECTION_LABEL[s])}
                        {COMPANY_SECTIONS.has(s) && (
                          <span className="ms-1.5 text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300 font-bold">
                            {tp('company', 'شرکتی', 'شرکت')}
                          </span>
                        )}
                      </td>
                      {ALL_ACTIONS.map(a => (
                        <td key={a} className="py-2 px-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={row[a] === true}
                            onChange={e => setCell(s, a, e.target.checked)}
                            className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                            aria-label={`${s} ${a}`}
                          />
                        </td>
                      ))}
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-0.5">
                          <button type="button" title={tp('View only', 'فقط دیدن', 'یوازې لیدل')} onClick={() => setRow(s, 'view')} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title={tp('Data entry', 'ثبت معلومات', 'معلومات ثبتول')} onClick={() => setRow(s, 'entry')} className="p-1 text-slate-400 hover:text-emerald-600 rounded">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title={tp('Full', 'کامل', 'بشپړ')} onClick={() => setRow(s, 'full')} className="p-1 text-slate-400 hover:text-amber-600 rounded">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title={tp('None', 'هیچ', 'هېڅ')} onClick={() => setRow(s, 'none')} className="p-1 text-slate-400 hover:text-rose-600 rounded">
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
