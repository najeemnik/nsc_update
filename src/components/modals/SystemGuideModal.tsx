import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  Building2, 
  Receipt, 
  CreditCard, 
  HardHat, 
  BarChart3, 
  Camera, 
  ArrowRightLeft, 
  CheckCircle2, 
  Printer, 
  ChevronRight,
  ShieldCheck,
  PhoneCall,
  Search,
  ExternalLink,
  Users,
  Smartphone
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SystemGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideTopic {
  id: string;
  icon: any;
  color: string;
  title: string;
  badge: string;
  /** app tabs this topic belongs to — a user sees it only with access to one */
  tabs?: string[];
  /** shown to everybody (login / PWA / offline help) */
  always?: boolean;
  /** Office7 master only */
  masterOnly?: boolean;
}

export const SystemGuideModal: React.FC<SystemGuideModalProps> = ({ isOpen, onClose }) => {
  const { language, tp, currentUser, isTabAllowed } = useApp();

  const isRtl = language === 'fa' || language === 'ps';

  const topics: GuideTopic[] = [
    {
      id: 'project' as const,
      icon: Building2,
      color: 'text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400',
      title: language === 'ps' ? '۱. پیل او پروژه' : tp('1. Project Setup', '۱. تعریف و تنظیم پروژه', '۱. د پروژې تعریف او برابرول'),
      badge: language === 'ps' ? 'بنسټ' : tp('Foundation', 'اساسی', 'بنسټیز'),
      tabs: ['projects', 'dashboard'],
    },
    {
      id: 'expense' as const,
      icon: Receipt,
      color: 'text-blue-700 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400',
      title: language === 'ps' ? '۲. لګښتونه او توکي' : tp('2. Recording Expenses', '۲. ثبت مصارف و مواد', '۲. د مصارفو او موادو ثبت'),
      badge: language === 'ps' ? 'لګښتونه' : tp('Daily Costs', 'مصارف', 'مصارف'),
      tabs: ['expenses', 'steel', 'concrete'],
    },
    {
      id: 'payment' as const,
      icon: CreditCard,
      color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400',
      title: language === 'ps' ? '۳. رسیدونه او پیسې' : tp('3. Payments & Receipts', '۳. پرداخت‌ها و اسناد رسمی', '۳. تادیې او رسمي سندونه'),
      badge: language === 'ps' ? 'سندونه' : tp('Vouchers', 'رسید A4', 'A4 رسېد'),
      tabs: ['payments', 'apartments'],
    },
    {
      id: 'contractor' as const,
      icon: HardHat,
      color: 'text-purple-700 bg-purple-100 dark:bg-purple-950/60 dark:text-purple-400',
      title: language === 'ps' ? '۴. قراردادیان' : tp('4. Contractors & Staff', '۴. قراردادی‌ها و شرکا', '۴. قراردادیان او شریکان'),
      badge: language === 'ps' ? 'حساب' : tp('Ledger', 'حسابداری', 'محاسبه'),
      tabs: ['contractors', 'labor', 'suppliers'],
    },
    {
      id: 'report' as const,
      icon: BarChart3,
      color: 'text-rose-700 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-400',
      title: language === 'ps' ? '۵. مالي راپورونه' : tp('5. Financial Reports', '۵. راپورهای مالی A4', '۵. A4 مالي راپورونه'),
      badge: language === 'ps' ? 'راپور' : tp('Auditing', 'حسابرسی', 'پلټنه'),
      tabs: ['reports', 'accounting', 'budget'],
    },
    {
      id: 'bills' as const,
      icon: Camera,
      color: 'text-amber-800 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300',
      title: language === 'ps' ? '۶. د بلونو آرشیف' : tp('6. Bills & Camera Archive', '۶. کمره و آرشیف بل‌ها', '۶. کمره او د بلونو ارشیف'),
      badge: language === 'ps' ? 'کمره' : tp('Paperless', 'بدون کاغذ', 'بې کاغذه'),
      tabs: ['documents', 'expenses'],
    },
    {
      id: 'gdrive' as const,
      icon: ExternalLink,
      color: 'text-sky-700 bg-sky-100 dark:bg-sky-950/60 dark:text-sky-400',
      title: language === 'ps' ? '۷. ګوګل ډرایو' : tp('7. Google Drive Integration', '۷. همگام‌سازی Google Drive', '۷. له Google Drive سره همغږي'),
      badge: language === 'ps' ? 'ډرایو' : tp('Cloud', 'ابری', 'ورېځ'),
      tabs: ['documents', 'settings'],
    },
    {
      id: 'users' as const,
      icon: Users,
      color: 'text-indigo-700 bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400',
      title: tp('8. Staff & Multi-Device Login', '۸. کارمندان و ورود چنددستگاهی', '۸. کارکوونکي او څو-دستګا ننوتل'),
      badge: tp('Team', 'تیم', 'ټیم'),
      tabs: ['users'],
    },
    {
      id: 'app' as const,
      icon: Smartphone,
      color: 'text-cyan-700 bg-cyan-100 dark:bg-cyan-950/60 dark:text-cyan-400',
      title: tp('9. Account, PWA & Offline', '۹. حساب، نصب و کار آفلاین', '۹. حساب، نصب او آفلاین کار'),
      badge: tp('Mobile', 'موبایل', 'موبایل'),
      always: true,
    },
    {
      id: 'master' as const,
      icon: ShieldCheck,
      color: 'text-slate-700 bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
      title: tp('10. Office7 & Security', '۱۰. دفتر هفت و امنیت', '۱۰. دفتر اووه او امنیت'),
      badge: tp('Master', 'ارشد', 'مشر'),
      masterOnly: true,
    },
  ];

  // Wave 40: owners see every topic; each user sees only the topics that
  // match their own permissions (plus the general account/offline help).
  const isOwner = currentUser?.role === 'admin' || !!currentUser?.isMasterSuperAdmin;
  const visibleTopics = topics.filter(t =>
    t.masterOnly
      ? !!currentUser?.isMasterSuperAdmin
      : t.always || isOwner
        ? true
        : (t.tabs || []).some(tab => { try { return isTabAllowed(tab); } catch { return false; } })
  );
  const [activeTopic, setActiveTopic] = useState<string>(visibleTopics[0]?.id || 'app');
  const safeActive = visibleTopics.some(t => t.id === activeTopic) ? activeTopic : (visibleTopics[0]?.id || 'app');

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
    >
      <div 
        className="bg-surface w-full max-w-4xl rounded-3xl shadow-2xl border border-line overflow-hidden my-auto max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-black shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="guide-title" className="text-lg sm:text-xl font-black tracking-tight">
                {language === 'ps' 
                  ? 'د نیک سمارټ کاونټ د سیسټم لارښود' 
                  : tp('Nik Smart Count System User Guide', 'راهنمای جامع کاربری و محاسبات NIK SMART COUNT', 'د NIK SMART COUNT هراړخیز کارونکي او محاسبې لارښود')}
              </h2>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                {language === 'ps' 
                  ? 'د ودانیو خاوندانو او انجینرانو لپاره واضح لارښوونې' 
                  : tp('Clear operational instructions for building owners and site engineers', 'دستورالعمل‌های دقیق کاری ویژه مالکان ساختمان و انجینران', 'د ودانیو د خاوندانو او انجینرانو لپاره کره کاري لارښوونې')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="بستن (Esc)"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Container: Sidebar Topics + Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Navigation Topics */}
          <div className="w-full md:w-72 bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-4 border-b md:border-b-0 md:border-e border-line overflow-y-auto shrink-0 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-2">
              {language === 'ps' ? 'د سیستم موضوعات' : tp('System Topics', 'سرفصل‌های آموزشی', 'ښوونیز سرټکي')}
            </div>
            {visibleTopics.map((t) => {
              const Icon = t.icon;
              const isActive = safeActive === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTopic(t.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition-all text-start ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 rtl:space-x-reverse min-w-0">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20 text-white' : t.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="truncate">{t.title}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {t.badge}
                  </span>
                </button>
              );
            })}

            {/* Quick Contact Box */}
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs space-y-1.5">
              <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>پشتیبانی احمد نجیم نیک:</span>
              </div>
              <div className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs dir-ltr text-end">
                +93 783 788 278
              </div>
            </div>
          </div>

          {/* Topic Detail View */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800 dark:text-slate-200 leading-relaxed text-sm">
            {safeActive === 'project' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-600" />
                    <span>نحوه ثبت و سوئیچ بین پروژه‌های ساختمانی</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">مدیریت همزمان چندین برج و ساختمان با دفاتر حسابداری تفکیک‌شده</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-line">
                    <div className="font-bold text-ink flex items-center gap-1.5 mb-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>ثبت مشخصات عمرانی</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">تعداد منازل، تعداد واحدها، زیربنا، آدرس و مشخصات سند زمین را با دقت وارد فرمایید تا تمام شاخص‌ها اتوماتیک محاسبه شود.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-line">
                    <div className="font-bold text-ink flex items-center gap-1.5 mb-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                      <span>نرخ برابری اسعار (دالر / افغانی)</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">برای هر پروژه نرخ پایه صرافی (مثلاً ۷۰) را تعیین کنید تا هر زمان مصرفی به افغانی ثبت شد، معادل دالری آن دقیق سنجیده شود.</p>
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'expense' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-blue-600" />
                    <span>ثبت خریدها، مصارف روزمره و تسویه‌حساب</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">اصل حسابداری ساختمانی: هر خرید ثبت تعهد مالی (بدهی) است، مگر آنکه نقداً پرداخت شود.</p>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-2/60 border border-line">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0">۱</span>
                    <div>
                      <strong className="block font-bold text-ink mb-0.5">ثبت جنس و مقدار (سیخ، سمنت، چوب):</strong>
                      <span className="text-slate-600 dark:text-slate-400">مقدار و قیمت فی واحد را بنویسید؛ سیستم مبلغ کل را ضرب نموده و تبدیل واحدهای استاندارد (مانند تن به کیلوگرام) را محاسبه می‌کند.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-black flex items-center justify-center shrink-0">۲</span>
                    <div>
                      <strong className="block font-bold text-amber-900 dark:text-amber-200 mb-0.5">تبدیل نرخ اسعار (دالر به افغانی):</strong>
                      <span className="text-amber-800 dark:text-amber-300">با دکمه تبدیل اسعار می‌توانید هر نرخ دلخواه روز را وارد نمایید.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'payment' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    <span>پرداخت‌ها، کسر از قرضداری و چاپ سند A4</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">صدور سند رسمی رسید و پرداخت جهت ارائه به شرکا یا بایگانی</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-line">
                    <div className="font-bold text-ink flex items-center gap-1.5 mb-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span>کسر اتوماتیک از قرضداری</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">هنگامی که به یک فروشنده پول پرداخت می‌کنید، از منوی طلبکاران او را انتخاب کنید تا مستقیماً از باقیمانده طلب او کسر شود.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                    <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 mb-1.5">
                      <Printer className="w-4 h-4 text-emerald-700" />
                      <span>چاپ سند استاندارد A4</span>
                    </div>
                    <p className="text-emerald-800 dark:text-emerald-300">برای هر پرداخت، یک سند رسمی با سربرگ شرکت، لوگو و ۳ امضا آماده چاپ با پرینتر تولید می‌شود.</p>
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'contractor' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <HardHat className="w-5 h-5 text-purple-600" />
                    <span>قراردادی‌ها، ضمانت حسن نیت و شرکای پروژه</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">مدیریت مبالغ قرارداد، پیشرفت کار و ثبت سرمایه‌گذاری شرکا</p>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="p-3 bg-surface-2/60 rounded-2xl border border-line">
                    <strong className="text-ink block font-bold mb-1">ضمانت حسن نیت (Retention):</strong>
                    می‌توانید برای هر قراردادی درصد مشخصی (مثلاً ۵٪ یا ۱۰٪) جهت ضمانت پایان کار نگهداری کنید.
                  </div>
                  <div className="p-3 bg-surface-2/60 rounded-2xl border border-line">
                    <strong className="text-ink block font-bold mb-1">دفتر روزنامچه حساب (Ledger):</strong>
                    کل مبالغ قرارداد به علاوه پرداختی‌های انجام شده به تفکیک تاریخ و سند نمایش داده می‌شود.
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'report' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-rose-600" />
                    <span>راپورهای چاپی و خروجی اکسل</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">تولید بیلان کامل مالی در قطع A4 و فایل CSV/Excel</p>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl">
                    <strong className="text-rose-900 dark:text-rose-200 block font-bold mb-1">تفکیک دالر و افغانی:</strong>
                    تمام راپورها دارای تفکیک دقیق مبالغ به هر دو اسعار دالر و افغانی به همراه تراز نهایی می‌باشند.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-surface-2/60 border border-line">
                      <strong className="text-ink block font-bold mb-1">خروجی اکسل (CSV):</strong>
                      با یک کلیک تمام ردیف‌ها همراه با سربرگ استاندارد برای اکسل آماده دانلود است.
                    </div>
                    <div className="p-3 rounded-2xl bg-surface-2/60 border border-line">
                      <strong className="text-ink block font-bold mb-1">امضای هیئت مدیره:</strong>
                      پایین هر برگه شامل سه محل امضا برای محاسب، مهندس ناظر و رئیس شرکت است.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'bills' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <Camera className="w-5 h-5 text-amber-600" />
                    <span>عکس‌برداری با کمره و آرشیف بل‌ها</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">حذف کاغذبازی با مستندسازی تصویری از قبض باسکول و بل‌ها</p>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-surface-2/60 border border-line rounded-2xl">
                    <strong className="text-ink block font-bold mb-1">کمره مستقیم موبایل:</strong>
                    در هر زمان با زدن آیکون کمره می‌توانید بل خرید آهن یا کانکریت را در همان محل پروژه عکس گرفته و پیوست کنید.
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'gdrive' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-sky-600" />
                    <span>همگام‌سازی و پشتیبان‌گیری در Google Drive</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">ذخیره امن تمام دیتای مالی و اسناد ساختمانی در حساب گوگل درایو شرکت</p>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-2xl">
                    <strong className="text-sky-900 dark:text-sky-200 block font-bold mb-1">پشتیبان‌گیری ابری اتومات:</strong>
                    دیتابیس کامل سیستم شامل پروژه‌ها، خریدهای سیخ، کانکریت و اسناد در پوشه "NIK SMART COUNT" در گوگل درایو شخصی شما ذخیره می‌شود.
                  </div>
                  <div className="p-3.5 bg-surface-2/60 border border-line rounded-2xl">
                    <strong className="text-ink block font-bold mb-1">دسترسی از همه جا:</strong>
                    با اتصال گوگل درایو، تمام بل‌ها و تصاویر در هر دستگاه با لینک مستقیم قابل مشاهده خواهند بود.
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'users' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <span>ساخت کارمند و ورود با یک حساب در همه دستگاه‌ها</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">مالک از بخش کارمندان حساب می‌سازد؛ همان نام کاربری و رمز در کمپیوتر و موبایل کار می‌کند</p>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-2/60 border border-line">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center shrink-0">۱</span>
                    <div>
                      <strong className="block font-bold text-ink mb-0.5">ساخت حساب توسط مالک:</strong>
                      <span className="text-slate-600 dark:text-slate-400">از «مدیریت کارمندان» حساب بسازید، نقش (ادمین/حسابدار/بیننده) و دسترسی تب‌ها را تعیین کنید. حساب فوراً در سرور ذخیره می‌شود — اگر آفلاین بودید، با وصل شدن اینترنت خودکار ارسال می‌شود.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-2/60 border border-line">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center shrink-0">۲</span>
                    <div>
                      <strong className="block font-bold text-ink mb-0.5">ورود در دستگاه دیگر:</strong>
                      <span className="text-slate-600 dark:text-slate-400">کارمند در موبایل یا کمپیوتر دیگر با همان نام کاربری و رمز وارد می‌شود (اولین ورود به اینترنت نیاز دارد؛ بعدش آفلاین هم کار می‌کند).</span>
                    </div>
                  </div>
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl">
                    <strong className="text-rose-900 dark:text-rose-200 block font-bold mb-1">غیرفعال به‌جای حذف:</strong>
                    برای قطع دسترسی، حساب را «غیرفعال» کنید تا در همه دستگاه‌ها فوراً قفل شود. حذف کامل فقط وقتی لازم است که حساب دیگر هیچ‌وقت برنگردد.
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'app' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-cyan-600" />
                    <span>نصب برنامه، ورود و کار بدون اینترنت</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">یک‌بار نصب کنید؛ بعد با کلیک روی آیکون حتی آفلاین وارد شوید</p>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-surface-2/60 border border-line rounded-2xl">
                    <strong className="text-ink block font-bold mb-1">«مرا به خاطر بسپار»:</strong>
                    بدون تیک، ورود فقط تا بسته شدن تب زنده است. با تیک، در همان دستگاه وارد می‌مانید. در نسخه نصب‌شده این گزینه پیش‌فرض روشن است.
                  </div>
                  <div className="p-3.5 bg-surface-2/60 border border-line rounded-2xl">
                    <strong className="text-ink block font-bold mb-1">نصب (PWA):</strong>
                    از منوی براوزر گزینه Install / «افزودن به صفحه اصلی» را بزنید تا آیکون NIK SMART COUNT ساخته شود. با آن آیکون، برنامه بدون اینترنت هم باز می‌شود و با دیتای همان دستگاه کار می‌کند.
                  </div>
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl">
                    <strong className="text-amber-900 dark:text-amber-200 block font-bold mb-1">دستگاه جدید:</strong>
                    اگر در دستگاه جدید حسابی پیدا نشد، صفحه ورود دکمه «بازیابی بکاپ مالک» نشان می‌دهد — فایل بکاپ (JSON) را بدهید تا همه‌چیز برگردد.
                  </div>
                </div>
              </div>
            )}

            {safeActive === 'master' && (
              <div className="space-y-4">
                <div className="border-b border-line pb-3">
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-slate-600" />
                    <span>دفتر هفت: مهر نصب، بیلدر و امنیت</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">این بخش فقط برای مدیر ارشد نمایش داده می‌شود</p>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-surface-2/60 border border-line rounded-2xl">
                    <strong className="text-ink block font-bold mb-1">مهر نصب (یک دفتر در هر دامنه):</strong>
                    از دفتر هفت ← امنیت، با «کلید نصب» نصب را مهر کنید تا هیچ‌وقت دفتر دوم ساخته نشود. مهر زدنِ دوباره، حساب مالک را هم در سرور تازه می‌کند تا ورود چنددستگاهی فعال بماند.
                  </div>
                  <div className="p-3.5 bg-surface-2/60 border border-line rounded-2xl">
                    <strong className="text-ink block font-bold mb-1">بیلدر تصویری:</strong>
                    فقط داخل دفتر هفت (تب داشبورد ← دکمه «بیلدر تصویری») است؛ هیچ مالک و کارمندی آن را نمی‌بیند و قابل اعطا هم نیست.
                  </div>
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl">
                    <strong className="text-rose-900 dark:text-rose-200 block font-bold mb-1">ریست کارخانه:</strong>
                    اول بکاپ JSON دانلود می‌کند، بعد همه‌چیز را پاک می‌کند. نسخه تست دست‌نخورده می‌ماند.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-2/80 border-t border-line flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            سامانه هوشمند محاسبات ساختمانی نیک (NIK SMART COUNT)
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold shadow-xs transition-colors"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
};
