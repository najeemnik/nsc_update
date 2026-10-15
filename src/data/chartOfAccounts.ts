/**
 * ============================================================================
 * NIK SMART COUNT — Chart of Accounts (COA)
 * ============================================================================
 *
 * A standard, three-layer chart of accounts tailored for a construction /
 * real-estate development business (multi-storey apartment projects).
 *
 * Layers:
 *   Group (e.g. 5000)  ->  Main account (e.g. 5100)  ->  Sub account (Phase 2+,
 *   user-creatable, e.g. 5110 "Rebar — Supplier A") via `parentCode`.
 *
 * Design principles:
 *  - Users never see codes. The UI keeps working with «مصارف / پرداخت‌ها /
 *    فروشات / سرمایه‌گذاری» — the journal engine maps them to accounts
 *    behind the scenes (see `src/utils/journalEngine.ts`).
 *  - 5xxx accounts = DIRECT PROJECT costs only (they conceptually feed the
 *    Work-in-Progress asset 1500; the WIP/COGS reclass lands in Phase 3).
 *  - 6xxx accounts = company-level operating/admin expenses (NOT project
 *    costs) so project P&L stays clean.
 *  - Multi-currency: postings keep the original currency plus USD/AFN
 *    normalization at journal-line level (the app's canonical currencies).
 * ============================================================================
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface Account {
  /** 4-digit main code (e.g. '5100') or 6-digit leaf code (e.g. '595008') */
  code: string;
  type: AccountType;
  /** The side on which the account normally increases */
  normalBalance: NormalBalance;
  /** Parent account code for the 3-layer hierarchy (undefined for groups) */
  parentCode?: string;
  nameEn: string;
  /** Dari */
  nameFa: string;
  /** Pashto */
  namePs: string;
  /**
   * Header accounts are grouping nodes only — journal lines must never post
   * directly to them (they roll up from their children).
   */
  isHeader?: boolean;
  /**
   * System accounts are part of the standard chart and cannot be deleted by
   * users (Phase 2+ when a UI for custom sub-accounts exists).
   */
  system?: boolean;
  /** Which implementation phase the account becomes actively posted to */
  activePhase?: 1 | 2 | 3;
  description?: string;
  /**
   * Wave 14: small/optional leaf inside its trade — shown collapsed under
   * "small expenses" in the budget sheet instead of the main list.
   */
  isBudgetMinor?: boolean;
}

/* ------------------------------------------------------------------ */
/* The Chart                                                           */
/* ------------------------------------------------------------------ */

export const CHART_OF_ACCOUNTS: Account[] = [
  /* ============================ 1000 ASSETS ============================ */
  { code: '1000', type: 'asset', normalBalance: 'debit', nameEn: 'Assets', nameFa: 'دارایی‌ها', namePs: 'شتوالۍ', isHeader: true, system: true },
  { code: '1100', type: 'asset', normalBalance: 'debit', parentCode: '1000', nameEn: 'Cash & Bank', nameFa: 'نقد و بانک', namePs: 'نقد او بانک', isHeader: true, system: true },
  { code: '1110', type: 'asset', normalBalance: 'debit', parentCode: '1100', nameEn: 'Cash (AFN)', nameFa: 'صندوق افغانی', namePs: 'د افغانیو صندوق', system: true, activePhase: 1 },
  { code: '1120', type: 'asset', normalBalance: 'debit', parentCode: '1100', nameEn: 'Cash (USD)', nameFa: 'صندوق دالر', namePs: 'د ډالرو صندوق', system: true, activePhase: 1 },
  { code: '1130', type: 'asset', normalBalance: 'debit', parentCode: '1100', nameEn: 'Bank Account', nameFa: 'حساب بانکی', namePs: 'بانکي حساب', system: true, activePhase: 1 },
  { code: '1140', type: 'asset', normalBalance: 'debit', parentCode: '1100', nameEn: 'Hawala / Sarafi Balance', nameFa: 'کمیون صرافی (حواله)', namePs: 'د صرافۍ حساب (حواله)', system: true, activePhase: 1 },
  { code: '1200', type: 'asset', normalBalance: 'debit', parentCode: '1000', nameEn: 'Apartment Receivables', nameFa: 'دریافتنی از خریداران آپارتمان', namePs: 'د اپارتمانونو له پیرودونکو ترلاسه کیدونکي', system: true, activePhase: 1,
    description: 'Amounts still owed by unit buyers (sale price minus receipts).' },
  { code: '1300', type: 'asset', normalBalance: 'debit', parentCode: '1000', nameEn: 'Advances to Suppliers', nameFa: 'پیش‌پرداخت به فروشنده‌گان', namePs: 'پلورونکو ته مخکینۍ تادیه', system: true, activePhase: 3 },
  { code: '1400', type: 'asset', normalBalance: 'debit', parentCode: '1000', nameEn: 'Material Inventory', nameFa: 'موجودی مواد', namePs: 'د موادو زیرمه', system: true, activePhase: 3 },
  { code: '1500', type: 'asset', normalBalance: 'debit', parentCode: '1000', nameEn: 'Construction Work in Progress (WIP)', nameFa: 'پروژه در جریان ساخت (WIP)', namePs: 'روانه پروژه (WIP)', system: true, activePhase: 3,
    description: 'Capitalized direct project costs per project; relieved to COGS on unit sale (Phase 3).' },
  { code: '1600', type: 'asset', normalBalance: 'debit', parentCode: '1000', nameEn: 'Deposits', nameFa: 'ودیعه‌ها و امانت‌های داده‌شده', namePs: 'امانتونه', system: true, activePhase: 2 },
  { code: '1800', type: 'asset', normalBalance: 'debit', parentCode: '1000', nameEn: 'Fixed Assets', nameFa: 'دارایی‌های ثابت (مکینت، داربست، وسایط)', namePs: 'ثابتې شتوالۍ', system: true, activePhase: 2 },

  /* ========================= 2000 LIABILITIES ========================= */
  { code: '2000', type: 'liability', normalBalance: 'credit', nameEn: 'Liabilities', nameFa: 'بدهی‌ها', namePs: 'پورونه', isHeader: true, system: true },
  { code: '2100', type: 'liability', normalBalance: 'credit', parentCode: '2000', nameEn: 'Accounts Payable', nameFa: 'حساب‌های پرداختنی', namePs: 'تادیه وړ حسابونه', isHeader: true, system: true },
  { code: '2200', type: 'liability', normalBalance: 'credit', parentCode: '2100', nameEn: 'Supplier Payables', nameFa: 'بدهی به فروشنده‌گان', namePs: 'پلورونکو ته پور', system: true, activePhase: 1 },
  { code: '2250', type: 'liability', normalBalance: 'credit', parentCode: '2100', nameEn: 'Contractor Payables', nameFa: 'بدهی به قراردادکاران', namePs: 'قراردادکارانو ته پور', system: true, activePhase: 1 },
  { code: '2300', type: 'liability', normalBalance: 'credit', parentCode: '2000', nameEn: 'Customer Advances', nameFa: 'پیش‌دریافت از خریداران (قبل از قرارداد فروش)', namePs: 'له پیرودونکو څخه مخکینۍ ترلاسه کول', system: true, activePhase: 1,
    description: 'Receipts from buyers of RESERVED (not yet formally sold) units.' },
  { code: '2400', type: 'liability', normalBalance: 'credit', parentCode: '2000', nameEn: 'Retention Payable', nameFa: 'امانت نگهداشته‌شده نزد قراردادکار', namePs: 'قراردادکار ته ساتل شوی امانت', system: true, activePhase: 2,
    description: 'Percentage withheld from contractor progress payments (retentionPercentage).' },
  { code: '2500', type: 'liability', normalBalance: 'credit', parentCode: '2000', nameEn: 'Loans Payable', nameFa: 'قرض‌ها و وام‌ها', namePs: 'پورونه او قرضې', system: true, activePhase: 2 },
  { code: '2600', type: 'liability', normalBalance: 'credit', parentCode: '2000', nameEn: 'Taxes Payable', nameFa: 'مالیات قابل پرداخت', namePs: 'تادیه وړ مالیه', system: true, activePhase: 2 },
  { code: '2900', type: 'liability', normalBalance: 'credit', parentCode: '2000', nameEn: 'Other Liabilities', nameFa: 'سایر بدهی‌ها (شامل پرداخت از جیب شخصی)', namePs: 'نور پورونه', system: true, activePhase: 1 },

  /* ============================ 3000 EQUITY =========================== */
  { code: '3000', type: 'equity', normalBalance: 'credit', nameEn: 'Equity', nameFa: 'سرمایه', namePs: 'پانګه', isHeader: true, system: true },
  { code: '3100', type: 'equity', normalBalance: 'credit', parentCode: '3000', nameEn: "Partners' Capital (Initial)", nameFa: 'سرمایه اولی شرکا', namePs: 'د شریکانو لومړنۍ پانګه', system: true, activePhase: 1 },
  { code: '3200', type: 'equity', normalBalance: 'credit', parentCode: '3000', nameEn: 'Additional Investments', nameFa: 'سرمایه‌گذاری‌های اضافی شرکا', namePs: 'د شریکانو اضافي پانګه اچونه', system: true, activePhase: 1 },
  { code: '3300', type: 'equity', normalBalance: 'debit', parentCode: '3000', nameEn: 'Partner Drawings', nameFa: 'برداشت شرکا', namePs: 'د شریکانو را ایستل', system: true, activePhase: 2,
    description: 'Contra-equity: money partners take OUT of the business.' },
  { code: '3400', type: 'equity', normalBalance: 'credit', parentCode: '3000', nameEn: 'Retained Earnings', nameFa: 'سود و زیان انباشته', namePs: 'ذخیره شوې ګټه او زیان', system: true, activePhase: 2 },

  /* ============================ 4000 REVENUE ========================== */
  { code: '4000', type: 'revenue', normalBalance: 'credit', nameEn: 'Revenue', nameFa: 'درآمد', namePs: 'عاید', isHeader: true, system: true },
  { code: '4100', type: 'revenue', normalBalance: 'credit', parentCode: '4000', nameEn: 'Apartment & Unit Sales', nameFa: 'فروش آپارتمان و واحدها', namePs: 'د اپارتمانونو او واحدونو پلور', system: true, activePhase: 1 },
  { code: '4200', type: 'revenue', normalBalance: 'credit', parentCode: '4000', nameEn: 'Rental Income', nameFa: 'درآمد کرایه (دوکان‌ها و غیره)', namePs: 'د کرایې عاید', system: true, activePhase: 2 },
  { code: '4300', type: 'revenue', normalBalance: 'credit', parentCode: '4000', nameEn: 'Other Project Revenue', nameFa: 'سایر درآمدها (فروش مواد مازاد، ضایعات)', namePs: 'د پروژې نور عایدونه', system: true, activePhase: 1 },

  /* ================ 5000 PROJECT / CONSTRUCTION COSTS ================= */
  { code: '5000', type: 'expense', normalBalance: 'debit', nameEn: 'Construction / Project Costs', nameFa: 'هزینه‌های ساخت پروژه', namePs: 'د پروژې د جوړښت لګښتونه', isHeader: true, system: true,
    description: 'DIRECT project costs only. Conceptually these feed WIP (1500); WIP/COGS reclass arrives in Phase 3.' },
  { code: '5050', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Cost of Units Sold (COGS)', nameFa: 'هزینه واحدهای فروخته‌شده', namePs: 'د پلورل شویو واحدونو لګښت', system: true, activePhase: 3 },
  { code: '5100', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Steel & Rebar', nameFa: 'آهن و میل‌گرد', namePs: 'اوسپنه او سیخ ګول', system: true, activePhase: 1 },
  { code: '5200', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Concrete & Pumping', nameFa: 'کانکریت و پمپ', namePs: 'کانکریت او پمپ', system: true, activePhase: 1 },
  { code: '5300', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Cement', nameFa: 'سیمنت', namePs: 'سمنټ', system: true, activePhase: 1 },
  { code: '5400', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Sand & Gravel', nameFa: 'ریگ و شن', namePs: 'شګه او ریګ', system: true, activePhase: 1 },
  { code: '5500', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Masonry (Blocks & Bricks)', nameFa: 'بلاک، آجر و بنایات', namePs: 'بلاک، خشتې او بنایات', system: true, activePhase: 1 },
  { code: '5600', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Labour & Wages', nameFa: 'مزد و نیروی انسانی', namePs: 'مزد او کارګران', system: true, activePhase: 1 },
  { code: '5700', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Machinery & Equipment Rental', nameFa: 'کرایه ماشین‌آلات و تجهیزات', namePs: 'د ماشینونو او تجهیزاتو کرایه', system: true, activePhase: 1 },
  { code: '5800', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Transportation & Logistics', nameFa: 'ترانسپورت و حمل‌ونقل', namePs: 'ترانسپورت او لېږد', system: true, activePhase: 1 },
  { code: '5900', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Site Utilities & Fuel', nameFa: 'آب‌وبرق و تیل ساحه', namePs: 'د ساحې اوبه، برق او تیل', system: true, activePhase: 1 },
  { code: '5910', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Formwork & Scaffolding', nameFa: 'قالب‌بندی و داربست', namePs: 'قالب بندي او داربست', system: true, activePhase: 1 },
  { code: '5920', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Electrical Works', nameFa: 'برق‌کاری و تأسیسات برقی', namePs: 'د برېښنا کارونه', system: true, activePhase: 1 },
  { code: '5930', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Plumbing & Sanitary', nameFa: 'لوله‌کاری و تأسیسات صحی', namePs: 'د لولو او صحي کارونه', system: true, activePhase: 1 },
  { code: '5940', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Carpentry, Doors & Windows', nameFa: 'نجاری، دروازه و ورک', namePs: 'نجاري، دروازې او ورکونه', system: true, activePhase: 1 },
  { code: '5950', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Tiles, Paint & Finishing', nameFa: 'کاشی، نقاشی و تکمیل‌کاری', namePs: 'کاشي، رنګ او بشپړونکي کار', system: true, activePhase: 1 },
  { code: '5960', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Elevator, Excavation & Shoring', nameFa: 'لیفتر، حفاری و تکیه‌گاه', namePs: 'لفټ، کیندنه او تکیه ګاه', system: true, activePhase: 1 },
  { code: '5970', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Permits, Fees & Engineering', nameFa: 'جواز، فیس و انجنیری', namePs: 'جواز، فیس او انجنیري', system: true, activePhase: 1 },
  { code: '5980', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Project & Site Overhead', nameFa: 'مصارف اداری و نگهبانی ساحه', namePs: 'د ساحې اداري لګښتونه', system: true, activePhase: 1 },
  { code: '5990', type: 'expense', normalBalance: 'debit', parentCode: '5000', nameEn: 'Other Project Expenses', nameFa: 'سایر مصارف پروژه', namePs: 'د پروژې نور لګښتونه', system: true, activePhase: 1,
    description: 'Default/fallback bucket for unmapped or custom expense categories.' },

  /* ============ 5xxx LEAF ACCOUNTS — Wave 14 (budget planning detail) ============ */
  /* 6-digit leaves (main + 2 digits). Planning-only: actuals post to the 4-digit */
  /* main; budget reports roll leaves up via toBudgetMain(). isBudgetMinor leaves */
  /* are the optional "small expenses" in the budget sheet. */
  /* ----- 5100 detail ----- */
  { code: '510001', type: 'expense', normalBalance: 'debit', parentCode: '5100', nameEn: 'Rebar steel', nameFa: 'سیخ‌گرد ساختمانی', namePs: 'ساختماني سیخ', system: true, activePhase: 1 },
  { code: '510002', type: 'expense', normalBalance: 'debit', parentCode: '5100', nameEn: 'Binding wire', nameFa: 'سیم آرماتوربندی', namePs: 'د سیخ تړلو سیم', system: true, activePhase: 1 },
  { code: '510003', type: 'expense', normalBalance: 'debit', parentCode: '5100', nameEn: 'Cover blocks & spacers', nameFa: 'کاور بلاک و فاصله‌گذار', namePs: 'کاور بلاک او واټن ساتونکي', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '510004', type: 'expense', normalBalance: 'debit', parentCode: '5100', nameEn: 'Welding electrodes', nameFa: 'الکترود جوشکاری', namePs: 'د وېلډینګ الکترود', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '510005', type: 'expense', normalBalance: 'debit', parentCode: '5100', nameEn: 'Cutting & grinding discs', nameFa: 'صفحه برش و سنگ فرز', namePs: 'د پرې کولو او ګرینډ ډیسکونه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '510006', type: 'expense', normalBalance: 'debit', parentCode: '5100', nameEn: 'Bar-bending & fixing labor', nameFa: 'مزد سیخ‌بند و آرماتوربند', namePs: 'د سیخ تړونکو مزد', system: true, activePhase: 1 },
  { code: '510007', type: 'expense', normalBalance: 'debit', parentCode: '5100', nameEn: 'Steel cutting machine use', nameFa: 'مصرف ماشین برش سیخ', namePs: 'د سیخ پرې کولو ماشین', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '510008', type: 'expense', normalBalance: 'debit', parentCode: '5100', nameEn: 'Rebar lab testing', nameFa: 'تست لابراتواری سیخ', namePs: 'د سیخ لابراتواري معاینه', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5200 detail ----- */
  { code: '520001', type: 'expense', normalBalance: 'debit', parentCode: '5200', nameEn: 'Ready-mix concrete', nameFa: 'کانکریت آماده (ریدی‌مکس)', namePs: 'چمتو کانکریټ', system: true, activePhase: 1 },
  { code: '520002', type: 'expense', normalBalance: 'debit', parentCode: '5200', nameEn: 'Concrete pump rental', nameFa: 'کرایه پمپ کانکریت', namePs: 'د کانکریټو پمپ کرایه', system: true, activePhase: 1 },
  { code: '520003', type: 'expense', normalBalance: 'debit', parentCode: '5200', nameEn: 'Pump operator & pipeline team', nameFa: 'مزد تیم پمپ و لوله', namePs: 'د پمپ او پایپ ټیم مزد', system: true, activePhase: 1 },
  { code: '520004', type: 'expense', normalBalance: 'debit', parentCode: '5200', nameEn: 'Vibrators & compaction', nameFa: 'ویبراتور و تراکم', namePs: 'ویبراتور او ټینګښت', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '520005', type: 'expense', normalBalance: 'debit', parentCode: '5200', nameEn: 'Curing (water, jute, chemical)', nameFa: 'عمل‌آوری کانکریت (آب، جوټ)', namePs: 'د کانکریټو روزنه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '520006', type: 'expense', normalBalance: 'debit', parentCode: '5200', nameEn: 'Cube/cylinder lab testing', nameFa: 'تست مقاومت کانکریت', namePs: 'د کانکریټو مقاومت معاینه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '520007', type: 'expense', normalBalance: 'debit', parentCode: '5200', nameEn: 'Concrete pouring labor gang', nameFa: 'مزد تیم کانکریت‌ریزی', namePs: 'د کانکریټو اچولو ټیم مزد', system: true, activePhase: 1 },
  { code: '520008', type: 'expense', normalBalance: 'debit', parentCode: '5200', nameEn: 'Admixtures & additives', nameFa: 'مواد افزودنی کانکریت', namePs: 'د کانکریټو اضافي مواد', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5300 detail ----- */
  { code: '530001', type: 'expense', normalBalance: 'debit', parentCode: '5300', nameEn: 'Portland cement', nameFa: 'سیمنت پرتلند', namePs: 'پرټلنډ سمنټ', system: true, activePhase: 1 },
  { code: '530002', type: 'expense', normalBalance: 'debit', parentCode: '5300', nameEn: 'White cement', nameFa: 'سیمنت سفید', namePs: 'سپین سمنټ', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '530003', type: 'expense', normalBalance: 'debit', parentCode: '5300', nameEn: 'Waterproof cement compounds', nameFa: 'ترکیبات سیمنت ضدآب', namePs: 'د اوبو ضد سمنټي مواد', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5400 detail ----- */
  { code: '540001', type: 'expense', normalBalance: 'debit', parentCode: '5400', nameEn: 'River sand', nameFa: 'ریگ دریایی', namePs: 'د سیند شګه', system: true, activePhase: 1 },
  { code: '540002', type: 'expense', normalBalance: 'debit', parentCode: '5400', nameEn: 'Washed gravel', nameFa: 'شن شسته', namePs: 'وینځل شوی ریګ', system: true, activePhase: 1 },
  { code: '540003', type: 'expense', normalBalance: 'debit', parentCode: '5400', nameEn: 'Crushed stone aggregate', nameFa: 'سنگ شکسته (کرش)', namePs: 'مات شوی تیږه', system: true, activePhase: 1 },
  { code: '540004', type: 'expense', normalBalance: 'debit', parentCode: '5400', nameEn: 'Sieving & washing charges', nameFa: 'مصرف غربیل و شستشو', namePs: 'د چاڼ او وینځلو لګښت', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5500 detail ----- */
  { code: '550001', type: 'expense', normalBalance: 'debit', parentCode: '5500', nameEn: 'Concrete blocks', nameFa: 'بلاک سیمنتی', namePs: 'سمنټي بلاک', system: true, activePhase: 1 },
  { code: '550002', type: 'expense', normalBalance: 'debit', parentCode: '5500', nameEn: 'Bricks', nameFa: 'آجر', namePs: 'خښتې', system: true, activePhase: 1 },
  { code: '550003', type: 'expense', normalBalance: 'debit', parentCode: '5500', nameEn: 'Mortar materials', nameFa: 'مصالح ملات', namePs: 'د مسالې مواد', system: true, activePhase: 1 },
  { code: '550004', type: 'expense', normalBalance: 'debit', parentCode: '5500', nameEn: 'Steel lintels', nameFa: 'لنتل فلزی', namePs: 'فلزي لنټل', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '550005', type: 'expense', normalBalance: 'debit', parentCode: '5500', nameEn: 'Wall ties & anchors', nameFa: 'بست و انکر دیوار', namePs: 'د دېوال بست او انکر', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '550006', type: 'expense', normalBalance: 'debit', parentCode: '5500', nameEn: 'Mason wages', nameFa: 'مزد بنّا', namePs: 'د بنایانو مزد', system: true, activePhase: 1 },
  { code: '550007', type: 'expense', normalBalance: 'debit', parentCode: '5500', nameEn: 'Mason helpers', nameFa: 'مزد شاگرد بنّا', namePs: 'د بنایانو شاګردانو مزد', system: true, activePhase: 1 },
  /* ----- 5600 detail ----- */
  { code: '560001', type: 'expense', normalBalance: 'debit', parentCode: '5600', nameEn: 'Daily unskilled laborers', nameFa: 'کارگران روزمزد', namePs: 'ورځني کارګران', system: true, activePhase: 1 },
  { code: '560002', type: 'expense', normalBalance: 'debit', parentCode: '5600', nameEn: 'Site foreman', nameFa: 'سرکارگر ساحه', namePs: 'د ساحې سرکارګر', system: true, activePhase: 1 },
  { code: '560003', type: 'expense', normalBalance: 'debit', parentCode: '5600', nameEn: 'Worker meals & food', nameFa: 'نان و غذای کارگران', namePs: 'د کارګرانو ډوډۍ او خواړه', system: true, activePhase: 1 },
  { code: '560004', type: 'expense', normalBalance: 'debit', parentCode: '5600', nameEn: 'Safety gear & PPE', nameFa: 'وسایل ایمنی', namePs: 'د خوندیتوب وسایل', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '560005', type: 'expense', normalBalance: 'debit', parentCode: '5600', nameEn: 'Drinking water & first aid', nameFa: 'آب آشامیدنی و کمک‌های اولیه', namePs: 'څښاک اوبه او لومړنۍ مرسته', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5700 detail ----- */
  { code: '570001', type: 'expense', normalBalance: 'debit', parentCode: '5700', nameEn: 'Excavator rental', nameFa: 'کرایه اکسکواتور', namePs: 'د اکسکواتور کرایه', system: true, activePhase: 1 },
  { code: '570002', type: 'expense', normalBalance: 'debit', parentCode: '5700', nameEn: 'Crane & hoist rental', nameFa: 'کرایه کرین و بالابر', namePs: 'د کرین او لفټ کرایه', system: true, activePhase: 1 },
  { code: '570003', type: 'expense', normalBalance: 'debit', parentCode: '5700', nameEn: 'Concrete mixer rental', nameFa: 'کرایه میکسر', namePs: 'د میکسر کرایه', system: true, activePhase: 1 },
  { code: '570004', type: 'expense', normalBalance: 'debit', parentCode: '5700', nameEn: 'Compactor & roller rental', nameFa: 'کرایه کمپکتور و غلتک', namePs: 'د کمپکټور کرایه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '570005', type: 'expense', normalBalance: 'debit', parentCode: '5700', nameEn: 'Water pump & dewatering', nameFa: 'پمپ آب و خشک‌کردن', namePs: 'د اوبو پمپ', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '570006', type: 'expense', normalBalance: 'debit', parentCode: '5700', nameEn: 'Machine operators wages', nameFa: 'مزد اوپراتور ماشین‌آلات', namePs: 'د ماشین چلوونکو مزد', system: true, activePhase: 1 },
  { code: '570007', type: 'expense', normalBalance: 'debit', parentCode: '5700', nameEn: 'Small tools & consumables', nameFa: 'ابزار کوچک و مصرفی', namePs: 'واړه وسایل', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '570008', type: 'expense', normalBalance: 'debit', parentCode: '5700', nameEn: 'Equipment repair & maintenance', nameFa: 'ترمیم و نگهداری تجهیزات', namePs: 'د تجهیزاتو ترمیم', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5800 detail ----- */
  { code: '580001', type: 'expense', normalBalance: 'debit', parentCode: '5800', nameEn: 'Material haulage (trucks)', nameFa: 'حمل مصالح با موتر', namePs: 'د موادو لېږد', system: true, activePhase: 1 },
  { code: '580002', type: 'expense', normalBalance: 'debit', parentCode: '5800', nameEn: 'Debris & soil removal', nameFa: 'انتقال آوار و خاک اضافه', namePs: 'د کثافاتو او خاورو لېږدول', system: true, activePhase: 1 },
  { code: '580003', type: 'expense', normalBalance: 'debit', parentCode: '5800', nameEn: 'Loading & unloading labor', nameFa: 'مزد بارگیری و تخلیه', namePs: 'د بارولو او تشولو مزد', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '580004', type: 'expense', normalBalance: 'debit', parentCode: '5800', nameEn: 'Driver wages', nameFa: 'مزد دریور', namePs: 'د ډرېور مزد', system: true, activePhase: 1 },
  /* ----- 5900 detail ----- */
  { code: '590001', type: 'expense', normalBalance: 'debit', parentCode: '5900', nameEn: 'Site electricity', nameFa: 'برق ساحه', namePs: 'د ساحې برق', system: true, activePhase: 1 },
  { code: '590002', type: 'expense', normalBalance: 'debit', parentCode: '5900', nameEn: 'Site water', nameFa: 'آب ساحه', namePs: 'د ساحې اوبه', system: true, activePhase: 1 },
  { code: '590003', type: 'expense', normalBalance: 'debit', parentCode: '5900', nameEn: 'Diesel & fuel', nameFa: 'دیزل و تیل', namePs: 'ډیزل او تیل', system: true, activePhase: 1 },
  { code: '590004', type: 'expense', normalBalance: 'debit', parentCode: '5900', nameEn: 'Generator service & maintenance', nameFa: 'سرویس جنراتور', namePs: 'د جنراتور سرویس', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5910 detail ----- */
  { code: '591001', type: 'expense', normalBalance: 'debit', parentCode: '5910', nameEn: 'Plywood & shuttering sheets', nameFa: 'پلای‌وود و تخته قالب', namePs: 'پلایوډ او قالب تخته', system: true, activePhase: 1 },
  { code: '591002', type: 'expense', normalBalance: 'debit', parentCode: '5910', nameEn: 'Timber, joists & battens', nameFa: 'چوب، جوست و زیرکوب', namePs: 'لرګي او جوېسټ', system: true, activePhase: 1 },
  { code: '591003', type: 'expense', normalBalance: 'debit', parentCode: '5910', nameEn: 'Steel props & jacks', nameFa: 'پایه فلزی و جک', namePs: 'فلزي پایې او جک', system: true, activePhase: 1 },
  { code: '591004', type: 'expense', normalBalance: 'debit', parentCode: '5910', nameEn: 'Nails, screws & bolts', nameFa: 'میخ، پیچ و بولت', namePs: 'مېخونه، پېچ او بولټ', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '591005', type: 'expense', normalBalance: 'debit', parentCode: '5910', nameEn: 'Form oil', nameFa: 'روغن قالب', namePs: 'د قالب غوړي', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '591006', type: 'expense', normalBalance: 'debit', parentCode: '5910', nameEn: 'Scaffolding rental & fixing', nameFa: 'کرایه و بستن داربست', namePs: 'د داربست کرایه او تړل', system: true, activePhase: 1 },
  { code: '591007', type: 'expense', normalBalance: 'debit', parentCode: '5910', nameEn: 'Formwork carpenter wages', nameFa: 'مزد نجار قالب‌بند', namePs: 'د قالب تړونکو مزد', system: true, activePhase: 1 },
  { code: '591008', type: 'expense', normalBalance: 'debit', parentCode: '5910', nameEn: 'Dismantling & cleaning labor', nameFa: 'مزد بازکردن و پاک‌کاری قالب', namePs: 'د قالب خلاصولو مزد', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5920 detail ----- */
  { code: '592001', type: 'expense', normalBalance: 'debit', parentCode: '5920', nameEn: 'Wires & cables', nameFa: 'سیم و کیبل', namePs: 'سیم او کېبل', system: true, activePhase: 1 },
  { code: '592002', type: 'expense', normalBalance: 'debit', parentCode: '5920', nameEn: 'Conduits & pipes', nameFa: 'لوله برق و خرطومی', namePs: 'د برق پایپونه', system: true, activePhase: 1 },
  { code: '592003', type: 'expense', normalBalance: 'debit', parentCode: '5920', nameEn: 'Distribution boards & breakers', nameFa: 'تابلو برق و فیوز', namePs: 'د برق تابلو او فیوز', system: true, activePhase: 1 },
  { code: '592004', type: 'expense', normalBalance: 'debit', parentCode: '5920', nameEn: 'Switches & sockets', nameFa: 'کلید و ساکت', namePs: 'سویچ او ساکټ', system: true, activePhase: 1 },
  { code: '592005', type: 'expense', normalBalance: 'debit', parentCode: '5920', nameEn: 'Light fixtures & bulbs', nameFa: 'چراغ و گروپ', namePs: 'څراغونه او ګروپونه', system: true, activePhase: 1 },
  { code: '592006', type: 'expense', normalBalance: 'debit', parentCode: '5920', nameEn: 'Earthing materials', nameFa: 'مصالح ارتینگ', namePs: 'د ارتنګ مواد', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '592007', type: 'expense', normalBalance: 'debit', parentCode: '5920', nameEn: 'Electrician wages', nameFa: 'مزد برق‌کار', namePs: 'د برقکار مزد', system: true, activePhase: 1 },
  { code: '592008', type: 'expense', normalBalance: 'debit', parentCode: '5920', nameEn: 'Testing & commissioning', nameFa: 'تست و راه‌اندازی برق', namePs: 'د برق ټیسټ', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5930 detail ----- */
  { code: '593001', type: 'expense', normalBalance: 'debit', parentCode: '5930', nameEn: 'Water supply pipes', nameFa: 'لوله آب', namePs: 'د اوبو پایپونه', system: true, activePhase: 1 },
  { code: '593002', type: 'expense', normalBalance: 'debit', parentCode: '5930', nameEn: 'Fittings, valves & elbows', nameFa: 'اتصالات، والو و زانو', namePs: 'فټنګ، والو او زنګن', system: true, activePhase: 1 },
  { code: '593003', type: 'expense', normalBalance: 'debit', parentCode: '5930', nameEn: 'Sanitary ware (WC, basins)', nameFa: 'لوازم صحی (کمود، دستشویی)', namePs: 'صحي سامانونه', system: true, activePhase: 1 },
  { code: '593004', type: 'expense', normalBalance: 'debit', parentCode: '5930', nameEn: 'Faucets & mixers', nameFa: 'شیرآلات', namePs: 'شېرونه', system: true, activePhase: 1 },
  { code: '593005', type: 'expense', normalBalance: 'debit', parentCode: '5930', nameEn: 'Water tanks', nameFa: 'تانکر آب', namePs: 'د اوبو ټانکۍ', system: true, activePhase: 1 },
  { code: '593006', type: 'expense', normalBalance: 'debit', parentCode: '5930', nameEn: 'Sewage & drainage pipes', nameFa: 'لوله فاضلاب', namePs: 'د فاضلاب پایپونه', system: true, activePhase: 1 },
  { code: '593007', type: 'expense', normalBalance: 'debit', parentCode: '5930', nameEn: 'Plumber wages', nameFa: 'مزد لوله‌کش', namePs: 'د نلدوان مزد', system: true, activePhase: 1 },
  { code: '593008', type: 'expense', normalBalance: 'debit', parentCode: '5930', nameEn: 'Pressure testing', nameFa: 'تست فشار لوله', namePs: 'د پایپ فشار ټیسټ', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5940 detail ----- */
  { code: '594001', type: 'expense', normalBalance: 'debit', parentCode: '5940', nameEn: 'Wooden doors', nameFa: 'دروازه‌های چوبی', namePs: 'لرګینې دروازې', system: true, activePhase: 1 },
  { code: '594002', type: 'expense', normalBalance: 'debit', parentCode: '5940', nameEn: 'Steel & PVC doors', nameFa: 'دروازه‌های فلزی و PVC', namePs: 'فلزي او PVC دروازې', system: true, activePhase: 1 },
  { code: '594003', type: 'expense', normalBalance: 'debit', parentCode: '5940', nameEn: 'Window frames', nameFa: 'چوکات ورک', namePs: 'د ورکو چوکاټونه', system: true, activePhase: 1 },
  { code: '594004', type: 'expense', normalBalance: 'debit', parentCode: '5940', nameEn: 'Glass & glazing', nameFa: 'شیشه و نصب آن', namePs: 'ښیښه', system: true, activePhase: 1 },
  { code: '594005', type: 'expense', normalBalance: 'debit', parentCode: '5940', nameEn: 'Locks, handles & hinges', nameFa: 'قفل، دستگیره و لولا', namePs: 'قلف، لاسني او لوځې', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '594006', type: 'expense', normalBalance: 'debit', parentCode: '5940', nameEn: 'Carpentry & installation wages', nameFa: 'مزد نجاری و نصب', namePs: 'د نجارۍ او نصب مزد', system: true, activePhase: 1 },
  { code: '594007', type: 'expense', normalBalance: 'debit', parentCode: '5940', nameEn: 'Varnish & wood polish', nameFa: 'وارنیش و پولیش چوب', namePs: 'وارنیش او پولیش', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5950 detail ----- */
  { code: '595001', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Floor tiles', nameFa: 'کاشی کف', namePs: 'د فرش کاشي', system: true, activePhase: 1 },
  { code: '595002', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Wall tiles', nameFa: 'کاشی دیوار', namePs: 'د دېوال کاشي', system: true, activePhase: 1 },
  { code: '595003', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Tile adhesive & mortar', nameFa: 'چسب و ملات کاشی', namePs: 'د کاشۍ چسپ', system: true, activePhase: 1 },
  { code: '595004', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Grout', nameFa: 'بندکشی (گروت)', namePs: 'ګراوټ', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595005', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Tile fixer wages', nameFa: 'مزد کاشی‌کار', namePs: 'د کاشۍ کار مزد', system: true, activePhase: 1 },
  { code: '595006', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Gypsum plaster', nameFa: 'گچ', namePs: 'ګچ', system: true, activePhase: 1 },
  { code: '595007', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Plasterer wages', nameFa: 'مزد گچ‌کار', namePs: 'د ګچ کار مزد', system: true, activePhase: 1 },
  { code: '595008', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Emulsion/plastic paint', nameFa: 'رنگ پلاستیک', namePs: 'پلاستیکي رنګ', system: true, activePhase: 1 },
  { code: '595009', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Oil & enamel paint', nameFa: 'رنگ روغنی', namePs: 'روغني رنګ', system: true, activePhase: 1 },
  { code: '595010', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Primer & sealer', nameFa: 'پرایمر و سیلر', namePs: 'پرایمر', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595011', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Wall putty', nameFa: 'بتونه', namePs: 'پوټي', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595012', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Sandpaper & abrasives', nameFa: 'ریگمال', namePs: 'رېګمال', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595013', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Brushes', nameFa: 'برس', namePs: 'برسونه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595014', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Rollers & trays', nameFa: 'غلتک و تشت رنگ', namePs: 'رولرونه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595015', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Masking tape & covers', nameFa: 'چسپ محافظ و نایلون', namePs: 'محافظتي ټېپ', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595016', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Thinner & solvents', nameFa: 'تینر', namePs: 'تینر', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595017', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Spray machine rental', nameFa: 'کرایه ماشین رنگ‌پاشی', namePs: 'د رنګ پاشلو ماشین', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595018', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Painter wages', nameFa: 'مزد رنگمال', namePs: 'د رنګمال مزد', system: true, activePhase: 1 },
  { code: '595019', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Painter helpers', nameFa: 'مزد شاگرد رنگمال', namePs: 'د رنګمال شاګرد', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595020', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Final cleaning', nameFa: 'پاک‌کاری نهایی تعمیر', namePs: 'د ودانۍ وروستۍ پاکوالي', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '595021', type: 'expense', normalBalance: 'debit', parentCode: '5950', nameEn: 'Touch-ups & snagging', nameFa: 'ریزه‌کاری و اصلاحات', namePs: 'وړې جوړونې', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5960 detail ----- */
  { code: '596001', type: 'expense', normalBalance: 'debit', parentCode: '5960', nameEn: 'Excavation work', nameFa: 'خاکبرداری', namePs: 'کېندنه', system: true, activePhase: 1 },
  { code: '596002', type: 'expense', normalBalance: 'debit', parentCode: '5960', nameEn: 'Shoring & soil support', nameFa: 'تکیه‌گاه و تحکیم خاک', namePs: 'د خاورې ټینګښت', system: true, activePhase: 1 },
  { code: '596003', type: 'expense', normalBalance: 'debit', parentCode: '5960', nameEn: 'Backfill & compaction', nameFa: 'خاک‌ریزی و تراکم', namePs: 'خاورې اچول او ټینګول', system: true, activePhase: 1 },
  { code: '596004', type: 'expense', normalBalance: 'debit', parentCode: '5960', nameEn: 'Soil testing', nameFa: 'تست خاک', namePs: 'د خاورې معاینه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '596005', type: 'expense', normalBalance: 'debit', parentCode: '5960', nameEn: 'Elevator supply', nameFa: 'خرید لیفت', namePs: 'د لفټ پېرل', system: true, activePhase: 1 },
  { code: '596006', type: 'expense', normalBalance: 'debit', parentCode: '5960', nameEn: 'Elevator installation', nameFa: 'نصب لیفت', namePs: 'د لفټ نصب', system: true, activePhase: 1 },
  { code: '596007', type: 'expense', normalBalance: 'debit', parentCode: '5960', nameEn: 'Elevator initial service', nameFa: 'سرویس اولیه لیفت', namePs: 'د لفټ لومړنی سرویس', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5970 detail ----- */
  { code: '597001', type: 'expense', normalBalance: 'debit', parentCode: '5970', nameEn: 'Municipality & construction permit', nameFa: 'جواز شاروالی و اعمار', namePs: 'د ښاروالۍ جواز', system: true, activePhase: 1 },
  { code: '597002', type: 'expense', normalBalance: 'debit', parentCode: '5970', nameEn: 'Architectural design fee', nameFa: 'فیس دیزاین', namePs: 'د ډیزاین فیس', system: true, activePhase: 1 },
  { code: '597003', type: 'expense', normalBalance: 'debit', parentCode: '5970', nameEn: 'Structural engineering fee', nameFa: 'فیس انجنیری ساختمان', namePs: 'د ساختمان انجنیرۍ فیس', system: true, activePhase: 1 },
  { code: '597004', type: 'expense', normalBalance: 'debit', parentCode: '5970', nameEn: 'Site supervision fee', nameFa: 'فیس نظارت ساحه', namePs: 'د ساحې څارنې فیس', system: true, activePhase: 1 },
  { code: '597005', type: 'expense', normalBalance: 'debit', parentCode: '5970', nameEn: 'Soil survey', nameFa: 'سروی خاک', namePs: 'د خاورې سروې', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '597006', type: 'expense', normalBalance: 'debit', parentCode: '5970', nameEn: 'Legal & documentation', nameFa: 'اسناد حقوقی و قباله', namePs: 'حقوقي سندونه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '597007', type: 'expense', normalBalance: 'debit', parentCode: '5970', nameEn: 'Printing & copies', nameFa: 'چاپ نقشه و کاپی', namePs: 'د نقشو چاپ', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5980 detail ----- */
  { code: '598001', type: 'expense', normalBalance: 'debit', parentCode: '5980', nameEn: 'Temporary fencing & gate', nameFa: 'دیوار موقت و دروازه ساحه', namePs: 'لنډمهاله دېوال', system: true, activePhase: 1 },
  { code: '598002', type: 'expense', normalBalance: 'debit', parentCode: '5980', nameEn: 'Guard room & site office', nameFa: 'اتاق نگهبان و دفتر ساحه', namePs: 'د ساتونکي خونه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '598003', type: 'expense', normalBalance: 'debit', parentCode: '5980', nameEn: 'Site guard wages', nameFa: 'مزد نگهبان', namePs: 'د ساتونکي مزد', system: true, activePhase: 1 },
  { code: '598004', type: 'expense', normalBalance: 'debit', parentCode: '5980', nameEn: 'Site lighting', nameFa: 'روشنایی ساحه', namePs: 'د ساحې رڼا', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '598005', type: 'expense', normalBalance: 'debit', parentCode: '5980', nameEn: 'Office supplies', nameFa: 'لوازم دفتر ساحه', namePs: 'د دفتر سامانونه', system: true, activePhase: 1, isBudgetMinor: true },
  { code: '598006', type: 'expense', normalBalance: 'debit', parentCode: '5980', nameEn: 'Site signage', nameFa: 'تابلوی پروژه', namePs: 'د پروژې تابلو', system: true, activePhase: 1, isBudgetMinor: true },
  /* ----- 5990 detail ----- */
  { code: '599001', type: 'expense', normalBalance: 'debit', parentCode: '5990', nameEn: 'Contingency reserve', nameFa: 'احتیاط (پیش‌بینی‌نشده)', namePs: 'احتیاطي زېرمه', system: true, activePhase: 1 },
  { code: '599002', type: 'expense', normalBalance: 'debit', parentCode: '5990', nameEn: 'Price escalation allowance', nameFa: 'افزایش نرخ‌ها', namePs: 'د بیو لوړېدل', system: true, activePhase: 1 },
  { code: '599003', type: 'expense', normalBalance: 'debit', parentCode: '5990', nameEn: 'Miscellaneous', nameFa: 'متفرقه', namePs: 'متفرقه', system: true, activePhase: 1, isBudgetMinor: true },

  /* ================= 6000 OPERATING & ADMIN (COMPANY) ================= */
  { code: '6000', type: 'expense', normalBalance: 'debit', nameEn: 'Operating & Admin Expenses', nameFa: 'هزینه‌های اداری عمومی (غیر از پروژه)', namePs: 'عمومي اداري لګښتونه', isHeader: true, system: true,
    description: 'Company-level overheads — NOT project costs, kept out of project P&L.' },
  { code: '6100', type: 'expense', normalBalance: 'debit', parentCode: '6000', nameEn: 'Office Rent & Admin', nameFa: 'کرایه و مصارف دفتر مرکزی', namePs: 'د مرکزي دفتر کرایه او لګښتونه', system: true, activePhase: 2 },
  { code: '6200', type: 'expense', normalBalance: 'debit', parentCode: '6000', nameEn: 'Admin Salaries', nameFa: 'معاشات کارمندان اداری', namePs: 'د اداري کارکوونکو معاشونه', system: true, activePhase: 2 },
  { code: '6300', type: 'expense', normalBalance: 'debit', parentCode: '6000', nameEn: 'Marketing & Advertising', nameFa: 'بازاریابی و تبلیغات', namePs: 'بازار موندنه او اعلانونه', system: true, activePhase: 2 },
  { code: '6900', type: 'expense', normalBalance: 'debit', parentCode: '6000', nameEn: 'Other Operating Expenses', nameFa: 'سایر هزینه‌های عملیاتی', namePs: 'نور عملیاتي لګښتونه', system: true, activePhase: 2 },

  /* ========================= 7000 FINANCE COSTS ======================= */
  { code: '7000', type: 'expense', normalBalance: 'debit', nameEn: 'Finance Costs', nameFa: 'هزینه‌های مالی', namePs: 'مالي لګښتونه', isHeader: true, system: true },
  { code: '7100', type: 'expense', normalBalance: 'debit', parentCode: '7000', nameEn: 'Bank Charges', nameFa: 'کارمزد بانک', namePs: 'د بانک فیس', system: true, activePhase: 2 },
  { code: '7200', type: 'expense', normalBalance: 'debit', parentCode: '7000', nameEn: 'Loan & Finance Cost', nameFa: 'هزینه قرض و سود', namePs: 'د پور لګښت او ګټه', system: true, activePhase: 2 },

  /* ============================ 8000 OTHER ============================ */
  { code: '8000', type: 'expense', normalBalance: 'debit', nameEn: 'Other Accounts', nameFa: 'سایر حساب‌ها', namePs: 'نور حسابونه', isHeader: true, system: true },
  { code: '8100', type: 'expense', normalBalance: 'debit', parentCode: '8000', nameEn: 'Accounting Adjustments', nameFa: 'تعدیلات حسابداری', namePs: 'د محاسبې سمونونه', system: true, activePhase: 2 },
  { code: '8200', type: 'expense', normalBalance: 'debit', parentCode: '8000', nameEn: 'Suspense Account', nameFa: 'حساب موقت (در انتظار طبقه‌بندی)', namePs: 'لنډمهاله حساب', system: true, activePhase: 2,
    description: 'Temporary parking for unclassifiable items until corrected.' },
];

/* ------------------------------------------------------------------ */
/* Lookup helpers                                                      */
/* ------------------------------------------------------------------ */

/* Wave 17: admin-defined custom accounts live in a runtime registry so every
 * lookup (names, roll-up, budget groups, pickers) sees them. The static
 * CHART_OF_ACCOUNTS array is never mutated. */
let customAccountsRegistry: Account[] = [];
let ACCOUNT_INDEX: Map<string, Account> = new Map(CHART_OF_ACCOUNTS.map(a => [a.code, a]));

function rebuildIndex(): void {
  ACCOUNT_INDEX = new Map(
    [...CHART_OF_ACCOUNTS, ...customAccountsRegistry].map(a => [a.code, a]),
  );
}

/** Replace the runtime custom accounts (called by AppContext on boot/change). */
export function setCustomAccounts(list: Account[]): void {
  customAccountsRegistry = [...list];
  rebuildIndex();
}

export function getCustomAccounts(): Account[] {
  return [...customAccountsRegistry];
}

/** Full working chart: system accounts + admin customs. */
export function getFullChart(): Account[] {
  return [...CHART_OF_ACCOUNTS, ...customAccountsRegistry];
}

export function getAccount(code: string): Account | undefined {
  return ACCOUNT_INDEX.get(code);
}

export function getAccountName(code: string, lang: 'en' | 'fa' | 'ps' = 'fa'): string {
  const acc = ACCOUNT_INDEX.get(code);
  if (!acc) return code;
  return lang === 'ps' ? acc.namePs : lang === 'en' ? acc.nameEn : acc.nameFa;
}

export function isPostingAccount(code: string): boolean {
  const acc = ACCOUNT_INDEX.get(code);
  return !!acc && !acc.isHeader;
}

/** All postable (non-header) accounts */
export function getPostingAccounts(): Account[] {
  return getFullChart().filter(a => !a.isHeader);
}

/** Accounts belonging to a top-level group, e.g. groupCode '5000' */
export function getAccountsInGroup(groupCode: string): Account[] {
  return getFullChart().filter(a => a.code.startsWith(groupCode[0]));
}

/**
 * Roll a budget code up to its 4-digit trade main (leaf → parent main).
 * Actual costs post to mains, so leaf-level budgets compare at main level.
 * Unknown codes pass through untouched (computeBudgetReport skips them).
 */
export function toBudgetMain(code: string): string {
  if (!code || code.length <= 4) return code;
  const acc = ACCOUNT_INDEX.get(code);
  if (acc?.parentCode) return acc.parentCode;
  return code.slice(0, 4);
}

/** One trade (main + its leaf accounts) for the budget sheet form. */
export interface BudgetTradeGroup {
  main: Account;
  /** Always-visible planning lines */
  majors: Account[];
  /** Optional small expenses (collapsed by default) */
  minors: Account[];
}

/**
 * All plannable 5xxx trades with their leaves (Wave 14).
 * 5050 COGS is excluded — it is system-computed, never budgeted by hand.
 */
export function getBudgetTradeGroups(): BudgetTradeGroup[] {
  const chart = getFullChart();
  const mains = chart.filter(
    a => a.parentCode === '5000' && !a.isHeader && a.code !== '5050',
  );
  return mains.map(main => {
    const leaves = chart.filter(a => a.parentCode === main.code);
    return {
      main,
      majors: leaves.filter(l => !l.isBudgetMinor),
      minors: leaves.filter(l => !!l.isBudgetMinor),
    };
  });
}

/**
 * Next free 6-digit leaf code under a trade main (01–99). Null when full.
 * Reads the full chart so admin customs are never collided with.
 */
export function nextLeafCode(parentCode: string): string | null {
  if (!/^\d{4}$/.test(parentCode || '')) return null;
  const used = new Set<number>();
  for (const a of getFullChart()) {
    if (a.parentCode === parentCode && a.code.startsWith(parentCode)) {
      const suffix = a.code.slice(parentCode.length);
      if (/^\d+$/.test(suffix)) used.add(parseInt(suffix, 10));
    }
  }
  for (let n = 1; n <= 99; n++) {
    if (!used.has(n)) return `${parentCode}${String(n).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Validate + normalize persisted custom accounts (corrupted storage must
 * never crash the chart). Drops non-objects, bad codes/parents, empty
 * names and anything colliding with the system chart.
 */
export function sanitizeCustomAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw)) return [];
  const out: Account[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const a = x as Partial<Account>;
    if (typeof a.code !== 'string' || !/^\d{6}$/.test(a.code)) continue;
    if (typeof a.parentCode !== 'string' || !/^\d{4}$/.test(a.parentCode)) continue;
    if (typeof a.nameFa !== 'string' || !a.nameFa.trim()) continue;
    const nameFa = a.nameFa.trim();
    out.push({
      code: a.code,
      type: 'expense',
      normalBalance: 'debit',
      parentCode: a.parentCode,
      nameEn: typeof a.nameEn === 'string' && a.nameEn.trim() ? a.nameEn.trim() : nameFa,
      nameFa,
      namePs: typeof a.namePs === 'string' && a.namePs.trim() ? a.namePs.trim() : nameFa,
      system: false,
      activePhase: 1,
      ...(a.isBudgetMinor ? { isBudgetMinor: true } : {}),
    });
  }
  const sys = new Set(CHART_OF_ACCOUNTS.map(s => s.code));
  const seen = new Set<string>();
  return out.filter(a => {
    if (sys.has(a.code) || seen.has(a.code)) return false;
    seen.add(a.code);
    return true;
  });
}

/**
 * Why a custom account cannot be deleted, or null when it is safe.
 * Checks children first, then stored budgets, then posted journal balances.
 */
export function accountDeleteBlocker(
  code: string,
  budgetCodes: string[],
  postedCodes: string[],
): 'has-children' | 'has-budgets' | 'has-journals' | null {
  if (getFullChart().some(a => a.parentCode === code)) return 'has-children';
  if (budgetCodes.includes(code)) return 'has-budgets';
  if (postedCodes.includes(code)) return 'has-journals';
  return null;
}

/**
 * Walk `parentCode` chain upward and return ancestor codes (closest first).
 */
export function getAncestorCodes(code: string): string[] {
  const chain: string[] = [];
  let current = ACCOUNT_INDEX.get(code);
  let guard = 0;
  while (current?.parentCode && guard++ < 10) {
    chain.push(current.parentCode);
    current = ACCOUNT_INDEX.get(current.parentCode);
  }
  return chain;
}

/* ------------------------------------------------------------------ */
/* Expense category -> account mapping                                 */
/* ------------------------------------------------------------------ */

/**
 * The app never stores account codes — users pick business categories
 * (e.g. 'Cement', 'Formwork', 'Daily Labour Wages', custom categories...).
 * This map routes every known category (English ids, English labels, Dari
 * labels from the modals, and legacy seed values) to its project-cost
 * account. Lookup is normalized (lowercase/trim) and falls back to 5990.
 */
export const EXPENSE_CATEGORY_ACCOUNT_MAP: Record<string, string> = {
  // ---- 5100 Steel ----
  'steel': '5100', 'steel / rebar': '5100', 'steel/rebar': '5100', 'rebar': '5100',
  'سیخ': '5100', 'سیخ‌گول': '5100', 'سیخ‌گول (فولاد)': '5100',

  // ---- 5200 Concrete ----
  'concrete': '5200', 'concrete & pump': '5200', 'concrete & pumping': '5200',
  'کانکریت': '5200', 'کانکریت و پمپ': '5200',

  // ---- 5300 Cement ----
  'cement': '5300', 'سیمنت': '5300',
  'materials': '5300', 'building materials': '5300',

  // ---- 5400 Sand & Gravel ----
  'sand': '5400', 'gravel': '5400', 'sand & gravel': '5400', 'ریگ': '5400',

  // ---- 5500 Masonry ----
  'masonry': '5500', 'brick / block masonry': '5500', 'blocks': '5500',
  'bricks': '5500', 'بلاک': '5500', 'آجر': '5500',

  // ---- 5600 Labour ----
  'labour': '5600', 'labor': '5600', 'direct labour': '5600', 'wages': '5600',
  'daily_labour': '5600', 'daily labour wages': '5600',
  'worker_food': '5600', 'worker meals & food': '5600',
  'مزد': '5600', 'مزد کارگران روزمزد': '5600', 'نان و غذای کارگران': '5600',

  // ---- 5700 Machinery ----
  'machinery': '5700', 'machinery & equipment rental': '5700', 'equipment': '5700',

  // ---- 5800 Transportation ----
  'transportation': '5800', 'transportation & logistics': '5800',
  'transportation & fares': '5800', 'transport': '5800',
  'کرایه موتر و ترانسپورت': '5800',

  // ---- 5900 Utilities & Fuel ----
  'utilities': '5900', 'electricity': '5900', 'water': '5900',
  'fuel': '5900', 'fuel & generator': '5900',

  // ---- 5910 Formwork & Scaffolding ----
  'formwork': '5910', 'formwork & carpentry': '5910', 'formwork & shuttering': '5910',
  'formworkcontract': '5910',
  'scaffolding': '5910', 'scaffolding (rental & fix)': '5910',
  'wood_supplier': '5910', 'plywood & wood supplier': '5910',
  'tie_wire': '5910', 'tie wire & steel fixer': '5910',
  'قالب‌بندی و نجاری (تخته و چوب)': '5910', 'اسکافولد و داربست (کرایه و بستن)': '5910',

  // ---- 5920 Electrical ----
  'electrical': '5920', 'electrical works': '5920', 'برق‌کاری و تأسیسات برقی': '5920',

  // ---- 5930 Plumbing ----
  'plumbing': '5930', 'plumbing & sanitary': '5930',

  // ---- 5940 Carpentry, Doors & Windows ----
  'carpentry': '5940', 'doors': '5940', 'windows': '5940', 'windows & glazing': '5940',
  'doors & windows': '5940', 'doorswindows': '5940',

  // ---- 5950 Tiles, Paint & Finishing ----
  'رنگ': '5950', 'رنگمالی': '5950', 'گچ': '5950', 'گچ‌کاری': '5950',
  'paint': '5950', 'paint & finishes': '5950', 'painting': '5950', 'painting & finishes': '5950',
  'finishing': '5950', 'finishing materials': '5950',
  'tiles': '5950', 'tiles & flooring': '5950',
  'plaster': '5950', 'plaster & finishing': '5950',

  // ---- 5960 Elevator & Excavation ----
  'elevator': '5960', 'elevator & lifts': '5960',
  'excavation': '5960', 'excavation & shoring': '5960',

  // ---- 5970 Permits, Fees & Engineering ----
  'taxes': '5970', 'taxes & municipal fees': '5970',
  'landpermits': '5970', 'land / municipality / permits': '5970',
  'municipality': '5970', 'district / municipality fee': '5970',
  'تعرفه ناحیه و شاروالی': '5970',
  'engineering': '5970', 'engineering & design': '5970', 'permits': '5970',

  // ---- 5980 Site Overhead ----
  'security': '5980', 'site security guard': '5980',

  // ---- 5990 Other ----
  'other': '5990', 'other construction expenses': '5990', 'other construction costs': '5990',
  'miscellaneous': '5990', 'miscellaneous expenses': '5990',
  'مصارف متفرقه و پیش‌بینی‌نشده': '5990',
};

export const DEFAULT_EXPENSE_ACCOUNT = '5990';

/** Substrings checked (lower-cased) when an exact map entry is missing */
const FUZZY_CATEGORY_HINTS: Array<[string, string]> = [
  ['steel', '5100'], ['rebar', '5100'], ['سیخ', '5100'], ['آهن', '5100'],
  ['concrete', '5200'], ['کانکریت', '5200'], ['pump', '5200'],
  ['cement', '5300'], ['سیمنت', '5300'],
  ['sand', '5400'], ['gravel', '5400'], ['ریگ', '5400'], ['شن', '5400'],
  ['masonry', '5500'], ['block', '5500'], ['brick', '5500'], ['بلاک', '5500'], ['آجر', '5500'],
  ['labour', '5600'], ['labor', '5600'], ['wage', '5600'], ['worker', '5600'], ['کارگر', '5600'], ['مزد', '5600'],
  ['machin', '5700'], ['equipment', '5700'], ['mixer', '5700'], ['crane', '5700'], ['حفار', '5700'],
  ['transport', '5800'], ['فلیت', '5800'], ['کرایه موتر', '5800'],
  ['fuel', '5900'], ['diesel', '5900'], ['generator', '5900'], ['تیل', '5900'], ['برق', '5920'],
  ['formwork', '5910'], ['scaffold', '5910'], ['shutter', '5910'], ['قالب', '5910'], ['داربست', '5910'], ['tie wire', '5910'],
  ['electric', '5920'], ['wire', '5920'],
  ['plumb', '5930'], ['pipe', '5930'], ['sanitary', '5930'], ['لوله', '5930'],
  ['door', '5940'], ['window', '5940'], ['carpent', '5940'], ['نجار', '5940'], ['ورک', '5940'],
  ['paint', '5950'], ['tile', '5950'], ['plaster', '5950'], ['finish', '5950'], ['نقاش', '5950'], ['کاشي', '5950'], ['کاشی', '5950'],
  ['elevator', '5960'], ['lift', '5960'], ['excavat', '5960'], ['لیفتر', '5960'], ['حفار', '5960'],
  ['permit', '5970'], ['municipal', '5970'], ['tax', '5970'], ['engineering', '5970'], ['جواز', '5970'], ['شاروال', '5970'], ['ناحیه', '5970'],
  ['security', '5980'], ['guard', '5980'], ['نگهبان', '5980'],
  ['food', '5600'], ['نان', '5600'],
];

/**
 * Resolve any user-facing expense category (stored on `Expense.category`)
 * to its project-cost account code. Never fails — falls back to 5990.
 */
export function resolveExpenseAccount(category?: string): string {
  if (!category) return DEFAULT_EXPENSE_ACCOUNT;
  const key = category.trim().toLowerCase();
  if (EXPENSE_CATEGORY_ACCOUNT_MAP[key]) return EXPENSE_CATEGORY_ACCOUNT_MAP[key];
  for (const [hint, code] of FUZZY_CATEGORY_HINTS) {
    if (key.includes(hint)) return code;
  }
  return DEFAULT_EXPENSE_ACCOUNT;
}

/* ------------------------------------------------------------------ */
/* Well-known account codes (single source of truth for the engine)    */
/* ------------------------------------------------------------------ */

export const ACC = {
  CASH_AFN: '1110',
  CASH_USD: '1120',
  BANK: '1130',
  HAWALA: '1140',
  APARTMENT_RECEIVABLES: '1200',
  ADVANCES_TO_SUPPLIERS: '1300',
  MATERIAL_INVENTORY: '1400',
  WIP: '1500',
  SUPPLIER_PAYABLES: '2200',
  CONTRACTOR_PAYABLES: '2250',
  CUSTOMER_ADVANCES: '2300',
  RETENTION_PAYABLE: '2400',
  OTHER_LIABILITIES: '2900',
  PARTNERS_CAPITAL: '3100',
  ADDITIONAL_INVESTMENTS: '3200',
  PARTNER_DRAWINGS: '3300',
  UNIT_SALES: '4100',
  OTHER_REVENUE: '4300',
  COGS: '5050',
  STEEL: '5100',
  CONCRETE: '5200',
  OTHER_PROJECT_EXPENSES: '5990',
  SUSPENSE: '8200',
} as const;
