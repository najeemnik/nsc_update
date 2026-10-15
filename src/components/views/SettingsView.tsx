import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Sliders, 
  DollarSign, 
  Building2, 
  Cloud, 
  Database, 
  Upload, 
  Download, 
  RefreshCw, 
  Save, 
  CheckCircle2, 
  Moon, 
  Sun, 
  SunMoon,
  Palette,
  ShieldCheck, 
  HardDrive,
  Globe,
  LogOut,
  FileText,
  FlaskConical,
  Trash2
} from 'lucide-react';
import { AppTheme, CustomBillDesign } from '../../types';
import { DocDesignEditor } from '../docs/DocDesignEditor';
import { backendApi } from '../../services/backendApi';
import { GoogleDriveModal } from '../modals/GoogleDriveModal';
import { usePwaInstall } from '../../hooks/usePwaInstall';

const THEME_OPTIONS: { id: AppTheme; labelKey: string; swatch: string }[] = [
  { id: 'glassmorphism',   labelKey: 'themeGlassmorphism',   swatch: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(191,219,254,0.85))' },
  { id: 'neumorphism',     labelKey: 'themeNeumorphism',     swatch: 'linear-gradient(135deg, #eef3fb, #d3deef)' },
  { id: 'skeuomorphism',   labelKey: 'themeSkeuomorphism',   swatch: 'linear-gradient(135deg, #d9b98a, #8a6a3e)' },
  { id: 'squirclemorphism',labelKey: 'themeSquirclemorphism',swatch: 'linear-gradient(135deg, #818cf8, #f59e0b)' },
  { id: 'metalmorphism',   labelKey: 'themeMetalmorphism',   swatch: 'linear-gradient(135deg, #f2f4f7, #98a3b0)' },
  { id: 'ar_morphism',     labelKey: 'themeArmorphism',      swatch: 'linear-gradient(135deg, #0e7490, #22d3ee)' },
  { id: 'cosmic_orange',   labelKey: 'themeCosmicOrange',    swatch: 'linear-gradient(135deg, #fff7ed, #f96b1f)' },
  { id: 'blue_titanium',   labelKey: 'themeBlueTitanium',    swatch: 'linear-gradient(135deg, #eaf1fb, #3b6fe0)' },
  { id: 'desert_titanium', labelKey: 'themeDesertTitanium',  swatch: 'linear-gradient(135deg, #faf3e3, #c08a3e)' },
];

export const SettingsView: React.FC = () => {
  const { 
    appSettings, 
    updateAppSettings, 
    isDarkMode, 
    toggleDarkMode, 
    isGoogleDriveConnected, 
    backupToGoogleDrive, 
    googleDriveUserEmail, 
    disconnectGoogleDrive, 
    exportBackupJSON, 
    importBackupJSON, 
    t, 
    language, tp,
    setLanguage,
    currentUser,
    getCompanyDefaultLang,
    setCompanyDefaultLang,
    setTheme,
    themeSchedule,
    setThemeSchedule,
    logout,
    setSectionPassword,
    unlockApartments,
    lockApartments,
    clearSampleData,
    isTestMode,
    enterTestMode,
    exitTestMode,
    wipeTestData
  } = useApp();

  const [usdRate, setUsdRate] = useState((appSettings.exchangeRateUSDToAFN || 70.5).toString());
  const [companyName, setCompanyName] = useState(appSettings.companyName || 'NIK SMART COUNT');
  const [defaultCurrency, setDefaultCurrency] = useState(appSettings.defaultCurrency || 'USD');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingDb, setTestingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ checked: boolean; ok: boolean; message: string } | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [dangerStatus, setDangerStatus] = useState<string | null>(null);
  const [docDesign, setDocDesign] = useState<CustomBillDesign>(appSettings.billDesign || {});
  const [docLogoUrl, setDocLogoUrl] = useState(appSettings.logoUrl || '');
  const [designSaved, setDesignSaved] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  const handleInstallApp = async () => {
    setInstallStatus(null);
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      setInstallStatus(tp('Installing… check your home screen.', 'در حال نصب… صفحه اصلی گوشی را بررسی کنید.', 'په نصبېدو کې… د ټلیفون اصلي پاڼه وګورئ.'));
    } else if (outcome === 'dismissed') {
      setInstallStatus(tp('Install dismissed. You can try again anytime.', 'نصب لغو شد. هر وقت خواستید دوباره تلاش کنید.', 'نصب لغوه شو. هر وخت وغواړئ بیا هڅه وکړئ.'));
    } else {
      setInstallStatus(tp('Direct install is not available in this browser — use the browser menu → "Add to Home screen".', 'نصب مستقیم در این مرورگر پشتیبانی نمی‌شود — از منوی مرورگر گزینه "افزودن به صفحه اصلی" را بزنید.', 'مستقیم نصب په دې براوزر کې نشته — د براوزر له مینو څخه "په اصلي پاڼه کې اضافه کول" وټاکئ.'));
    }
    setTimeout(() => setInstallStatus(null), 6000);
  };
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNext, setPinNext] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinEnabled, setPinEnabled] = useState(() => appSettings.sectionProtection?.enabled?.apartments !== false);
  const [pinStatus, setPinStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus(null);
    if (!unlockApartments(pinCurrent)) {
      lockApartments();
      setPinStatus({ ok: false, message: tp('Current PIN is incorrect.', 'رمز فعلی بخش آپارتمان‌ها اشتباه است.', 'د اپارټمنټونو د برخې اوسنی پین سم نه دی.') });
      return;
    }
    lockApartments();
    if (pinEnabled) {
      if (pinNext.trim().length < 4) {
        setPinStatus({ ok: false, message: tp('New PIN must be at least 4 characters.', 'رمز جدید باید حداقل ۴ کاراکتر باشد.', 'نوی پین باید لږ تر لږه ۴ توري وي.') });
        return;
      }
      if (pinNext.trim() !== pinConfirm.trim()) {
        setPinStatus({ ok: false, message: tp('New PIN and confirmation do not match.', 'رمز جدید با تکرار آن مطابقت ندارد.', 'نوی پین له تکرار سره سمون نه خوري.') });
        return;
      }
      setSectionPassword('apartments', pinNext.trim(), true);
    } else {
      setSectionPassword('apartments', '', false);
    }
    setPinCurrent(''); setPinNext(''); setPinConfirm('');
    setPinStatus({ ok: true, message: tp('Apartments section protection updated.', 'محافظت بخش آپارتمان‌ها به‌روزرسانی شد.', 'د اپارټمنټونو د برخې ساتنه تازه شوه.') });
    setTimeout(() => setPinStatus(null), 4000);
  };

  const handleSaveDesign = () => {
    updateAppSettings({ billDesign: docDesign, logoUrl: docLogoUrl || undefined });
    setDesignSaved(true);
    setTimeout(() => setDesignSaved(false), 3000);
  };

  const handleClearTestData = () => {
    const ok = confirm(tp(
      'Delete ALL transactional data (expenses, materials, payroll, units, payments, documents)? Projects and users are kept. Take a JSON backup first! This cannot be undone.',
      'تمام معلومات معاملاتی (مصارف، مواد، معاشات، واحدها، پرداخت‌ها، اسناد) حذف شود؟ پروژه‌ها و کاربران می‌مانند. اول بکاپ JSON بگیرید! این عمل برگشت‌ناپذیر است.',
      'ټول معاملاتي معلومات (مصارف، مواد، مزدونه، واحدونه، تادیې، سندونه) ړنګ شي؟ پروژې او کاروونکي پاتې کېږي. لومړی JSON بکاپ واخلئ! دا عمل بېرته نه ګرځي.'
    ));
    if (!ok) return;
    clearSampleData();
    setDangerStatus(tp('Test data cleared. Projects and users were kept.', 'معلومات تست پاک شد. پروژه‌ها و کاربران باقی ماندند.', 'ټسټ معلومات پاک شول. پروژې او کاروونکي پاتې شول.'));
    setTimeout(() => setDangerStatus(null), 6000);
  };

  const handleTestDatabaseConnection = async () => {
    setTestingDb(true);
    setDbStatus(null);
    try {
      const res = await backendApi.getCurrentUser();
      if (res.success) {
        setDbStatus({
          checked: true,
          ok: true,
          message: tp('Connected to Shahhost MySQL Server.', 'ارتباط با هاست Shahhost و دیتابیس MySQL برقرار است.', 'له Shahhost هوسټ او MySQL ډیټابېس سره اړیکه ټینګه ده.')
        });
      } else {
        setDbStatus({
          checked: true,
          ok: false,
          message: res.error || (tp('Server offline, running in local cached mode.', 'سرور هنوز کانفیگ نشده است یا برنامه در حالت لوکال کش کار می‌کند.', 'سرور لا نه دی برابر شوی یا پروګرام په ځايي زېرمه حالت کې کار کوي.'))
        });
      }
    } catch (e: any) {
      setDbStatus({
        checked: true,
        ok: false,
        message: e.message || tp('Failed to reach the host.', 'خطا در برقراری تماس با هاست.', 'هوسټ سره اړیکه ټینګه نه شوه.')
      });
    } finally {
      setTestingDb(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(usdRate) || 70.5;
    updateAppSettings({
      exchangeRateUSDToAFN: rateNum,
      companyName,
      defaultCurrency
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const driveAutoBackup = appSettings.googleDrive?.autoBackup === true;

  const toggleDriveAutoBackup = () => {
    updateAppSettings({
      googleDrive: { ...(appSettings.googleDrive ?? { connected: false }), autoBackup: !driveAutoBackup }
    });
  };

  const handleBackupNow = async () => {
    if (!isGoogleDriveConnected) { setDriveModalOpen(true); return; }
    setDriveBusy(true);
    try {
      const res = await backupToGoogleDrive();
      setBackupStatus({
        ok: res.success,
        message: res.success
          ? tp('Backup uploaded to Google Drive.', 'بکاپ به گوگل درایو آپلود شد.', 'بکاپ ګوګل ډرایو ته پورته شو.')
          : (res.error || tp('Drive upload failed.', 'آپلود به درایو ناموفق بود.', 'ډرایو ته آپلوډ ناکام شو.'))
      });
    } catch (e: any) {
      setBackupStatus({ ok: false, message: e.message || tp('Drive upload failed.', 'آپلود به درایو ناموفق بود.', 'ډرایو ته آپلوډ ناکام شو.') });
    } finally {
      setDriveBusy(false);
    }
    setTimeout(() => setBackupStatus(null), 6000);
  };

  const handleDisconnectDrive = async () => {
    await disconnectGoogleDrive();
    setBackupStatus({
      ok: true,
      message: tp('Google Drive disconnected.', 'گوگل درایو قطع شد.', 'ګوګل ډرایو پرې شو.')
    });
    setTimeout(() => setBackupStatus(null), 5000);
  };

  const handleExportLocal = async () => {
    const res = exportBackupJSON();
    if (!res.success) {
      setBackupStatus({
        ok: false,
        message: res.error || (tp('Backup download failed.', 'دانلود بکاپ ناموفق بود.', 'د بکاپ کښته کول ناکام شول.'))
      });
      setTimeout(() => setBackupStatus(null), 5000);
      return;
    }
    let message = tp('Backup file downloaded successfully.', 'فایل بکاپ با موفقیت دانلود شد.', 'د بکاپ فایل په بریالیتوب کښته شو.');
    let ok = true;
    if (driveAutoBackup) {
      if (!isGoogleDriveConnected) {
        message += ' ' + tp('(Drive auto-backup skipped: not connected.)', '(بکاپ خودکار درایو رد شد: متصل نیست.)', '(د ډرایو اتومات بکاپ پرېښودل شو: نه دی نښتی.)');
      } else {
        setDriveBusy(true);
        try {
          const up = await backupToGoogleDrive();
          if (up.success) {
            message += ' ' + tp('Also uploaded to Google Drive.', 'به گوگل درایو هم آپلود شد.', 'ګوګل ډرایو ته هم پورته شو.');
          } else {
            ok = false;
            message += ' ' + (up.error || tp('Drive upload failed.', 'آپلود به درایو ناموفق بود.', 'ډرایو ته آپلوډ ناکام شو.'));
          }
        } catch (e: any) {
          ok = false;
          message += ' ' + (e.message || tp('Drive upload failed.', 'آپلود به درایو ناموفق بود.', 'ډرایو ته آپلوډ ناکام شو.'));
        } finally {
          setDriveBusy(false);
        }
      }
    }
    setBackupStatus({ ok, message });
    setTimeout(() => setBackupStatus(null), 6000);
  };

  const handleLogoutAllDevices = async () => {
    setLoggingOutAll(true);
    setDbStatus(null);
    try {
      const res = await backendApi.logoutAll();
      if (res.success) {
        setDbStatus({
          checked: true,
          ok: true,
          message: tp('All sessions on every device were revoked. Signing you out here too.', 'تمام نشست‌های شما در همه دستگاه‌ها باطل شد. اکنون از این دستگاه نیز خارج می‌شوید.', 'ستاسې ټولې ناستې په ټولو دستګاوو کې باطلې شوې. اوس له دې دستګا څخه هم وځئ.')
        });
        setTimeout(() => logout(), 1800);
      } else {
        setDbStatus({
          checked: true,
          ok: false,
          message: res.error || (tp('Failed to revoke sessions.', 'ابطال نشست‌ها ناموفق بود.', 'د ناستو باطلول ناکام شول.'))
        });
      }
    } catch (err: any) {
      setDbStatus({
        checked: true,
        ok: false,
        message: err.message || (tp('Server connection error.', 'خطا در ارتباط با سرور.', 'له سرور سره په اړیکه کې تېروتنه.'))
      });
    } finally {
      setLoggingOutAll(false);
    }
  };

  const handleImportLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          importBackupJSON(json);
          setBackupStatus({
            ok: true,
            message: tp('Database restored successfully from local file!', 'دیتابیس با موفقیت از فایل محلی بازیابی شد!', 'ډیټابېس له ځايي فایل څخه په بریالیتوب بېرته وګرځېد!')
          });
        } catch (err: any) {
          setBackupStatus({
            ok: false,
            message: tp('Failed to parse backup file: ', 'خواندن فایل بکاپ ناموفق بود: ', 'د بکاپ فایل لوستل ناکام شول: ') + err.message
          });
        }
        setTimeout(() => setBackupStatus(null), 6000);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-ink flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-amber-500" />
          <span>{t('companySettings') || 'Company & System Settings'}</span>
        </h1>
        <p className="text-xs text-ink-muted mt-1">
          {t('settingsDesc') || 'Configure currency exchange rates, cloud storage, themes and backup policies'}
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{t('settingsSavedSuccess') || 'Settings saved successfully!'}</span>
        </div>
      )}

      {/* Appearance: Morphism Theme & Day/Night Mode */}
      <div className="p-6 rounded-3xl bg-surface border border-line shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Palette className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-black text-ink">{t('themeSettings') || 'Theme & Appearance'}</h2>
              <p className="text-[11px] text-ink-muted">{t('appearanceDesc') || 'Visual style of the whole system'}</p>
            </div>
          </div>
        </div>

        {/* Theme picker */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {THEME_OPTIONS.map(opt => {
            const isActive = (appSettings.theme || 'glassmorphism') === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`group p-2.5 rounded-2xl border text-start transition-all ${
                  isActive
                    ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-500/5 shadow-sm'
                    : 'border-line bg-surface-2 hover:border-amber-500/40 hover:shadow-sm'
                }`}
              >
                <span
                  className="block h-10 w-full rounded-xl border border-black/10 mb-2 group-hover:scale-[1.02] transition-transform"
                  style={{ background: opt.swatch }}
                />
                <span className={`block text-[10px] leading-tight font-bold ${isActive ? 'text-amber-700 dark:text-amber-400' : 'text-ink-muted'}`}>
                  {t(opt.labelKey as any) || opt.id}
                </span>
              </button>
            );
          })}
        </div>

        {/* Day / Night schedule */}
        <div>
          <p className="text-xs font-black text-ink mb-2">{t('darkModeToggle') || 'Dark / Light Mode'}</p>
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'auto' as const, label: t('autoMode') || 'Auto', icon: <SunMoon className="w-3.5 h-3.5" /> },
              { id: 'light' as const, label: t('lightMode') || 'Light', icon: <Sun className="w-3.5 h-3.5 text-amber-500" /> },
              { id: 'dark' as const, label: t('darkMode') || 'Dark', icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> },
            ]).map(mode => {
              const isActive = (themeSchedule || 'auto') === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setThemeSchedule(mode.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    isActive
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                      : 'bg-surface-2 text-ink-muted border-line hover:text-ink hover:border-amber-500/40'
                  }`}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="p-6 rounded-3xl bg-surface border border-line shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('companyName') || 'Company / Firm Name'}
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-2 border border-line rounded-xl text-xs font-semibold"
            />
          </div>

          {/* Exchange Rate */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('exchangeRateUSDToAFN') || 'Exchange Rate (1 USD = ? AFN)'}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={usdRate}
                onChange={e => setUsdRate(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-2 border border-line rounded-xl text-xs font-mono font-bold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">AFN</span>
            </div>
          </div>

          {/* Default Currency */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('defaultCurrency') || 'Default Project Currency'}
            </label>
            <select
              value={defaultCurrency}
              onChange={e => setDefaultCurrency(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-2 border border-line rounded-xl text-xs"
            >
              <option value="USD">USD ($ - US Dollar)</option>
              <option value="AFN">AFN (؋ - Afghan Afghani)</option>
            </select>
          </div>

          {/* Interface Language */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('language') || 'Language'}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLanguage('fa')}
                className={`flex-1 py-2 text-xs rounded-xl font-bold transition ${
                  language === 'fa' ? 'bg-blue-600 text-white' : 'bg-surface-2 text-slate-700 dark:text-slate-300'
                }`}
              >
                دری (Farsi)
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ps')}
                className={`flex-1 py-2 text-xs rounded-xl font-bold transition ${
                  language === 'ps' ? 'bg-blue-600 text-white' : 'bg-surface-2 text-slate-700 dark:text-slate-300'
                }`}
              >
                پښتو (Pashto)
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex-1 py-2 text-xs rounded-xl font-bold transition ${
                  language === 'en' ? 'bg-blue-600 text-white' : 'bg-surface-2 text-slate-700 dark:text-slate-300'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Wave 33: company default language (owner only) — applies on login
              to devices that never had a manual language choice. */}
          {(currentUser?.role === 'admin' || currentUser?.isMasterSuperAdmin) && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Company default language', 'زبان پیش‌فرض شرکت', 'د شرکت ډیفالټ ژبه')}
              </label>
              <div className="flex gap-2">
                {([
                  ['fa', 'دری'],
                  ['ps', 'پښتو'],
                  ['en', 'English'],
                ] as Array<['fa' | 'ps' | 'en', string]>).map(([code, label]) => {
                  const active = (getCompanyDefaultLang(currentUser?.companyName || undefined) || 'en') === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setCompanyDefaultLang(currentUser?.companyName || undefined, code);
                        setSavedSuccess(true);
                        setTimeout(() => setSavedSuccess(false), 2500);
                      }}
                      className={`flex-1 py-2 text-xs rounded-xl font-bold transition ${
                        active ? 'bg-emerald-600 text-white' : 'bg-surface-2 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                {tp('New devices of this company start with this language. A manual choice on a device always wins.',
                  'دستگاه‌های جدید این شرکت با این زبان شروع می‌کنند. انتخاب دستی روی هر دستگاه همیشه مقدم است.',
                  'د دې شرکت نوې وسیلې په دې ژبه پیل کوي. په هرې وسیلې لاسي ټاکنه تل لومړیتوب لري.')}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-line">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Save className="w-4 h-4" />
            <span>{t('saveSettings') || 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Wave 27: Documents & Print Design (self-service) */}
      <div className="p-6 rounded-3xl bg-surface border border-line shadow-sm space-y-4">
        <h3 className="font-bold text-base text-ink flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <span>{tp('Documents & print design', 'طراحی بل‌ها و اسناد چاپی', 'د بلونو او چاپي سندونو طرحه')}</span>
        </h3>
        <p className="text-xs text-ink-muted">
          {tp('Logo, texts, colors, font, paper, margins, section order and custom templates — applied to every voucher, bill, receipt and contract you print.',
            'لوگو، متن‌ها، رنگ، فونت، کاغذ، حاشیه، ترتیب بخش‌ها و تمپلت دلخواه — روی همه واچرها، بل‌ها، رسیدها و قراردادهای چاپی شما اعمال می‌شود.',
            'لوګو، متنونه، رنګ، فونټ، کاغذ، حاشیه، د برخو ترتیب او خپل تمپلېټ — په هر واؤچر، بل، رسید او قرارداد چې چاپوئ پلي کېږي.')}
        </p>
        <DocDesignEditor
          design={docDesign}
          onChange={setDocDesign}
          logoUrl={docLogoUrl}
          onLogoChange={setDocLogoUrl}
          companyName={companyName}
        />
        <div className="flex justify-end items-center gap-3 pt-2 border-t border-line">
          {designSaved && (
            <span className="text-[11px] font-bold text-emerald-600">{tp('Design saved.', 'طرح ذخیره شد.', 'طرحه وساتل شوه.')}</span>
          )}
          <button
            type="button"
            onClick={handleSaveDesign}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Save className="w-4 h-4" />
            <span>{tp('Save design', 'ذخیره طرح', 'طرحه ساتل')}</span>
          </button>
        </div>
      </div>

      {/* Cloud & Backup Section */}
      <div className="p-6 rounded-3xl bg-surface border border-line shadow-sm space-y-4">
        <h3 className="font-bold text-base text-ink flex items-center gap-2">
          <Cloud className="w-5 h-5 text-blue-600" />
          <span>{t('googleDriveAndCloud') || 'Google Drive Cloud Storage & Backups'}</span>
        </h3>
        <p className="text-xs text-ink-muted">
          {t('googleDriveBackupHelp') || 'Secure your complete database, contractor balances, apartments, and receipts in your private Google Drive account.'}
        </p>

        {isGoogleDriveConnected ? (
          <div className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="truncate">{googleDriveUserEmail || tp('Connected', 'متصل', 'نښتی')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
            <Cloud className="w-4 h-4 shrink-0" />
            <span>{tp('Not connected to Google Drive', 'به گوگل درایو متصل نیست', 'له ګوګل ډرایو سره نه دی نښتی')}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setDriveModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition"
          >
            <Cloud className="w-4 h-4" />
            <span>{isGoogleDriveConnected ? (t('manageGoogleDrive') || 'Manage Google Drive') : (t('connectDrive') || 'Connect Google Drive')}</span>
          </button>

          {isGoogleDriveConnected && (
            <button
              type="button"
              onClick={handleBackupNow}
              disabled={driveBusy}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{driveBusy ? tp('Uploading...', 'در حال آپلود...', 'پورته کېږي...') : tp('Backup Now', 'بکاپ فوری', 'اوس بکاپ')}</span>
            </button>
          )}

          {isGoogleDriveConnected && (
            <button
              type="button"
              onClick={handleDisconnectDrive}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              <span>{tp('Disconnect', 'قطع اتصال', 'پرېکول')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportLocal}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-4 h-4" />
            <span>{t('exportLocalJSON') || 'Download Local Backup (JSON)'}</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{t('restoreFromLocalJSON') || 'Restore from Local File'}</span>
            <input type="file" accept=".json" onChange={handleImportLocal} className="hidden" />
          </label>
        </div>

        <label className="flex items-center gap-2.5 pt-1 text-xs font-semibold text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={driveAutoBackup}
            onChange={toggleDriveAutoBackup}
            className="w-4 h-4 accent-blue-600"
          />
          <span>{tp('Auto-upload backup to Google Drive after each local backup', 'آپلود خودکار بکاپ به گوگل درایو بعد از هر بکاپ محلی', 'له هر ځايي بکاپ وروسته اتومات بکاپ ګوګل ډرایو ته پورته کول')}</span>
        </label>
        {backupStatus && (
          <div className={`mt-3 text-xs font-bold px-4 py-2.5 rounded-xl border ${
            backupStatus.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}>
            {backupStatus.message}
          </div>
        )}
      </div>

      {/* Test version (separate playground data) */}
      {(isTestMode || currentUser?.isMasterSuperAdmin || (currentUser?.role === 'admin' && !currentUser?.ownerAdminId)) && (
        <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isTestMode ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-800' : 'bg-surface border-line'}`}>
          <h3 className="font-bold text-base text-ink flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-violet-600" />
            <span>{tp('Test version', 'نسخه تست', 'ټسټ بڼه')}</span>
            {isTestMode && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-600 text-white">
                {tp('ACTIVE', 'فعال', 'فعاله')}
              </span>
            )}
          </h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            {isTestMode
              ? tp('You are in the test version: separate empty storage, no-login demo user, apartments & payments locked. Production data is untouched. Exiting returns you to the production login.',
                  'شما در نسخه تست هستید: حافظه جداگانه و خالی، کاربر نمایشی بدون لاگین، آپارتمان و پرداخت قفل. دیتای اصلی دست‌نخورده است. با خروج به لاگین اصلی برمی‌گردید.',
                  'تاسې په ټسټ بڼه کې یاست: جلا تشه زېرمه، له ننوتلو پرته تمریني کاروونکی، اپارتمان او تادیې بندې. اصلي معلومات نه خوځېږي. په وتلو سره اصلي ننوتلو ته بېرته ځئ.')
              : tp('Open a separate playground with empty data and no login — safe to try everything. Apartments & payments stay locked there; production data is untouched.',
                  'یک محیط تمرینی جداگانه با دیتای خالی و بدون لاگین باز کنید — همه‌چیز را با خیال راحت امتحان کنید. آپارتمان و پرداخت آنجا قفل است؛ دیتای اصلی دست‌نخورده می‌ماند.',
                  'له تشو معلوماتو او پرته له ننوتلو جلا تمریني چاپېریال پرانیځئ — هرڅه په ډاډ وازمایئ. اپارتمان او تادیې هلته بندې دي؛ اصلي معلومات نه خوځېږي.')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {isTestMode ? (
              <>
                <button
                  type="button"
                  onClick={exitTestMode}
                  className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{tp('Exit test version', 'خروج از نسخه تست', 'له ټسټ بڼې وتل')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(tp('Wipe ALL test-version data and start fresh?', 'همه دیتای نسخه تست پاک و از نو شروع شود؟', 'د ټسټ بڼې ټول معلومات پاک او له سره پیل شي؟'))) {
                      wipeTestData();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{tp('Wipe test data', 'پاک‌سازی دیتای تست', 'د ټسټ معلوماتو پاکول')}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={enterTestMode}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                <FlaskConical className="w-4 h-4" />
                <span>{tp('Enter test version', 'ورود به نسخه تست', 'ټسټ بڼې ته ننوتل')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Shahhost MySQL Database Integration Section */}
      <div className="p-6 rounded-3xl bg-surface border border-line shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-ink">
                {tp('Shahhost MySQL Cloud Database', 'دیتابیس آنلاین Shahhost (SSD Silver)', 'د Shahhost آنلاین ډیټابېس (SSD Silver)')}
              </h3>
              <p className="text-xs text-ink-muted">
                {tp('28-Table Relational MySQL Architecture with Unlimited Storage', 'دیتابیس ۲۸ جدولی MySQL با ظرفیت نامحدود و همگام‌سازی ابری', '۲۸ جدولیز MySQL ډیټابېس له نامحدوده ظرفیت او ورېځ همغږۍ سره')}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {tp('MySQL & PHP Ready', 'پشتیبانی کامل MySQL & PHP', 'د MySQL او PHP بشپړ ملاتړ')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-2xl bg-surface-2 border border-line">
            <span className="text-slate-400 font-medium">{tp('Hosting Tier:', 'نوع هاست و پکیج:', 'د هوسټ او پکېج ډول:')}</span>
            <p className="font-bold text-ink mt-0.5">Shahhost NVMe SSD Silver</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-surface-2 border border-line">
            <span className="text-slate-400 font-medium">{tp('Database Tables:', 'جداول فعال دیتابیس:', 'د ډیټابېس فعال جدولونه:')}</span>
            <p className="font-bold text-ink mt-0.5">{tp('28 Tables (All 23 Sheets)', '۲۸ جدول یکپارچه (پوشش ۲۳ شیت اکسل)', '۲۸ یوځای جدولونه (د اکسل ۲۳ شېټونو پوښښ)')}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-surface-2 border border-line">
            <span className="text-slate-400 font-medium">{tp('Security & Master Gate:', 'امنیت و کنترل:', 'امنیت او کنټرول:')}</span>
            <p className="font-bold text-ink mt-0.5">{tp('Office 7 Master Active', 'دفتر هفت (office_7) فعال', 'دفتر اووه (office_7) فعال دی')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestDatabaseConnection}
            disabled={testingDb}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testingDb ? 'animate-spin' : ''}`} />
            <span>{tp('Test Server Connectivity', 'بررسی وضعیت اتصال سرور', 'د سرور د اړیکې وضعیت کتل')}</span>
          </button>
          <button
            type="button"
            onClick={handleLogoutAllDevices}
            disabled={loggingOutAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
          >
            <LogOut className={`w-4 h-4 ${loggingOutAll ? 'animate-pulse' : ''}`} />
            <span>{tp('Logout All Devices', 'خروج از همه دستگاه‌ها', 'له ټولو دستګاوو څخه وتل')}</span>
          </button>
        </div>

        {dbStatus && (
          <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            dbStatus.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          }`}>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{dbStatus.message}</span>
          </div>
        )}
      </div>

      {/* Audit fix: apartments section PIN — changeable, no hardcoded master backdoor */}
      <div className="p-6 rounded-3xl bg-surface border border-line shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-ink">
              {tp('Apartments Section PIN', 'رمز بخش آپارتمان‌ها', 'د اپارټمنټونو د برخې پین')}
            </h3>
            <p className="text-xs text-ink-muted">
              {tp('Gate that protects apartment sales data. Change it regularly.', 'قفل محافظ معلومات فروش آپارتمان‌ها. به‌صورت دوره‌ای تغییر دهید.', 'هغه قلف چې د اپارټمنټونو د پلور معلومات ساتي. په منظم ډول یې بدل کړئ.')}
            </p>
          </div>
        </div>
        <form onSubmit={handleSavePin} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center gap-2 sm:col-span-2 font-bold text-ink cursor-pointer">
            <input type="checkbox" checked={pinEnabled} onChange={e => setPinEnabled(e.target.checked)} className="w-4 h-4 accent-violet-600" />
            {tp('Enable PIN protection for Apartments', 'فعال بودن قفل رمز برای آپارتمان‌ها', 'د اپارټمنټونو لپاره د پین قلف فعالول')}
          </label>
          <div>
            <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">{tp('Current PIN', 'رمز فعلی', 'اوسنی پین')}</span>
            <input type="password" required value={pinCurrent} onChange={e => setPinCurrent(e.target.value)} autoComplete="off"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
          </div>
          <div>
            <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">{tp('New PIN (min 4 chars)', 'رمز جدید (حداقل ۴ کاراکتر)', 'نوی پین (لږ تر لږه ۴ توري)')}</span>
            <input type="password" value={pinNext} onChange={e => setPinNext(e.target.value)} autoComplete="new-password" disabled={!pinEnabled}
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50" />
          </div>
          <div>
            <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">{tp('Confirm New PIN', 'تکرار رمز جدید', 'د نوي پین تکرار')}</span>
            <input type="password" value={pinConfirm} onChange={e => setPinConfirm(e.target.value)} autoComplete="new-password" disabled={!pinEnabled}
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-md transition active:scale-95">
              <Save className="w-4 h-4" />
              <span>{tp('Save PIN', 'ذخیره رمز', 'پین خوندي کول')}</span>
            </button>
          </div>
        </form>
        {pinStatus && (
          <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${pinStatus.ok
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'}`}>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{pinStatus.message}</span>
          </div>
        )}
      </div>

      {/* Audit fix: in-app PWA install */}
      <div className="p-6 rounded-3xl bg-surface border border-line shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-ink">
                {tp('Install App on This Device', 'نصب اپلیکیشن روی این دستگاه', 'په دې دستګاه اپلیکیشن نصبول')}
              </h3>
              <p className="text-xs text-ink-muted">
                {tp('Add NIK SMART COUNT to your home screen for faster offline access.', 'نیک اسمارت کانت را به صفحه اصلی اضافه کنید تا آفلاین و سریع باز شود.', 'NIK SMART COUNT په اصلي پاڼه کې اضافه کړئ څو آفلاین او چټک خلاص شي.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallApp}
            disabled={isInstalled}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isInstalled
              ? tp('Installed ✓', 'نصب شده ✓', 'نصب شوی ✓')
              : canInstall
                ? tp('Install Now', 'نصب کنید', 'همدا اوس نصب کړئ')
                : tp('How to Install', 'راهنمای نصب', 'د نصب لارښود')}</span>
          </button>
        </div>
        {installStatus && (
          <div className="p-3.5 rounded-2xl text-xs font-semibold bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300">
            {installStatus}
          </div>
        )}
      </div>

      {/* Danger Zone: test/production separation */}
      <div className="p-5 rounded-3xl bg-surface border border-red-200 dark:border-red-900 space-y-4">
        <div>
          <h2 className="text-sm font-black text-red-600 dark:text-red-400">
            {tp('Danger Zone', 'ناحیه خطر', 'خطرناکه برخه')}
          </h2>
          <p className="text-[11px] text-ink-muted mt-1">
            {tp('Before going live: download a JSON backup, then wipe test transactions to start production clean.',
               'قبل از استفاده واقعی: اول بکاپ JSON بگیرید، بعد معلومات تست را پاک کنید تا با دیتای تمیز شروع کنید.',
               'له واقعي کارولو مخکې: لومړی JSON بکاپ کښته کړئ، بیا ټسټ معلومات پاک کړئ.')}
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={handleClearTestData}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold transition"
          >
            <span>{tp('Clear Test Transactions', 'پاک‌سازی معلومات تست', 'د ټسټ معلوماتو پاکول')}</span>
          </button>
        </div>
        {dangerStatus && (
          <div className="p-3.5 rounded-2xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
            {dangerStatus}
          </div>
        )}
      </div>
      <GoogleDriveModal 
        isOpen={driveModalOpen} 
        onClose={() => setDriveModalOpen(false)} 
      />
    </div>
  );
};
