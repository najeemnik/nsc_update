import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { backendApi } from '../services/backendApi';
import { 
  Building2,
  Lock, 
  Mail, 
  Phone, 
  User as UserIcon, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  KeyRound, 
  ShieldCheck, 
  Briefcase, 
  MapPin, 
  MessageCircle, 
  Send, 
  Linkedin, 
  Layers, 
  CircleDot, 
  Receipt, 
  Home, 
  Sparkles,
  AlertCircle,
  HardHat,
  Bot,
  BarChart3,
  Calendar,
  Check,
  ChevronRight,
  ChevronLeft,
  Copy,
  Flame,
  Award,
  Sun,
  Moon,
  FlaskConical,
  Upload
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const {
    login,
    users,
    importBackupJSON,
    requestPasswordReset,
    completePasswordReset,
    language, tp, 
    setLanguage, 
    t,
    appSettings,
    themeSchedule,
    cycleThemeSchedule,
    authNotice,
    clearAuthNotice,
    enterTestMode
  } = useApp();

  const [authMode, setAuthMode] = useState<'login' | 'forgot_password' | 'reset_otp'>('login');
  const [currentSlide, setCurrentSlide] = useState(0);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState<boolean>(() =>
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  // Wave 44: visible server link — the same indicator on laptop AND mobile.
  const [serverPing, setServerPing] = useState<'checking' | 'ok' | 'outdated' | 'down'>('checking');
  const checkServer = () => {
    setServerPing('checking');
    backendApi.pingServer().then((p) => {
      setServerPing(p.ok ? 'ok' : (p.status === 0 || p.status >= 500 ? 'down' : 'outdated'));
    }).catch(() => setServerPing('down'));
  };
  useEffect(() => { checkServer(); }, []);

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importBackupJSON(json);
        setRestoreMsg(tp('Backup restored — now sign in with your account.', 'بکاپ بازیابی شد — حالا با حساب خود وارد شوید.', 'بکاپ بېرته وګرځېد — اوس له خپل حساب سره ننوځئ.'));
      } catch {
        setRestoreMsg(tp('Invalid backup file.', 'فایل بکاپ معتبر نیست.', 'د بکاپ فایل سم نه دی.'));
      }
      setTimeout(() => setRestoreMsg(null), 6000);
    };
    reader.readAsText(file);
  };

  const [pendingEmail, setPendingEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [simulatedOtpNotice, setSimulatedOtpNotice] = useState<string | null>(null);

  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 5);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const featureSlides = [
    {
      id: 0,
      title: t.slideRebarTitle,
      desc: t.slideRebarDesc,
      icon: Layers,
      color: 'from-amber-500/25 to-orange-500/25 text-amber-300 border-amber-500/40',
      badge: 'STEEL / REBAR',
      statLabel: t.tons,
      statValue: '124.50 Tn',
      detail1: 'سایزهای ۱۲ الی ۳۲ ملی',
      detail2: t.formulaSteelTons,
    },
    {
      id: 1,
      title: t.slideConcreteTitle,
      desc: t.slideConcreteDesc,
      icon: CircleDot,
      color: 'from-emerald-500/25 to-teal-500/25 text-emerald-300 border-emerald-500/40',
      badge: 'CONCRETE & PUMP',
      statLabel: 'Ready-Mix Volume',
      statValue: '480 m³',
      detail1: '14 Mixer Trucks',
      detail2: 'Slump: 120mm • 350 kg/cm²',
    },
    {
      id: 2,
      title: t.slideApartmentsTitle,
      desc: t.slideApartmentsDesc,
      icon: Home,
      color: 'from-blue-500/25 to-indigo-500/25 text-blue-300 border-blue-500/40',
      badge: 'APARTMENTS & SALES',
      statLabel: t.totalSales,
      statValue: '$1,250,000',
      detail1: '8 Units Contracted',
      detail2: t.apartmentsProtectedSubtitle,
    },
    {
      id: 3,
      title: t.slideFinancialsTitle,
      desc: t.slideFinancialsDesc,
      icon: HardHat,
      color: 'from-purple-500/25 to-pink-500/25 text-purple-300 border-purple-500/40',
      badge: 'CONTRACTORS & SUPPLIERS',
      statLabel: t.totalOutstanding,
      statValue: '$34,800',
      detail1: '100% Real-time Ledger',
      detail2: t.deductFromDebt,
    },
    {
      id: 4,
      title: t.slideAiTitle,
      desc: t.slideAiDesc,
      icon: Bot,
      color: 'from-cyan-500/25 to-sky-500/25 text-cyan-300 border-cyan-500/40',
      badge: 'PROJECT AI AGENT',
      statLabel: 'Civil Analysis',
      statValue: 'Instant Insights',
      detail1: 'Multi-lingual Intelligence',
      detail2: 'Automated Variance Forecasts',
    },
  ];

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    clearAuthNotice();
    setLoading(true);
    setTimeout(async () => {
      try {
        const result = await login(loginEmail, loginPassword, undefined, rememberMe);
        if (!result.success) {
          setErrorMessage(result.error || (language === 'en' ? 'Sign in failed. Please verify credentials.' : language === 'ps' ? 'ننوتل ناکام شول.' : 'نام کاربری یا رمز عبور اشتباه است.'));
        }
      } catch {
        setErrorMessage(language === 'en' ? 'Sign in failed. Please verify credentials.' : language === 'ps' ? 'ننوتل ناکام شول.' : 'نام کاربری یا رمز عبور اشتباه است.');
      }
      setLoading(false);
    }, 300);
  };



  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    setTimeout(() => {
      const result = requestPasswordReset(forgotEmail);
      if (!result.success) {
        setErrorMessage(result.error || (language === 'en' ? 'Email not found in records.' : language === 'ps' ? 'بریښنالیک ونه موندل شو.' : 'حسابی با این ایمیل یافت نشد.'));
        setLoading(false);
        return;
      }
      setPendingEmail(forgotEmail);
      setSimulatedOtpNotice(result.otpCode || '');
      setAuthMode('reset_otp');
      setSuccessMessage(`${t.otpSentNotice} ${forgotEmail}`);
      setLoading(false);
    }, 300);
  };

  const handleResetComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage(language === 'en' ? 'Passwords do not match.' : language === 'ps' ? 'پټ نومونه سره سمون نه خوري.' : 'رمزهای عبور با یکدیگر مطابقت ندارند.');
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    setTimeout(() => {
      const result = completePasswordReset(pendingEmail, otpInput, newPassword);
      if (!result.success) {
        setErrorMessage(result.error || (language === 'en' ? 'Password reset failed.' : language === 'ps' ? 'د پټ نوم بدلول ناکام شول.' : 'تغییر رمز عبور با خطا مواجه شد.'));
        setLoading(false);
        return;
      }
      setSuccessMessage(language === 'en' ? 'New password saved successfully. You may now sign in.' : language === 'ps' ? 'نوی پټ نوم په بریالیتوب سره ثبت شو.' : 'رمز عبور جدید با موفقیت ذخیره شد.');
      setLoginEmail(pendingEmail);
      setLoginPassword(newPassword);
      setAuthMode('login');
      setLoading(false);
    }, 300);
  };

  const isRtl = language === 'fa' || language === 'ps';

  return (
    <div className={`min-h-screen relative flex flex-col justify-between transition-colors duration-300 ${
      appSettings.darkMode ? 'bg-[#080C16] text-slate-100' : 'bg-slate-50 text-slate-900'
    } selection:bg-amber-500/30 selection:text-amber-800 font-vazir overflow-x-hidden`}>
      
      {/* Background Lights */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className={`absolute top-0 start-1/2 -translate-x-1/2 w-[1000px] h-[500px] blur-[140px] ${
          appSettings.darkMode 
            ? 'bg-gradient-to-b from-amber-500/12 via-amber-600/5 to-transparent' 
            : 'bg-gradient-to-b from-amber-500/15 via-amber-300/10 to-transparent'
        }`}></div>
        
        <div className={`absolute top-[20%] start-[-10%] w-[550px] h-[550px] rounded-full blur-[150px] ${
          appSettings.darkMode ? 'bg-emerald-500/10' : 'bg-emerald-500/8'
        }`}></div>
        
        <div className={`absolute top-[35%] end-[-10%] w-[600px] h-[600px] rounded-full blur-[160px] ${
          appSettings.darkMode ? 'bg-blue-600/10' : 'bg-blue-400/8'
        }`}></div>
      </div>

      {/* Top Header */}
      <header className={`relative z-30 border-b ${
        appSettings.darkMode ? 'border-white/10 bg-slate-950/80 text-white' : 'border-slate-200 bg-white/90 text-slate-900 shadow-xs'
      } backdrop-blur-2xl sticky top-0`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          
          <div className="flex items-center space-x-3.5 rtl:space-x-reverse">
            <img
              src="/assets/logo.png"
              alt="NIK SMART COUNT"
              className="w-10 h-10 rounded-2xl object-cover shadow-md shrink-0 select-none"
            />
            
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-black text-base sm:text-lg tracking-tight drop-shadow-xs ${
                  appSettings.darkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  {t.appName}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full shadow-xs">
                  {t.verifiedActive}
                </span>
              </div>
              <p className={`text-[11px] font-medium line-clamp-1 ${
                appSettings.darkMode ? 'text-amber-100/70' : 'text-slate-600'
              }`}>
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cycleThemeSchedule}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-colors shadow-md ${
                appSettings.darkMode 
                  ? 'bg-slate-900/90 text-slate-200 border border-white/15 hover:bg-slate-800' 
                  : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100 shadow-xs'
              }`}
            >
              {themeSchedule === 'auto' ? (
                <>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  {appSettings.darkMode ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">اتومات</span>
                </>
              ) : appSettings.darkMode ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-bold">شب</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-bold">روز</span>
                </>
              )}
            </button>

            <div className={`flex items-center space-x-1 rtl:space-x-reverse backdrop-blur-xl p-1 rounded-2xl border text-xs shadow-lg ${
              appSettings.darkMode ? 'bg-slate-900/90 border-white/15' : 'bg-white border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setLanguage('fa')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  language === 'fa' 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md' 
                    : appSettings.darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                دری
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ps')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  language === 'ps' 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md' 
                    : appSettings.darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                پښتو
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  language === 'en' 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md' 
                    : appSettings.darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Hero & Authentication Container */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* Left Column: Visionary Construction Showcase */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-black shadow-lg backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t.landingHeroBadge}</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/logo.png"
                  alt="NIK SMART COUNT"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl object-cover shadow-xl shadow-amber-500/20 shrink-0"
                />
                <div>
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 block">
                    {tp('OFFICIAL CIVIL ENGINEERING SUITE', 'سیستم تخصصی محاسبات و مدیریت مالی ساختمان', 'د ودانۍ د محاسبې او مالي مدیریت مسلکي سیسټم')}
                  </span>
                  <span className={`text-xl sm:text-2xl font-black tracking-tight ${appSettings.darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {t.appName}
                  </span>
                </div>
              </div>

              <h1 className={`text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.3] text-start ${
                appSettings.darkMode ? 'text-white' : 'text-slate-900'
              }`}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 dark:from-amber-300 dark:via-amber-100 dark:to-white">
                  {t.landingHeroTitle}
                </span>
              </h1>
            </div>

            <div className={`p-4 sm:p-5 rounded-2xl border shadow-xl text-justify rtl:text-right ${
              appSettings.darkMode ? 'bg-slate-900/85 border-white/15 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <p className="text-xs sm:text-sm leading-relaxed font-normal">
                {t.landingHeroSubtitle}
              </p>
            </div>

            {/* Feature Slider Card */}
            <motion.div
              initial={{ opacity: 0, x: isRtl ? 40 : -40, y: 25 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 p-6 shadow-2xl overflow-hidden transition-all duration-300"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.exploreFeatureLive}</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-amber-200 font-mono">
                    {currentSlide + 1} / 5
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentSlide((prev) => (prev === 0 ? 4 : prev - 1))}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors"
                  >
                    {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % 5)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors"
                  >
                    {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {(() => {
                const slide = featureSlides[currentSlide];
                const SlideIcon = slide.icon;
                return (
                  <div className="pt-5 space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${slide.color} border flex items-center justify-center shrink-0 shadow-lg`}>
                        <SlideIcon className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                          {slide.badge}
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-white">
                          {slide.title}
                        </h3>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          {slide.desc}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                      <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 backdrop-blur-md">
                        <span className="text-[10px] text-slate-400 block">{slide.statLabel}</span>
                        <span className="text-sm font-black text-amber-300 font-mono">{slide.statValue}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 backdrop-blur-md">
                        <span className="text-[10px] text-slate-400 block">{t.status}</span>
                        <span className="text-xs font-bold text-amber-200 truncate block">{slide.detail1}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 backdrop-blur-md col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 block">{t.formulaSteelTotal}</span>
                        <span className="text-xs font-medium text-emerald-300 truncate block">{slide.detail2}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>

            {/* Quick Demo Credentials Panel (test/prod separation: hide in production via VITE_SHOW_DEMO_LOGINS=false) */}
            {import.meta.env.VITE_SHOW_DEMO_LOGINS !== 'false' && (
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
              className="p-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/15 text-xs text-slate-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>{t.demoAccountsTitle}</span>
                </span>
                <span className="text-[10px] text-slate-400">{t.copyEmail}</span>
              </div>
              
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginEmail('admin');
                    setLoginPassword('password123');
                    setErrorMessage(null);
                  }}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-xl border border-amber-500/40 transition-all font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{t.demoAdminLabel} (@admin)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginEmail('accountant');
                    setLoginPassword('password123');
                    setErrorMessage(null);
                  }}
                  className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded-xl border border-blue-500/40 transition-all font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>{t.demoStaffLabel} (@accountant)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginEmail('sales');
                    setLoginPassword('password123');
                    setErrorMessage(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-xl border border-emerald-500/40 transition-all font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>{tp('Sales Officer (@sales)', 'مسؤول فروشات (@sales)', 'د پلور مسئول (@sales)')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginEmail('najeemnik');
                    setLoginPassword('password123');
                    setErrorMessage(null);
                  }}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl border border-rose-500/40 transition-all font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t.demoSuperAdminLabel} (@najeemnik)</span>
                </button>
              </div>
            </motion.div>
            )}

            {/* Test version entry (hidden in production via VITE_SHOW_DEMO_LOGINS=false) */}
            {import.meta.env.VITE_SHOW_DEMO_LOGINS !== 'false' && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
              className="p-4 rounded-3xl bg-violet-950/80 backdrop-blur-xl border border-violet-500/30 text-xs text-slate-200 space-y-2"
            >
              <div className="flex items-center gap-1.5 font-bold text-violet-300">
                <FlaskConical className="w-4 h-4 text-violet-400" />
                <span>{tp('Test version (playground)', 'نسخه تست (محیط تمرینی)', 'ټسټ بڼه (تمریني چاپېریال)')}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {tp('Try everything with separate empty data — no login needed. Apartments & payments tabs stay locked here; production data is untouched.',
                  'همه‌چیز را با دیتای جداگانه و خالی امتحان کنید — بدون نیاز به لاگین. تب‌های آپارتمان و پرداخت در اینجا قفل است؛ دیتای اصلی دست‌نخورده می‌ماند.',
                  'هرڅه له جلا تشو معلوماتو سره وازمایئ — ننوتلو ته اړتیا نشته. د اپارتمان او تادیو ټبونه دلته بند دي؛ اصلي معلومات نه خوځېږي.')}
              </p>
              <button
                type="button"
                onClick={enterTestMode}
                className="px-4 py-2 bg-violet-500/25 hover:bg-violet-500/40 text-violet-100 rounded-xl border border-violet-400/40 transition-all font-bold flex items-center gap-1.5 shadow-xs"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>{tp('Enter test version', 'ورود به نسخه تست', 'ټسټ بڼې ته ننوتل')}</span>
              </button>
            </motion.div>
            )}
          </div>

          {/* Right Column: High-Contrast Auth Card */}
          <div className="lg:col-span-5 sticky top-16 z-20 self-start">
            <div className={`rounded-3xl ${
              appSettings.darkMode ? 'bg-slate-900/95 border-white/20 text-white' : 'bg-white/95 border-slate-200 text-slate-900 shadow-2xl'
            } backdrop-blur-2xl border p-6 sm:p-8 shadow-2xl space-y-5 relative overflow-hidden transition-all duration-300`}>
              
              <div className="space-y-1.5 pb-2 border-b border-slate-200/80 dark:border-white/10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{tp('Authorized Corporate Portal', 'سامانه اختصاصی ورود به سیستم', 'سیسټم ته د ننوتلو ځانګړې دروازه')}</span>
                </div>
                <h2 className={`text-xl font-black tracking-tight ${appSettings.darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {t.loginTitle || 'ورود به دیتابیس پروژه ساختمانی'}
                </h2>
                <p className={`text-xs ${appSettings.darkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                  صاحبان شرکت‌ها و کارمندان: با نام کاربری یا ایمیل خود وارد شوید.
                </p>
              </div>

{authNotice === 'session-expired' && (
                <div className="p-3.5 bg-amber-950/80 border border-amber-600/80 rounded-2xl text-amber-200 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{tp('Your server session expired or was revoked on another device. Please sign in again.', 'نشست سرور شما منقضی شد یا در دستگاه دیگری باطل گردید. لطفاً دوباره وارد شوید.', 'ستاسې د سرور ناسته پای ته ورسېده یا په بلې دستګا کې باطله شوه. مهرباني وکړئ بیا ننوځئ.')}</span>
                </div>
              )}
              {authNotice === 'server-locked' && (
                <div className="p-3.5 bg-rose-950/80 border border-rose-600/80 rounded-2xl text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{tp('This account was locked by the administrator on another device. Contact your administrator.', 'این حساب در دستگاه دیگری توسط مدیر قفل شد. با مدیر خود تماس بگیرید.', 'دا حساب په بلې دستګا کې د مدیر له خوا بند شو. له خپل مدیر سره اړیکه ونیسئ.')}</span>
                </div>
              )}
              {authNotice === 'server-lockout' && (
                <div className="p-3.5 bg-amber-950/80 border border-amber-600/80 rounded-2xl text-amber-200 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{tp('Too many sign-in attempts. Please try again in 15 minutes.', 'تلاش‌های ورود بیش از حد شد. لطفاً ۱۵ دقیقه بعد تلاش کنید.', 'د ننوتلو هڅې ډېرې شوې. مهرباني وکړئ ۱۵ دقیقې وروسته بیا هڅه وکړئ.')}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 bg-rose-950/80 border border-rose-600/80 rounded-2xl text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 bg-emerald-950/80 border border-emerald-600/80 rounded-2xl text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {authMode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className={`block font-bold mb-1.5 ${appSettings.darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {tp('Username or Email', 'نام کاربری یا ایمیل', 'کارن نوم یا برېښنالیک')}
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="مثال: admin یا accountant"
                        className={`w-full ps-10 pe-3.5 py-3 rounded-2xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/60 font-mono ${
                          appSettings.darkMode 
                            ? 'bg-slate-950/90 border border-slate-700 text-white placeholder-slate-500' 
                            : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`block font-bold ${appSettings.darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {t.password}
                      </label>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('forgot_password'); setErrorMessage(null); }}
                        className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-bold"
                      >
                        {t.forgotPasswordTab}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full ps-10 pe-3.5 py-3 rounded-2xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/60 font-mono ${
                          appSettings.darkMode 
                            ? 'bg-slate-950/90 border border-slate-700 text-white placeholder-slate-500' 
                            : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  <label className={`flex items-center gap-2.5 text-xs font-bold cursor-pointer select-none ${appSettings.darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-amber-600"
                    />
                    <span>{tp('Remember me on this device', 'مرا در این دستگاه به خاطر بسپار', 'په دې دستګا کې مې په یاد وساته')}</span>
                  </label>
                  <p className={`text-[11px] leading-relaxed ${appSettings.darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {tp('Unchecked = you stay signed in only until this tab closes; nothing is kept in the browser.',
                      'بدون تیک = فقط تا بسته شدن این تب وارد می‌مانید؛ چیزی در براوزر ذخیره نمی‌شود.',
                      'پرته له ټیک = یوازې تر دې ټب تړلو پورې ننوتي پاتې کېږئ؛ په براوزر کې هېڅ نه ساتل کېږي.')}
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-white font-black text-sm rounded-2xl transition-all shadow-xl shadow-amber-600/30 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                  >
                    <span>{loading ? t.loading : t.loginAction}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </form>
              )}

              {authMode === 'login' && users.length === 0 && (
                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${appSettings.darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`font-bold ${appSettings.darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {tp('New device? Restore the owner backup first, then sign in.', 'دستگاه جدید؟ اول بکاپ مالک را بازیابی کنید، بعد وارد شوید.', 'نوې دستګا؟ لومړی د خاوند بکاپ بېرته وګرځوئ، بیا ننوځئ.')}
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold cursor-pointer transition">
                    <Upload className="w-4 h-4" />
                    <span>{tp('Choose backup file (.json)', 'انتخاب فایل بکاپ (.json)', 'د بکاپ فایل ټاکل (.json)')}</span>
                    <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
                  </label>
                  {restoreMsg && <p className="font-bold text-amber-500">{restoreMsg}</p>}
                </div>
              )}

              {authMode === 'forgot_password' && (
                <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className={`block font-bold mb-1.5 ${appSettings.darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{t.email}</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="owner@company.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl"
                  >
                    ارسال کد بازیابی
                  </button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-slate-400 hover:text-amber-500 text-xs"
                    >
                      بازگشت به صفحه ورود
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Founder & Contact Profile */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`mt-16 pt-10 border-t ${appSettings.darkMode ? 'border-white/10' : 'border-slate-300'} space-y-8`}
        >
          <div className={`rounded-3xl ${
            appSettings.darkMode 
              ? 'bg-slate-900/90 border-white/15 text-white shadow-2xl' 
              : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
          } backdrop-blur-2xl border p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6`}>
            <img
              src="/assets/creator-logo.png"
              alt={t.founderName}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-2 border-amber-500/40 shrink-0 shadow-lg"
            />
            
            <div className="flex-1 space-y-2 text-center md:text-start">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <h3 className={`text-lg sm:text-xl font-black ${appSettings.darkMode ? 'text-white' : 'text-slate-900'}`}>{t.founderName}</h3>
                <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 w-fit mx-auto sm:mx-0">
                  {t.founderRoleBadge}
                </span>
              </div>
              <p className={`text-xs sm:text-sm ${appSettings.darkMode ? 'text-slate-200' : 'text-slate-700'} leading-relaxed font-normal`}>
                {t.founderBio}
              </p>
            </div>

            <a
              href="https://www.linkedin.com/in/najeem-nik-624120298/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3.5 rounded-2xl bg-[#0A66C2] hover:bg-[#004182] text-white font-bold text-xs flex items-center gap-2.5 transition-all shadow-xl hover:scale-105 shrink-0"
            >
              <Linkedin className="w-4 h-4" />
              <span>{t.contactFounderLinkedIn}</span>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href="https://wa.me/93783788278"
              target="_blank"
              rel="noopener noreferrer"
              className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 hover:border-emerald-500 flex items-center gap-4 group shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 font-bold uppercase block">{t.contactFounderWhatsApp}</span>
                <div className="font-mono font-bold text-sm text-slate-900 dark:text-white" dir="ltr">+93 783 788 278</div>
                <span className="text-[11px] text-slate-500 block">{t.whatsappSubtitle}</span>
              </div>
            </a>

            <a
              href="tel:+93783788278"
              className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 hover:border-amber-500 flex items-center gap-4 group shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-amber-600 font-bold uppercase block">{t.contactFounderPhone}</span>
                <div className="font-mono font-bold text-sm text-slate-900 dark:text-white" dir="ltr">+93 783 788 278</div>
                <span className="text-[11px] text-slate-500 block">{t.phoneSubtitle}</span>
              </div>
            </a>

            <a
              href="mailto:info@nik-smartcount.com"
              className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 hover:border-blue-500 flex items-center gap-4 group shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-blue-600 font-bold uppercase block">{t.contactFounderEmail}</span>
                <div className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate">info@nik-smartcount.com</div>
                <span className="text-[11px] text-slate-500 block">{t.emailSubtitle}</span>
              </div>
            </a>
          </div>
        </motion.section>
      </main>

      <footer className="relative z-20 border-t border-slate-200 dark:border-white/10 py-6 bg-white/80 dark:bg-slate-950/90 backdrop-blur-xl text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>{t.copyrightNotice}</span>
          <button type="button" onClick={checkServer} title={tp('Tap to re-check', 'برای بررسی دوباره بزنید', 'د بیا کتلو لپاره ووهئ')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-line text-[11px] font-bold">
            <span className={`w-2 h-2 rounded-full ${
              serverPing === 'ok' ? 'bg-emerald-500' :
              serverPing === 'checking' ? 'bg-slate-400 animate-pulse' :
              serverPing === 'outdated' ? 'bg-amber-500' : 'bg-rose-500'
            }`} />
            <span className="text-ink">
              {serverPing === 'ok' && tp('Server connected', 'سرور وصل است', 'سرور وصل دی')}
              {serverPing === 'checking' && tp('Checking…', 'در حال بررسی…', 'کتل کېږي…')}
              {serverPing === 'outdated' && tp('Server outdated', 'سرور قدیمی است', 'سرور زوړ دی')}
              {serverPing === 'down' && tp('Server unreachable', 'سرور قطع است', 'سرور قطع دی')}
            </span>
          </button>
          <span className="font-mono text-[11px] text-amber-600">nik-smartcount.com · v1.0.14</span>
        </div>
      </footer>
    </div>
  );
};
