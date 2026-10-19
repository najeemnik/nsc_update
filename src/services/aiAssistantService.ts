export interface ProjectContextSummary {
  projectName: string;
  totalSteelTons: number;
  steelCostUSD: number;
  totalConcreteM3: number;
  concreteCostUSD: number;
  totalExpensesUSD: number;
  totalPaidUSD: number;
  totalDebtUSD: number;
  apartmentsTotal: number;
  apartmentsSold: number;
  apartmentsAvailable: number;
  totalSalesValueUSD: number;
  salesReceivedUSD: number;
  salesDueUSD: number;
}

export type AiLang = 'en' | 'fa' | 'ps';

type Topic = 'steel' | 'concrete' | 'apartments' | 'expenses' | 'debts' | 'projects' | 'summary';

const has = (q: string, ...words: string[]): boolean => words.some(w => q.includes(w));

function detectTopic(q: string): Topic {
  if (has(q, 'سیخ', 'فولاد', 'steel', 'rebar', 'آهن', 'سیخ‌ګول', 'اوسپنه')) return 'steel';
  if (has(q, 'کانکریت', 'concrete', 'پمپ', 'متر مکعب', 'کانکرېټ', 'متر مکعب')) return 'concrete';
  if (has(q, 'اپارتمان', 'فروش', 'باقی', 'قسط', 'مشتری', 'apartment', 'sold', 'اپارټمنټ', 'پلور', 'پېرودونکی', 'قسطونه')) return 'apartments';
  if (has(q, 'مصرف', 'هزینه', 'خرچ', 'expense', 'cost', 'مصارف', 'لګښت', 'خرڅ')) return 'expenses';
  if (has(q, 'قرض', 'طلب', 'باقیداری', 'debt', 'balance', 'پور', 'طلبات')) return 'debts';
  if (has(q, 'پروژه', 'ساختمان', 'project', 'تعمیر', 'پروژې', 'ودانۍ')) return 'projects';
  return 'summary';
}

export function answerProjectQuestionLocally(
  question: string,
  summary: ProjectContextSummary,
  allProjects: Array<{ name: string; floors: number; units: number; city: string }>,
  lang: AiLang = 'fa',
): string {
  const q = question.toLowerCase().trim();
  const topic = detectTopic(q);
  const n = (v: number): string => v.toLocaleString();
  const L = lang === 'ps' ? 'ps' : lang === 'en' ? 'en' : 'fa';

  if (topic === 'steel') {
    if (L === 'en') return `📊 In project "${summary.projectName}", a total of ${n(summary.totalSteelTons)} tons of rebar worth $${n(summary.steelCostUSD)} has been purchased and recorded so far.`;
    if (L === 'ps') return `📊 په "${summary.projectName}" پروژه کې تر اوسه ټولټال ${n(summary.totalSteelTons)} ټنه سیخ‌ګول په $${n(summary.steelCostUSD)} ډالرو پېرل شوي او ثبت شوي دي.`;
    return `📊 در پروژه "${summary.projectName}" تا اکنون مجموعاً ${n(summary.totalSteelTons)} تن سیخ‌گول به ارزش $${n(summary.steelCostUSD)} دالر خریداری و ثبت گردیده است.`;
  }
  if (topic === 'concrete') {
    if (L === 'en') return `🏗️ Total concrete recorded for "${summary.projectName}" is ${n(summary.totalConcreteM3)} m³ with a total cost of $${n(summary.concreteCostUSD)}.`;
    if (L === 'ps') return `🏗️ د "${summary.projectName}" لپاره ثبت شوي کانکرېټ ټولټال ${n(summary.totalConcreteM3)} متر مکعب دی چې ټولټال لګښت یې $${n(summary.concreteCostUSD)} ډالره دی.`;
    return `🏗️ حجم مجموعی کانکریت ثبت شده برای "${summary.projectName}" بالغ بر ${n(summary.totalConcreteM3)} متر مکعب با هزینه مجموعی $${n(summary.concreteCostUSD)} دالر می‌باشد.`;
  }
  if (topic === 'apartments') {
    if (L === 'en') return `🏢 Apartment status for "${summary.projectName}":\n• Total units: ${summary.apartmentsTotal}\n• Sold: ${summary.apartmentsSold}\n• Available: ${summary.apartmentsAvailable}\n• Total sales value: $${n(summary.totalSalesValueUSD)}\n• Collected: $${n(summary.salesReceivedUSD)}\n• Due from buyers: $${n(summary.salesDueUSD)}`;
    if (L === 'ps') return `🏢 د "${summary.projectName}" د اپارټمنټونو وضعیت:\n• ټول واحدونه: ${summary.apartmentsTotal}\n• پلورل شوي: ${summary.apartmentsSold}\n• پاتې (تش): ${summary.apartmentsAvailable}\n• د پلور ټولټال ارزښت: $${n(summary.totalSalesValueUSD)}\n• ترلاسه شوي: $${n(summary.salesReceivedUSD)}\n• له پېرودونکو پاتې: $${n(summary.salesDueUSD)}`;
    return `🏢 وضعیت اپارتمان‌های پروژه "${summary.projectName}":\n• تعداد کل واحدها: ${summary.apartmentsTotal} واحد\n• فروخته شده: ${summary.apartmentsSold} واحد\n• واحد‌های باقیمانده (خالی): ${summary.apartmentsAvailable} واحد\n• ارزش کل فروش: $${n(summary.totalSalesValueUSD)}\n• مبلغ وصول شده: $${n(summary.salesReceivedUSD)}\n• باقی‌داری از خریداران: $${n(summary.salesDueUSD)}`;
  }
  if (topic === 'expenses') {
    if (L === 'en') return `💰 Expenses of "${summary.projectName}":\n• Total recorded expenses & purchases: $${n(summary.totalExpensesUSD)}\n• Total paid: $${n(summary.totalPaidUSD)}\n• Remaining payables: $${n(summary.totalDebtUSD)}`;
    if (L === 'ps') return `💰 د "${summary.projectName}" مصارف:\n• ثبت شوي ټول مصارف او پېرونه: $${n(summary.totalExpensesUSD)}\n• ټولې تادیې: $${n(summary.totalPaidUSD)}\n• پاتې پورونه (طلبکاران): $${n(summary.totalDebtUSD)}`;
    return `💰 مصارف و خروجی مالی پروژه "${summary.projectName}":\n• کل مصارف و خریدهای ثبت شده: $${n(summary.totalExpensesUSD)}\n• مجموع پرداختی‌ها: $${n(summary.totalPaidUSD)}\n• کل قرضداری‌های باقیمانده (طلبکاران): $${n(summary.totalDebtUSD)}`;
  }
  if (topic === 'debts') {
    if (L === 'en') return `⚖️ Debt position of "${summary.projectName}":\n• Owed to suppliers & contractors: $${n(summary.totalDebtUSD)}\n• Due from apartment buyers (installments): $${n(summary.salesDueUSD)}`;
    if (L === 'ps') return `⚖️ د "${summary.projectName}" د پورونو وضعیت:\n• عرضه کوونکو او قراردادیانو ته پور: $${n(summary.totalDebtUSD)}\n• له اپارټمنټ پېرودونکو پاتې (قسطونه): $${n(summary.salesDueUSD)}`;
    return `⚖️ وضعیت بدهی و طلبکاری پروژه "${summary.projectName}":\n• بدهی پروژه به تأمین‌کنندگان و قراردادی‌ها: $${n(summary.totalDebtUSD)}\n• طلب پروژه از خریداران اپارتمان (اقساط معوق): $${n(summary.salesDueUSD)}`;
  }
  if (topic === 'projects') {
    const list = L === 'en'
      ? allProjects.map(p => `• ${p.name} (${p.city}): ${p.floors} floors, ${p.units} units`).join('\n')
      : L === 'ps'
        ? allProjects.map(p => `• ${p.name} (${p.city}): ${p.floors} پوړه، ${p.units} واحدونه`).join('\n')
        : allProjects.map(p => `• ${p.name} (${p.city}): ${p.floors} منزل، ${p.units} واحد`).join('\n');
    if (L === 'en') return `🏢 Your construction projects:\n${list}`;
    if (L === 'ps') return `🏢 ستاسې ساختماني پروژې:\n${list}`;
    return `🏢 فهرست پروژه‌های ساختمانی شما:\n${list}`;
  }
  if (L === 'en') return `📋 Current status of "${summary.projectName}":\n• Rebar used: ${n(summary.totalSteelTons)} tons ($${n(summary.steelCostUSD)})\n• Concrete poured: ${n(summary.totalConcreteM3)} m³ ($${n(summary.concreteCostUSD)})\n• Total construction costs: $${n(summary.totalExpensesUSD)}\n• Sales: ${summary.apartmentsSold} of ${summary.apartmentsTotal} units sold (${summary.apartmentsAvailable} free)\n• Installments due from buyers: $${n(summary.salesDueUSD)}`;
  if (L === 'ps') return `📋 د "${summary.projectName}" اوسنی وضعیت:\n• کارول شوي سیخ: ${n(summary.totalSteelTons)} ټنه ($${n(summary.steelCostUSD)})\n• اچول شوي کانکرېټ: ${n(summary.totalConcreteM3)} متر مکعب ($${n(summary.concreteCostUSD)})\n• د ساختمان ټول لګښتونه: $${n(summary.totalExpensesUSD)}\n• پلور: له ${summary.apartmentsTotal} څخه ${summary.apartmentsSold} واحدونه پلورل شوي (${summary.apartmentsAvailable} تش)\n• له پېرودونکو پاتې قسطونه: $${n(summary.salesDueUSD)}`;
  return `📋 خلاصه وضعیت فعلی پروژه "${summary.projectName}":\n• سیخ مصرفی: ${n(summary.totalSteelTons)} تن ($${n(summary.steelCostUSD)})\n• کانکریت‌ریزی: ${n(summary.totalConcreteM3)} متر مکعب ($${n(summary.concreteCostUSD)})\n• کل هزینه‌های عمرانی: $${n(summary.totalExpensesUSD)}\n• وضعیت فروشات: ${summary.apartmentsSold} از ${summary.apartmentsTotal} واحد فروخته شده (${summary.apartmentsAvailable} واحد آزاد)\n• اقساط باقیمانده از مشتریان: $${n(summary.salesDueUSD)}`;
}
