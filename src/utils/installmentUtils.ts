import {
  ApartmentUnit,
  InstallmentRecord,
  InstallmentStatus,
  SystemReminderNotification,
  NotificationType,
  Project,
  Expense,
  Payment,
  Contractor,
  Supplier,
  DocumentRecord,
  ProjectBudget,
  SteelRecord,
  ConcreteRecord
} from '../types';
import { computeBudgetReport } from './budgetUtils';
import { isCountedDoc } from './docFinance';

/**
 * Calculates current InstallmentStatus based on paid amounts, total amount and due date.
 */
export function calculateInstallmentStatus(
  amount: number,
  paidAmount: number,
  dueDateStr: string,
  now: Date = new Date()
): InstallmentStatus {
  const remaining = Math.max(0, amount - paidAmount);
  if (remaining <= 0.001) {
    return 'Paid';
  }

  // Parse due date cleanly
  const due = new Date(dueDateStr);
  // Reset time to start of day for accurate day comparisons
  const dueStartOfDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (nowStartOfDay > dueStartOfDay) {
    return 'Overdue';
  }

  if (nowStartOfDay === dueStartOfDay) {
    return 'Due';
  }

  if (paidAmount > 0) {
    return 'Partially Paid';
  }

  return 'Pending';
}

/**
 * Calculates days difference (positive if overdue, negative if days remaining until due).
 */
export function getDaysDifference(dueDateStr: string, now: Date = new Date()): number {
  const due = new Date(dueDateStr);
  const dueStartOfDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffMs = nowStartOfDay - dueStartOfDay;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Normalizes an apartment's installments array. If missing but apartment is sold with remaining balance,
 * auto-generates structured InstallmentRecord entries based on salePrice, downPayment and remaining balance.
 */
export function normalizeApartmentInstallments(apartment: ApartmentUnit, now: Date = new Date()): InstallmentRecord[] {
  if (apartment.installments && apartment.installments.length > 0) {
    return apartment.installments.map((inst, idx) => {
      const instNumber = inst.installmentNumber || (idx + 1);
      const paid = inst.paidAmount !== undefined 
        ? inst.paidAmount 
        : (inst.received ? inst.amount : 0);
      const remaining = Math.max(0, inst.amount - paid);
      const dueDate = inst.dueDate || inst.date || apartment.saleDate || new Date().toISOString().split('T')[0];
      const status = calculateInstallmentStatus(inst.amount, paid, dueDate, now);

      return {
        id: inst.id || `inst-${apartment.id}-${instNumber}`,
        installmentNumber: instNumber,
        buyerName: inst.buyerName || apartment.buyerName,
        buyerPhone: inst.buyerPhone || apartment.buyerPhone,
        apartmentNumber: inst.apartmentNumber || apartment.unitNumber,
        apartmentId: inst.apartmentId || apartment.id,
        projectId: inst.projectId || apartment.projectId,
        amount: inst.amount,
        dueDate,
        paidAmount: paid,
        remainingAmount: remaining,
        currency: inst.currency || apartment.currency || 'USD',
        status,
        paymentHistory: inst.paymentHistory || (paid > 0 ? [{
          id: `payhist-${inst.id || instNumber}-1`,
          paymentNumber: 1,
          amount: paid,
          currency: inst.currency || apartment.currency || 'USD',
          date: inst.receivedDate || inst.date || dueDate,
          receiptNumber: `REC-${instNumber}`,
          notes: 'پرداخت قبلی ثبت شده در سیستم'
        }] : []),
        notes: inst.notes || '',
        date: dueDate,
        received: remaining === 0,
        receivedDate: inst.receivedDate
      };
    });
  }

  // If no structured installments exist, but unit is sold
  if (apartment.status === 'sold' && (apartment.salePrice || 0) > 0) {
    const salePrice = apartment.salePrice || apartment.totalPriceUSD || 0;
    const downPayment = apartment.downPayment || apartment.downPaymentUSD || 0;
    const amountReceived = apartment.amountReceived || apartment.paidAmountUSD || downPayment;
    const remainingBalance = Math.max(0, salePrice - amountReceived);

    const generated: InstallmentRecord[] = [];
    const baseDate = new Date(apartment.saleDate || apartment.createdAt || '2024-05-01');

    // If there is downpayment / initial amount
    if (downPayment > 0) {
      generated.push({
        id: `inst-${apartment.id}-down`,
        installmentNumber: 1,
        buyerName: apartment.buyerName,
        buyerPhone: apartment.buyerPhone,
        apartmentNumber: apartment.unitNumber,
        apartmentId: apartment.id,
        projectId: apartment.projectId,
        amount: downPayment,
        dueDate: baseDate.toISOString().split('T')[0],
        paidAmount: downPayment,
        remainingAmount: 0,
        currency: apartment.currency || 'USD',
        status: 'Paid',
        paymentHistory: [{
          id: `payhist-${apartment.id}-dp`,
          paymentNumber: 1,
          amount: downPayment,
          currency: apartment.currency || 'USD',
          date: baseDate.toISOString().split('T')[0],
          receiptNumber: `DP-${apartment.unitNumber}`,
          notes: 'پیش‌پرداخت عقد قرارداد'
        }],
        notes: 'پیش‌پرداخت قرارداد',
        date: baseDate.toISOString().split('T')[0],
        received: true,
        receivedDate: baseDate.toISOString().split('T')[0]
      });
    }

    // Next installments based on remaining
    if (remainingBalance > 0) {
      // Split into 2 or 3 scheduled installments
      const instCount = remainingBalance > 50000 ? 3 : 2;
      const portion = Math.round(remainingBalance / instCount);
      let runningPaid = Math.max(0, amountReceived - downPayment);

      for (let i = 1; i <= instCount; i++) {
        const instAmount = i === instCount ? (remainingBalance - (portion * (instCount - 1))) : portion;
        const instDueDate = new Date(baseDate.getTime() + (i * 45 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        
        let thisPaid = 0;
        if (runningPaid >= instAmount) {
          thisPaid = instAmount;
          runningPaid -= instAmount;
        } else if (runningPaid > 0) {
          thisPaid = runningPaid;
          runningPaid = 0;
        }

        const remaining = Math.max(0, instAmount - thisPaid);
        const status = calculateInstallmentStatus(instAmount, thisPaid, instDueDate, now);

        generated.push({
          id: `inst-${apartment.id}-${i + 1}`,
          installmentNumber: i + 1,
          buyerName: apartment.buyerName,
          buyerPhone: apartment.buyerPhone,
          apartmentNumber: apartment.unitNumber,
          apartmentId: apartment.id,
          projectId: apartment.projectId,
          amount: instAmount,
          dueDate: instDueDate,
          paidAmount: thisPaid,
          remainingAmount: remaining,
          currency: apartment.currency || 'USD',
          status,
          paymentHistory: thisPaid > 0 ? [{
            id: `payhist-${apartment.id}-${i + 1}-1`,
            paymentNumber: 1,
            amount: thisPaid,
            currency: apartment.currency || 'USD',
            date: instDueDate,
            receiptNumber: `REC-${apartment.unitNumber}-${i + 1}`,
            notes: 'پرداخت قسمتی از قسط'
          }] : [],
          notes: `قسط شماره ${i + 1} اپارتمان ${apartment.unitNumber}`,
          date: instDueDate,
          received: remaining === 0,
          receivedDate: remaining === 0 ? instDueDate : undefined
        });
      }
    }

    return generated;
  }

  return [];
}

/**
 * NSC Smart Notification Engine (Wave 12 — full rewrite of the Wave-1 stub).
 * Pure + deterministic: same inputs ⇒ same reminders. Trilingual output.
 *
 * Categories (all 8 NotificationTypes):
 *  1. installment_overdue  P1  daily, max 4, longest-overdue first
 *  2. installment_due_soon P2  daily within dueSoonDays, max 4, closest first
 *  3. installment_paid     P7  info, installments fully paid in last 7 days, max 4
 *  4. unpaid_purchase      P3  top-1 unpaid expense + overflow count
 *  5. outstanding_debt     P4  top-1 contractor debt + top-1 supplier debt (+ counts)
 *  6. missing_document     P6  expenses & payments ≥ $500 without bill/receipt (+ counts)
 *  7. project_inactivity   P5  active projects silent for inactivityDays, max 5
 *  8. general_financial    P3  budget lines at/over 100% per project
 */

export type ReminderLang = 'en' | 'fa' | 'ps';

type Tpl = { en: string; fa: string; ps: string };
const T: Record<string, Tpl> = {
  overdueTitle: {
    en: 'Overdue installment #{n} (unit {u})',
    fa: 'تأخیر در پرداخت قسط #{n} (اپارتمان {u})',
    ps: 'د #{n} قسط په ورکړه کې ځنډ (اپارتمان {u})',
  },
  overdueMsg: {
    en: 'Installment #{n} of unit {u} ({b}) is overdue: {amt} still due, {d} day(s) late.',
    fa: 'قسط شماره {n} اپارتمان {u} ({b}) سررسید شده و هنوز {amt} باقی مانده است. مدت تأخیر: {d} روز.',
    ps: 'د اپارتمان {u} ({b}) #{n} قسط نېټه تېره شوې او لا {amt} پاتې دي. ځنډ: {d} ورځې.',
  },
  dueSoonTitle: {
    en: 'Installment #{n} due {when} (unit {u})',
    fa: 'قسط #{n} {when} سررسید می‌شود (اپارتمان {u})',
    ps: 'د اپارتمان {u} #{n} قسط {when} نېټه رسېږي',
  },
  dueSoonMsg: {
    en: 'Reminder: installment #{n} of unit {u} ({b}), remaining {amt}, due {date} ({when}).',
    fa: 'یادآوری قسط: قسط شماره {n} اپارتمان {u} ({b}) به مبلغ باقی‌مانده {amt} در تاریخ {date} سررسید می‌شود ({when}).',
    ps: 'د قسط یادونه: د اپارتمان {u} ({b}) #{n} قسط، پاتې {amt}، نېټه {date} ({when}).',
  },
  todayWord: { en: 'today', fa: 'امروز', ps: 'نن' },
  daysLeftWord: { en: '{d} day(s) left', fa: '{d} روز باقی مانده', ps: '{d} ورځې پاتې' },
  paidTitle: {
    en: 'Installment #{n} fully paid (unit {u})',
    fa: 'قسط #{n} به‌طور کامل پرداخت شد (اپارتمان {u})',
    ps: 'د اپارتمان {u} #{n} قسط پوره ورکړل شو',
  },
  paidMsg: {
    en: 'Installment #{n} of unit {u} ({b}) was fully paid on {date}.',
    fa: 'قسط شماره {n} اپارتمان {u} ({b}) در تاریخ {date} به‌طور کامل پرداخت شد.',
    ps: 'د اپارتمان {u} ({b}) #{n} قسط په {date} نېټه پوره ورکړل شو.',
  },
  buyerWord: { en: 'buyer', fa: 'خریدار', ps: 'پېرودونکی' },
  projectWord: { en: 'project', fa: 'پروژه', ps: 'پروژه' },
  unpaidTitle: {
    en: 'Unpaid bill: {desc}',
    fa: 'بل پرداخت‌نشده: {desc}',
    ps: 'ناورکړل شوی بل: {desc}',
  },
  unpaidMsg: {
    en: '"{desc}" — {amt} still unpaid{more}.',
    fa: '"{desc}" — مبلغ {amt} هنوز پرداخت نشده است{more}.',
    ps: '"{desc}" — {amt} لا نه دي ورکړل شوي{more}.',
  },
  moreWord: { en: ' (+{n} more)', fa: ' (+{n} مورد دیگر)', ps: ' (+{n} نور)' },
  contractorDebtTitle: {
    en: 'Contractor balance due: {name}',
    fa: 'باقی‌داری قراردادی: {name}',
    ps: 'د قراردادي پاتې حساب: {name}',
  },
  contractorDebtMsg: {
    en: 'Contractor "{name}" is owed {amt}{more}.',
    fa: 'قراردادی "{name}" مبلغ {amt} باقی‌داری دارد{more}.',
    ps: 'قراردادي "{name}" {amt} پوروړی دی{more}.',
  },
  supplierDebtTitle: {
    en: 'Supplier balance due: {name}',
    fa: 'باقی‌داری تأمین‌کننده: {name}',
    ps: 'د عرضه کوونکي پاتې حساب: {name}',
  },
  supplierDebtMsg: {
    en: 'Supplier "{name}" is owed {amt}{more}.',
    fa: 'تأمین‌کننده "{name}" مبلغ {amt} باقی‌داری دارد{more}.',
    ps: 'عرضه کوونکی "{name}" {amt} پوروړی دی{more}.',
  },
  missingDocTitle: {
    en: 'Missing bill/receipt: {amt}',
    fa: 'سند یا بل ناقص: {amt}',
    ps: 'ورک بل/رسید: {amt}',
  },
  missingDocMsg: {
    en: 'A {kind} of {amt} ({desc}) has no bill number or attached receipt{more}.',
    fa: 'یک {kind} به مبلغ {amt} ({desc}) فاقد شماره بل یا رسید ضمیمه است{more}.',
    ps: 'د {amt} ({desc}) یو {kind} د بل شمېرې یا رسید پرته دی{more}.',
  },
  expenseWord: { en: 'expense', fa: 'مصرف', ps: 'لګښت' },
  paymentWord: { en: 'payment', fa: 'پرداخت', ps: 'ورکړه' },
  inactiveTitle: {
    en: 'No activity in {p} for {d} days',
    fa: 'عدم فعالیت در {p} از {d} روز',
    ps: 'په {p} کې له {d} ورځو راهیسې فعالیت نشته',
  },
  inactiveMsg: {
    en: '{p} has recorded no expenses or payments for {d} days (last: {date}).',
    fa: '{p} از {d} روز هیچ مصرف یا پرداختی ثبت نکرده است (آخرین: {date}).',
    ps: '{p} له {d} ورځو راهیسې هېڅ لګښت یا ورکړه نه ده ثبت کړې (وروستی: {date}).',
  },
  budgetOverTitle: {
    en: 'Over budget: {line} ({pct}%)',
    fa: 'تجاوز از بودجه: {line} ({pct}٪)',
    ps: 'له بودجې اوښتل: {line} ({pct}٪)',
  },
  budgetOverMsg: {
    en: '{p}: "{line}" reached {pct}% of budget ({amt} over){more}.',
    fa: '{p}: «{line}» به {pct}٪ بودجه رسید ({amt} اضافه){more}.',
    ps: '{p}: «{line}» د بودجې {pct}٪ ته ورسېد ({amt} اضافه){more}.',
  },
};

const tr = (key: string, lang: ReminderLang, vars: Record<string, string | number> = {}): string => {
  let s: string = (T[key] && T[key][lang]) || T[key]?.en || key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
};

const DAY_MS = 86_400_000;

/** "HH:MM" window check; wraps midnight correctly. Invalid input ⇒ false (never mute). */
export function isQuietHours(now: Date, start: string, end: string): boolean {
  const parse = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const s = parse(start);
  const e = parse(end);
  if (s === null || e === null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}

/** Keep unread + fresh items; drop old read/dismissed; cap size (unread first). */
export function pruneNotifications(
  items: SystemReminderNotification[],
  now: Date = new Date(),
  maxItems = 150,
): SystemReminderNotification[] {
  const ageDays = (dateStr: string): number | null => {
    const t = new Date(`${dateStr}T00:00:00`).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor((now.getTime() - t) / DAY_MS);
  };
  const kept = items.filter(n => {
    if (!n.dismissed && !n.read) return true;
    const age = ageDays(n.date);
    if (age === null) return true; // unparsable date — keep rather than lose
    if (n.dismissed) return age <= 7;
    return age <= 30;
  });
  kept.sort((a, b) => {
    const au = !a.read && !a.dismissed ? 0 : 1;
    const bu = !b.read && !b.dismissed ? 0 : 1;
    if (au !== bu) return au - bu;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
  });
  return kept.slice(0, Math.max(0, maxItems));
}

export function generateSmartReminders(params: {
  apartments: ApartmentUnit[];
  expenses: Expense[];
  payments: Payment[];
  contractors: Contractor[];
  suppliers: Supplier[];
  documents: DocumentRecord[];
  projects: Project[];
  existingNotifications: SystemReminderNotification[];
  now?: Date;
  formatCurrency: (val: number, cur?: string) => string;
  projectBudgets?: ProjectBudget[];
  steelRecords?: SteelRecord[];
  concreteRecords?: ConcreteRecord[];
  lang?: ReminderLang;
  dueSoonDays?: number;
  inactivityDays?: number;
  enabledTypes?: NotificationType[];
}): SystemReminderNotification[] {
  const {
    apartments,
    expenses,
    payments,
    contractors,
    suppliers,
    documents,
    projects,
    existingNotifications,
    now = new Date(),
    formatCurrency,
    projectBudgets = [],
    steelRecords = [],
    concreteRecords = [],
    lang = 'en',
    dueSoonDays = 7,
    inactivityDays = 14,
    enabledTypes,
  } = params;

  const on = (t: NotificationType): boolean => !enabledTypes || enabledTypes.includes(t);
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const newReminders: SystemReminderNotification[] = [];
  const existingKeys = new Set(existingNotifications.map(n => n.reminderKey));
  const push = (n: SystemReminderNotification): void => {
    if (!existingKeys.has(n.reminderKey)) {
      existingKeys.add(n.reminderKey);
      newReminders.push(n);
    }
  };
  const projName = (projectId?: string): string => {
    const p = projects.find(x => x.id === projectId);
    return p?.name || tr('projectWord', lang);
  };
  const more = (count: number): string => (count > 1 ? tr('moreWord', lang, { n: count - 1 }) : '');
  const usdOf = (amount: number, currency?: string, rate?: number): number => {
    const r = rate && rate > 0 ? rate : 70;
    return currency === 'AFN' ? amount / r : amount;
  };

  // Documents linked to an expense/payment count as attached bills.
  const linkedDocIds = new Set(
    documents
      .filter(d => d.relatedType === 'expense' || d.relatedType === 'payment' || d.relatedType === 'bill')
      .map(d => d.relatedId)
      .filter((x): x is string => !!x),
  );

  // --- 1. OVERDUE INSTALLMENTS (P1) — daily, max 4 ---
  if (on('installment_overdue')) {
    const found: Array<{ inst: InstallmentRecord; apt: ApartmentUnit; daysOverdue: number }> = [];
    for (const apt of apartments) {
      for (const inst of normalizeApartmentInstallments(apt, now)) {
        if (inst.status === 'Overdue' && inst.remainingAmount > 0) {
          found.push({ inst, apt, daysOverdue: Math.max(1, getDaysDifference(inst.dueDate, now)) });
        }
      }
    }
    found.sort((a, b) => b.daysOverdue - a.daysOverdue || b.inst.remainingAmount - a.inst.remainingAmount);
    found.slice(0, 4).forEach((item, i) => {
      const cur = item.inst.currency || item.apt.currency || 'USD';
      const buyer = item.inst.buyerName || item.apt.buyerName || tr('buyerWord', lang);
      const aptNum = item.inst.apartmentNumber || item.apt.unitNumber;
      push({
        id: `rem-overdue-${item.inst.id}-${Date.now()}-${i}`,
        reminderKey: `inst-overdue-${item.inst.id}-${todayStr}`,
        projectId: item.apt.projectId,
        projectName: projName(item.apt.projectId),
        apartmentId: item.apt.id,
        apartmentNumber: aptNum,
        installmentId: item.inst.id,
        installmentNumber: item.inst.installmentNumber,
        type: 'installment_overdue',
        title: `⚠️ ${tr('overdueTitle', lang, { n: item.inst.installmentNumber, u: aptNum })}`,
        message: tr('overdueMsg', lang, {
          n: item.inst.installmentNumber, u: aptNum, b: buyer,
          amt: formatCurrency(item.inst.remainingAmount, cur), d: item.daysOverdue,
        }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 1,
        actionTab: 'apartments',
        actionPayload: { apartmentId: item.apt.id, installmentId: item.inst.id },
      });
    });
  }

  // --- 2. DUE-SOON INSTALLMENTS (P2) — daily inside window, max 4 ---
  if (on('installment_due_soon')) {
    const found: Array<{ inst: InstallmentRecord; apt: ApartmentUnit; daysLeft: number }> = [];
    for (const apt of apartments) {
      for (const inst of normalizeApartmentInstallments(apt, now)) {
        if ((inst.status === 'Pending' || inst.status === 'Partially Paid' || inst.status === 'Due') && inst.remainingAmount > 0) {
          const daysLeft = -getDaysDifference(inst.dueDate, now);
          if (daysLeft >= 0 && daysLeft <= Math.max(1, dueSoonDays)) {
            found.push({ inst, apt, daysLeft });
          }
        }
      }
    }
    found.sort((a, b) => a.daysLeft - b.daysLeft);
    found.slice(0, 4).forEach((item, i) => {
      const cur = item.inst.currency || item.apt.currency || 'USD';
      const buyer = item.inst.buyerName || item.apt.buyerName || tr('buyerWord', lang);
      const aptNum = item.inst.apartmentNumber || item.apt.unitNumber;
      const when = item.daysLeft === 0
        ? tr('todayWord', lang)
        : tr('daysLeftWord', lang, { d: item.daysLeft });
      push({
        id: `rem-duesoon-${item.inst.id}-${Date.now()}-${i}`,
        reminderKey: `inst-duesoon-${item.inst.id}-${todayStr}`,
        projectId: item.apt.projectId,
        projectName: projName(item.apt.projectId),
        apartmentId: item.apt.id,
        apartmentNumber: aptNum,
        installmentId: item.inst.id,
        installmentNumber: item.inst.installmentNumber,
        type: 'installment_due_soon',
        title: `🗓️ ${tr('dueSoonTitle', lang, { n: item.inst.installmentNumber, u: aptNum, when })}`,
        message: tr('dueSoonMsg', lang, {
          n: item.inst.installmentNumber, u: aptNum, b: buyer,
          amt: formatCurrency(item.inst.remainingAmount, cur), date: item.inst.dueDate, when,
        }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 2,
        actionTab: 'apartments',
        actionPayload: { apartmentId: item.apt.id, installmentId: item.inst.id },
      });
    });
  }

  // --- 3. INSTALLMENT FULLY PAID (P7) — info, paid within last 7 days, max 4 ---
  if (on('installment_paid')) {
    const found: Array<{ inst: InstallmentRecord; apt: ApartmentUnit; paidDate: string }> = [];
    for (const apt of apartments) {
      for (const inst of normalizeApartmentInstallments(apt, now)) {
        if (inst.status !== 'Paid' || inst.remainingAmount > 0) continue;
        const dates = (inst.paymentHistory || []).map(p => p.date).filter(Boolean).sort();
        const last = dates[dates.length - 1] || inst.receivedDate || '';
        const age = last ? Math.floor((now.getTime() - new Date(`${last}T00:00:00`).getTime()) / DAY_MS) : 999;
        if (last && age >= 0 && age <= 7) found.push({ inst, apt, paidDate: last });
      }
    }
    found.sort((a, b) => b.paidDate.localeCompare(a.paidDate));
    found.slice(0, 4).forEach((item, i) => {
      const buyer = item.inst.buyerName || item.apt.buyerName || tr('buyerWord', lang);
      const aptNum = item.inst.apartmentNumber || item.apt.unitNumber;
      push({
        id: `rem-paid-${item.inst.id}-${Date.now()}-${i}`,
        reminderKey: `inst-paid-${item.inst.id}`,
        projectId: item.apt.projectId,
        projectName: projName(item.apt.projectId),
        apartmentId: item.apt.id,
        apartmentNumber: aptNum,
        installmentId: item.inst.id,
        installmentNumber: item.inst.installmentNumber,
        type: 'installment_paid',
        title: `✅ ${tr('paidTitle', lang, { n: item.inst.installmentNumber, u: aptNum })}`,
        message: tr('paidMsg', lang, { n: item.inst.installmentNumber, u: aptNum, b: buyer, date: item.paidDate }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 7,
        actionTab: 'apartments',
        actionPayload: { apartmentId: item.apt.id, installmentId: item.inst.id },
      });
    });
  }

  // --- 4. UNPAID PURCHASES (P3) — top-1 + overflow count ---
  if (on('unpaid_purchase')) {
    const unpaid = expenses
      .filter(e => isCountedDoc(e) && ((e.remainingAmount || 0) > 0 || e.paymentStatus === 'unpaid'))
      .sort((a, b) => (b.remainingAmount ?? b.amount) - (a.remainingAmount ?? a.amount));
    if (unpaid.length > 0) {
      const top = unpaid[0];
      const rem = top.remainingAmount ?? top.amount;
      const desc = top.description || top.item || tr('expenseWord', lang);
      push({
        id: `rem-unpaid-exp-${top.id}-${Date.now()}`,
        reminderKey: `unpaid-exp-${top.id}-${todayStr}`,
        projectId: top.projectId,
        projectName: projName(top.projectId),
        expenseId: top.id,
        type: 'unpaid_purchase',
        title: `🧾 ${tr('unpaidTitle', lang, { desc })}`,
        message: tr('unpaidMsg', lang, {
          desc, amt: formatCurrency(rem, top.currency || 'USD'), more: more(unpaid.length),
        }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 3,
        actionTab: 'expenses',
        actionPayload: { expenseId: top.id },
      });
    }
  }

  // --- 5a. CONTRACTOR DEBT (P4) — top-1 + count ---
  if (on('outstanding_debt')) {
    const withDebt = contractors
      .map(c => ({
        c,
        remaining: Math.max(0, c.remainingBalance ?? (c.contractAmount - (c.totalPaid || 0))),
      }))
      .filter(x => x.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
    if (withDebt.length > 0) {
      const top = withDebt[0];
      push({
        id: `rem-cont-debt-${top.c.id}-${Date.now()}`,
        reminderKey: `cont-debt-${top.c.id}-${todayStr}`,
        projectId: top.c.projectId,
        projectName: projName(top.c.projectId),
        type: 'outstanding_debt',
        title: `👷 ${tr('contractorDebtTitle', lang, { name: top.c.name })}`,
        message: tr('contractorDebtMsg', lang, {
          name: top.c.name,
          amt: formatCurrency(top.remaining, top.c.currency || 'USD'),
          more: more(withDebt.length),
        }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 4,
        actionTab: 'contractors',
        actionPayload: { contractorId: top.c.id },
      });
    }

    // --- 5b. SUPPLIER DEBT (P4) — top-1 + count ---
    const suppDebt = suppliers
      .map(s => ({
        s,
        remaining: Math.max(0, s.remainingBalance ?? ((s.totalPurchases || 0) - (s.totalPaid || 0))),
      }))
      .filter(x => x.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
    if (suppDebt.length > 0) {
      const top = suppDebt[0];
      push({
        id: `rem-supp-debt-${top.s.id}-${Date.now()}`,
        reminderKey: `supp-debt-${top.s.id}-${todayStr}`,
        projectId: top.s.projectId,
        projectName: projName(top.s.projectId),
        type: 'outstanding_debt',
        title: `🏭 ${tr('supplierDebtTitle', lang, { name: top.s.name })}`,
        message: tr('supplierDebtMsg', lang, {
          name: top.s.name,
          amt: formatCurrency(top.remaining, top.s.currency || 'USD'),
          more: more(suppDebt.length),
        }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 4,
        actionTab: 'suppliers',
        actionPayload: { supplierId: top.s.id },
      });
    }
  }

  // --- 6. MISSING DOCUMENTS (P6) — USD-normalized ≥ $500, expenses + payments ---
  if (on('missing_document')) {
    const MISSING_USD_THRESHOLD = 500;
    const bareExpenses = expenses
      .filter(e => isCountedDoc(e) && !e.billNumber && !e.documentUrl && !e.receiptUrl && !(e.attachments && e.attachments.length > 0) && !linkedDocIds.has(e.id))
      .map(e => ({ e, usd: e.amountInUSD ?? usdOf(e.amount, e.currency, e.exchangeRate) }))
      .filter(x => x.usd >= MISSING_USD_THRESHOLD)
      .sort((a, b) => b.usd - a.usd);
    if (bareExpenses.length > 0) {
      const top = bareExpenses[0];
      push({
        id: `rem-missing-exp-${top.e.id}-${Date.now()}`,
        reminderKey: `missing-exp-${top.e.id}-${todayStr}`,
        projectId: top.e.projectId,
        projectName: projName(top.e.projectId),
        expenseId: top.e.id,
        type: 'missing_document',
        title: `📎 ${tr('missingDocTitle', lang, { amt: formatCurrency(top.e.amount, top.e.currency || 'USD') })}`,
        message: tr('missingDocMsg', lang, {
          kind: tr('expenseWord', lang),
          amt: formatCurrency(top.e.amount, top.e.currency || 'USD'),
          desc: top.e.description || top.e.item || '',
          more: more(bareExpenses.length),
        }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 6,
        actionTab: 'expenses',
        actionPayload: { expenseId: top.e.id },
      });
    }
    const barePayments = payments
      .filter(p => !p.receiptNumber && !p.documentUrl && !linkedDocIds.has(p.id))
      .map(p => ({ p, usd: p.amountInUSD ?? usdOf(p.amount, p.currency, p.exchangeRate) }))
      .filter(x => x.usd >= MISSING_USD_THRESHOLD)
      .sort((a, b) => b.usd - a.usd);
    if (barePayments.length > 0) {
      const top = barePayments[0];
      push({
        id: `rem-missing-pay-${top.p.id}-${Date.now()}`,
        reminderKey: `missing-pay-${top.p.id}-${todayStr}`,
        projectId: top.p.projectId,
        projectName: projName(top.p.projectId),
        paymentId: top.p.id,
        type: 'missing_document',
        title: `📎 ${tr('missingDocTitle', lang, { amt: formatCurrency(top.p.amount, top.p.currency || 'USD') })}`,
        message: tr('missingDocMsg', lang, {
          kind: tr('paymentWord', lang),
          amt: formatCurrency(top.p.amount, top.p.currency || 'USD'),
          desc: top.p.description || top.p.partyName || '',
          more: more(barePayments.length),
        }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 6,
        actionTab: 'payments',
        actionPayload: { paymentId: top.p.id },
      });
    }
  }

  // --- 7. PROJECT INACTIVITY (P5) — active projects silent too long, max 5 ---
  if (on('project_inactivity')) {
    const lastActivity = new Map<string, string>();
    const consider = (projectId: string, dateStr: string): void => {
      if (!projectId || !dateStr) return;
      const prev = lastActivity.get(projectId);
      if (!prev || dateStr > prev) lastActivity.set(projectId, dateStr);
    };
    for (const e of expenses) consider(e.projectId, e.date);
    for (const p of payments) consider(p.projectId, p.date);
    for (const s of steelRecords) consider(s.projectId, s.date);
    for (const c of concreteRecords) consider(c.projectId, c.date);
    const stale: Array<{ p: Project; last: string; days: number }> = [];
    for (const p of projects) {
      if (p.status === 'completed') continue;
      const last = lastActivity.get(p.id);
      if (!last) continue; // brand-new project with no activity yet — not stale
      const days = Math.floor((now.getTime() - new Date(`${last}T00:00:00`).getTime()) / DAY_MS);
      if (days > Math.max(1, inactivityDays)) stale.push({ p, last, days });
    }
    stale.sort((a, b) => b.days - a.days);
    stale.slice(0, 5).forEach((item, i) => {
      push({
        id: `rem-inactive-${item.p.id}-${Date.now()}-${i}`,
        reminderKey: `inactive-${item.p.id}-${todayStr}`,
        projectId: item.p.id,
        projectName: item.p.name,
        type: 'project_inactivity',
        title: `😴 ${tr('inactiveTitle', lang, { p: item.p.name, d: item.days })}`,
        message: tr('inactiveMsg', lang, { p: item.p.name, d: item.days, date: item.last }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 5,
        actionTab: 'projects',
        actionPayload: { projectId: item.p.id },
      });
    });
  }

  // --- 8. BUDGET OVERRUN (P3) — lines at/over 100% ---
  if (on('general_financial') && projectBudgets.length > 0) {
    for (const p of projects) {
      const rows = computeBudgetReport({
        projectId: p.id,
        budgets: projectBudgets.filter(b => b.projectId === p.id),
        expenses,
        steelRecords,
        concreteRecords,
      });
      const over = rows
        .filter(r => r.hasBudget && (r.usagePct ?? 0) >= 100)
        .sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0));
      if (over.length === 0) continue;
      const worst = over[0];
      const pct = Math.round(worst.usagePct ?? 100);
      const lineName = lang === 'fa' ? worst.nameFa : lang === 'ps' ? worst.namePs : worst.nameEn;
      push({
        id: `rem-budget-${p.id}-${Date.now()}`,
        reminderKey: `budget-over-${p.id}-${todayStr}`,
        projectId: p.id,
        projectName: p.name,
        type: 'general_financial',
        title: `💸 ${tr('budgetOverTitle', lang, { line: lineName, pct })}`,
        message: tr('budgetOverMsg', lang, {
          p: p.name, line: lineName, pct,
          amt: formatCurrency(Math.abs(worst.remainingUSD), 'USD'),
          more: more(over.length),
        }),
        date: todayStr, time: timeStr, read: false, dismissed: false, priority: 3,
        actionTab: 'budget',
        actionPayload: { projectId: p.id },
      });
    }
  }

  return newReminders;
}
