/**
 * Shared trilingual expense categories — Wave 33.
 * Single source of truth for the expense modal AND display labels,
 * so stored values always render readably in the active language.
 */
import type { Language } from '../types';

export interface ExpenseCategoryDef {
  id: string;
  labelFa: string;
  labelPs: string;
  labelEn: string;
}

export const COMMON_CATEGORIES: ExpenseCategoryDef[] = [
  { id: 'scaffolding', labelFa: 'اسکافولد و داربست (کرایه و بستن)', labelPs: 'پایپ او داربست', labelEn: 'Scaffolding (Rental & Fix)' },
  { id: 'formwork', labelFa: 'قالب‌بندی و نجاری (تخته و چوب)', labelPs: 'قالب بندي او تختې', labelEn: 'Formwork & Carpentry' },
  { id: 'wood_supplier', labelFa: 'فروشنده چوب، پلی‌وود و تخت', labelPs: 'د لرګیو پلورونکی', labelEn: 'Plywood & Wood Supplier' },
  { id: 'tie_wire', labelFa: 'سیم نجاری و سیخ‌بندی (سیم سیاه)', labelPs: 'د سیخ تړلو سیم', labelEn: 'Tie Wire & Steel Fixer' },
  { id: 'electrical', labelFa: 'برق‌کاری و تأسیسات برقی', labelPs: 'د برېښنا کارونه', labelEn: 'Electrical Works' },
  { id: 'steel', labelFa: 'سیخ‌گول (فولاد)', labelPs: 'سیخ ګول', labelEn: 'Steel / Rebar' },
  { id: 'concrete', labelFa: 'کانکریت و پمپ', labelPs: 'کانکریت او پمپ', labelEn: 'Concrete & Pump' },
  { id: 'materials', labelFa: 'مصالح ساختمانی (سمنت، خشت، ریگ)', labelPs: 'ودانیز توکي (سمنټ، شګه)', labelEn: 'Building Materials' },
  { id: 'transport', labelFa: 'کرایه موتر و ترانسپورت', labelPs: 'ترانسپورت او کرایه', labelEn: 'Transportation & Fares' },
  { id: 'municipality', labelFa: 'تعرفه ناحیه و شاروالی', labelPs: 'د ناحیې فیس', labelEn: 'District / Municipality Fee' },
  { id: 'worker_food', labelFa: 'نان و غذای کارگران', labelPs: 'د مزدورانو ډوډۍ', labelEn: 'Worker Meals & Food' },
  { id: 'daily_labour', labelFa: 'مزد کارگران روزمزد', labelPs: 'د ورځې مزدور مزدوري', labelEn: 'Daily Labour Wages' },
  { id: 'miscellaneous', labelFa: 'مصارف متفرقه و پیش‌بینی‌نشده', labelPs: 'متفرقه لګښتونه', labelEn: 'Miscellaneous Expenses' },
];

export const categoryLabel = (def: ExpenseCategoryDef, lang: Language): string =>
  lang === 'ps' ? def.labelPs : lang === 'fa' ? def.labelFa : def.labelEn;

/** Match a stored value (id or a label in any language, incl. legacy) to its definition. */
export const findCategoryDef = (stored: string): ExpenseCategoryDef | undefined => {
  const v = (stored || '').trim().toLowerCase();
  if (!v) return undefined;
  return COMMON_CATEGORIES.find(c =>
    c.id.toLowerCase() === v ||
    c.labelFa.toLowerCase() === v ||
    c.labelPs.toLowerCase() === v ||
    c.labelEn.toLowerCase() === v,
  );
};
