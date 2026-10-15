import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NotificationBell } from './NotificationCenter';
import { 
  Building2, 
  ChevronDown, 
  Globe, 
  Search, 
  Camera, 
  LogOut, 
  Plus, 
  ShieldCheck, 
  X,
  CreditCard,
  Layers,
  CircleDot,
  Receipt,
  HardHat,
  Home,
  Menu,
  Bot,
  Sun,
  Moon,
  Sliders,
  BookOpen,
  Users,
  Cloud,
  MoreHorizontal,
  Coins,
  Truck,
  UserCheck,
  ArrowLeftRight,
  Wallet,
  Scale,
  Settings
} from 'lucide-react';
import { Language, DEFAULT_ACTION_BUTTONS, CustomActionButton } from '../types';

interface NavbarProps {
  onOpenNewProject: () => void;
  setActiveTab: (tab: string) => void;
  onOpenAiAssistant?: () => void;
  onOpenSystemGuide?: () => void;
  onOpenMobileMenu?: () => void;
  onOpenAddExpense?: () => void;
  onOpenAddPayment?: () => void;
  onOpenAddSteel?: () => void;
  onOpenAddConcrete?: () => void;
  onOpenAddApartment?: () => void;
  onOpenAddContractor?: () => void;
  onOpenAddIncome?: () => void;
  onOpenAddMaterial?: () => void;
  onOpenAddLabor?: () => void;
  onOpenAddTransfer?: () => void;
  onOpenAddPettyCash?: () => void;
  onOpenAddAsset?: () => void;
  onOpenDrive?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenNewProject, 
  setActiveTab,
  onOpenAiAssistant,
  onOpenSystemGuide,
  onOpenMobileMenu,
  onOpenAddExpense,
  onOpenAddPayment,
  onOpenAddSteel,
  onOpenAddConcrete,
  onOpenAddApartment,
  onOpenAddContractor,
  onOpenAddIncome,
  onOpenAddMaterial,
  onOpenAddLabor,
  onOpenAddTransfer,
  onOpenAddPettyCash,
  onOpenAddAsset,
  onOpenDrive,
}) => {
  const {
    t,
    tp,
    language,
    setLanguage, 
    currentUser, 
    logout, 
    switchUserRole,
    grantedProjects, 
    currentProject, 
    setCurrentProjectId,
    openCameraForCapture,
    searchQuery,
    setSearchQuery,
    searchResults,
    appSettings,
    aiAccess,
    toggleDarkMode,
    themeSchedule,
    cycleThemeSchedule,
    isGoogleDriveConnected,
    connectGoogleDrive,
    disconnectGoogleDrive,
    setIsMasterAdminOpen
  } = useApp();

  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  const roleLabel =
    currentUser?.role === 'admin' ? tp('Admin', 'ادمین', 'اډمېن') :
    currentUser?.role === 'accountant' ? tp('Accountant', 'حسابدار', 'محاسب') :
    tp('Viewer', 'بیننده', 'کتونکی');

  const circleBtn = 'w-9 h-9 rounded-full flex items-center justify-center bg-white/80 dark:bg-slate-700/70 text-slate-600 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-xs transition-colors shrink-0 tap-target';

  const searchRef = useRef<HTMLDivElement | null>(null);
  const quickAddRef = useRef<HTMLDivElement | null>(null);
  const projectRef = useRef<HTMLDivElement | null>(null);
  const langRef = useRef<HTMLDivElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchFocused(false);
      if (quickAddRef.current && !quickAddRef.current.contains(target)) setQuickAddOpen(false);
      if (projectRef.current && !projectRef.current.contains(target)) setProjectDropdownOpen(false);
      if (langRef.current && !langRef.current.contains(target)) setLangDropdownOpen(false);
      if (userRef.current && !userRef.current.contains(target)) setUserDropdownOpen(false);
      if (moreRef.current && !moreRef.current.contains(target)) setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalResultsCount = 
    searchResults.projects.length +
    searchResults.contractors.length +
    searchResults.suppliers.length +
    searchResults.apartments.length +
    searchResults.expenses.length +
    searchResults.steel.length +
    searchResults.concrete.length +
    searchResults.payments.length;

  return (
    <header className="sticky top-0 z-40 no-print px-2 sm:px-4 pt-2 transition-all duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="bg-[#e9e9ed] dark:bg-slate-800/95 border border-black/5 dark:border-white/10 shadow-sm rounded-2xl px-2.5 sm:px-4">
        <div className="flex items-center justify-between h-14 gap-2 min-w-0">
          
          {/* Logo & Project Switcher */}
          <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
            <div 
              className="flex items-center space-x-2.5 rtl:space-x-reverse cursor-pointer shrink-0" 
              onClick={() => setActiveTab('dashboard')}
            >
              {logoOk ? (
                <img
                  src={appSettings.logoUrl || '/assets/logo.png'}
                  alt={appSettings.companyName || 'NIK SMART COUNT'}
                  onError={() => setLogoOk(false)}
                  className="h-9 w-auto max-w-[120px] shrink-0 object-contain"
                />
              ) : (
                <div className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-sm shadow-xs">
                  {currentUser?.companyName ? currentUser.companyName.charAt(0) : 'N'}
                </div>
              )}
              <div className="hidden sm:block max-w-[110px] md:max-w-[150px] lg:max-w-[190px] xl:max-w-[260px] min-w-0">
                <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                  <span className="font-extrabold tracking-tight text-ink text-sm truncate whitespace-nowrap">
                    {currentUser?.companyName || appSettings.companyName || t.appName}
                  </span>
                </div>
                <p className="text-[10px] text-ink-muted line-clamp-1 leading-tight">
                  {appSettings.companySubtitle || t.appSubtitle}
                </p>
              </div>
            </div>

            {/* Building Project Selector */}
            <div ref={projectRef} className="relative">
              <button
                type="button"
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                className="flex items-center space-x-2 rtl:space-x-reverse bg-white/80 dark:bg-slate-700/70 hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold shadow-xs transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                <span className="max-w-[70px] md:max-w-[110px] xl:max-w-[170px] truncate font-bold">
                  {currentProject ? currentProject.name : t.selectProject}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>

              {projectDropdownOpen && (
                <div className="absolute top-full mt-1.5 start-0 w-72 bg-surface rounded-2xl shadow-2xl border border-line py-1.5 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    {t.myBuildings}
                  </div>
                  {grantedProjects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => {
                        setCurrentProjectId(proj.id);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full text-start px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                        proj.id === currentProject?.id ? 'bg-amber-50 dark:bg-amber-950/40 font-bold text-amber-900 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-bold">{proj.name}</div>
                        <div className="text-[11px] text-slate-400">{proj.floors} {t.floors} • {proj.units} {t.units} • {proj.city}</div>
                      </div>
                      {proj.id === currentProject?.id && (
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-line mt-1 pt-1">
                    <button
                      onClick={() => {
                        setProjectDropdownOpen(false);
                        onOpenNewProject();
                      }}
                      className="w-full text-start px-3 py-2 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-bold flex items-center space-x-2 rtl:space-x-reverse transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.newProject}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Role pill (BRYZOS style) */}
            <div className="hidden md:flex items-center px-4 py-1.5 rounded-full bg-white/60 dark:bg-slate-700/60 text-[11px] font-extrabold tracking-[0.2em] text-slate-500 dark:text-slate-300 uppercase shrink-0">
              {roleLabel}
            </div>
          </div>

          {/* Center icon circles (BRYZOS style) */}
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">

            {/* Home */}
            <div className="hidden lg:block">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                title={tp('Dashboard', 'داشبورد', 'ډشبورډ')}
                aria-label={tp('Dashboard', 'داشبورد', 'ډشبورډ')}
                className={`${circleBtn} bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow`}
              >
                <Home className="w-4 h-4" />
              </button>
            </div>

            {/* Notifications (Wave 12) */}
            <NotificationBell className={`${circleBtn} bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow`} />

            {/* Direct Quick Action (Highest configured priority) */}
            {(() => {
              const actionHandlers: Record<string, (() => void) | undefined> = {
                income: onOpenAddIncome,
                addIncome: onOpenAddIncome,
                material: onOpenAddMaterial,
                addMaterial: onOpenAddMaterial,
                labor: onOpenAddLabor,
                addLabor: onOpenAddLabor,
                transfer: onOpenAddTransfer,
                addTransfer: onOpenAddTransfer,
                petty_cash: onOpenAddPettyCash,
                addPettyCash: onOpenAddPettyCash,
                asset: onOpenAddAsset,
                addAsset: onOpenAddAsset,
                expense: onOpenAddExpense,
                addExpense: onOpenAddExpense,
                steel: onOpenAddSteel,
                addSteel: onOpenAddSteel,
                concrete: onOpenAddConcrete,
                addConcrete: onOpenAddConcrete,
                payment: onOpenAddPayment,
                addPayment: onOpenAddPayment,
                apartment: onOpenAddApartment,
                addApartment: onOpenAddApartment,
                contractor: onOpenAddContractor,
                addContractor: onOpenAddContractor,
              };

              const actionIcons: Record<string, any> = {
                income: Coins,
                addIncome: Coins,
                material: Truck,
                addMaterial: Truck,
                labor: UserCheck,
                addLabor: UserCheck,
                transfer: ArrowLeftRight,
                addTransfer: ArrowLeftRight,
                petty_cash: Wallet,
                addPettyCash: Wallet,
                asset: Scale,
                addAsset: Scale,
                expense: Receipt,
                addExpense: Receipt,
                steel: Layers,
                addSteel: Layers,
                concrete: CircleDot,
                addConcrete: CircleDot,
                payment: CreditCard,
                addPayment: CreditCard,
                apartment: Home,
                addApartment: Home,
                contractor: HardHat,
                addContractor: HardHat,
              };

              const configuredButtons = (currentUser?.customButtonConfig && currentUser.customButtonConfig.length > 0)
                ? currentUser.customButtonConfig
                : DEFAULT_ACTION_BUTTONS;

              const activeQuickButtons = configuredButtons
                .filter(b => (b.enabled !== false && b.isEnabled !== false) && (actionHandlers[b.id] || actionHandlers[b.actionKey || b.id]))
                .sort((a, b) => a.order - b.order);

              const topButton = activeQuickButtons[0];
              if (!topButton) return null;
              const handler = actionHandlers[topButton.id] || actionHandlers[topButton.actionKey || topButton.id];
              const IconComponent = actionIcons[topButton.id] || actionIcons[topButton.actionKey || topButton.id] || Plus;

              const colorClass = topButton.color === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                topButton.color === 'info' ? 'bg-blue-600 hover:bg-blue-700' :
                                topButton.color === 'danger' ? 'bg-rose-600 hover:bg-rose-700' :
                                topButton.color === 'warning' ? 'bg-orange-500 hover:bg-orange-600' :
                                topButton.color === 'slate' ? 'bg-slate-700 hover:bg-slate-800' :
                                'bg-amber-600 hover:bg-amber-700';

              const shapeClass = topButton.shape === 'pill' ? 'rounded-full' :
                                topButton.shape === 'square' ? 'rounded-lg' : 'rounded-xl';

              return (
                <button
                  type="button"
                  onClick={() => handler?.()}
                  className={`hidden 2xl:flex items-center space-x-1.5 rtl:space-x-reverse ${colorClass} ${shapeClass} text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors`}
                >
                  <IconComponent className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{language === 'ps' ? (topButton.labelPs || topButton.labelFa || topButton.label) : language === 'en' ? (topButton.labelEn || topButton.label) : (topButton.labelFa || topButton.label)}</span>
                </button>
              );
            })()}
            
            {/* Quick Add Menu */}
            <div ref={quickAddRef} className="relative">
              <button
                type="button"
                onClick={() => setQuickAddOpen(!quickAddOpen)}
                title={t.quickActions}
                aria-label={t.quickActions}
                className={`${circleBtn} bg-amber-600 hover:bg-amber-700 text-white`}
              >
                <Plus className="w-4 h-4" />
              </button>

              {quickAddOpen && (
                <div className="absolute top-full mt-1.5 end-0 w-60 max-w-[90vw] bg-surface rounded-2xl shadow-2xl border border-line py-1.5 z-50 animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t.quickActions}
                  </div>

                  {(() => {
                    const actionHandlers: Record<string, (() => void) | undefined> = {
                      income: onOpenAddIncome,
                      addIncome: onOpenAddIncome,
                      material: onOpenAddMaterial,
                      addMaterial: onOpenAddMaterial,
                      labor: onOpenAddLabor,
                      addLabor: onOpenAddLabor,
                      transfer: onOpenAddTransfer,
                      addTransfer: onOpenAddTransfer,
                      petty_cash: onOpenAddPettyCash,
                      addPettyCash: onOpenAddPettyCash,
                      asset: onOpenAddAsset,
                      addAsset: onOpenAddAsset,
                      expense: onOpenAddExpense,
                      addExpense: onOpenAddExpense,
                      steel: onOpenAddSteel,
                      addSteel: onOpenAddSteel,
                      concrete: onOpenAddConcrete,
                      addConcrete: onOpenAddConcrete,
                      payment: onOpenAddPayment,
                      addPayment: onOpenAddPayment,
                      apartment: onOpenAddApartment,
                      addApartment: onOpenAddApartment,
                      contractor: onOpenAddContractor,
                      addContractor: onOpenAddContractor,
                    };

                    const actionIcons: Record<string, any> = {
                      income: Coins,
                      addIncome: Coins,
                      material: Truck,
                      addMaterial: Truck,
                      labor: UserCheck,
                      addLabor: UserCheck,
                      transfer: ArrowLeftRight,
                      addTransfer: ArrowLeftRight,
                      petty_cash: Wallet,
                      addPettyCash: Wallet,
                      asset: Scale,
                      addAsset: Scale,
                      expense: Receipt,
                      addExpense: Receipt,
                      steel: Layers,
                      addSteel: Layers,
                      concrete: CircleDot,
                      addConcrete: CircleDot,
                      payment: CreditCard,
                      addPayment: CreditCard,
                      apartment: Home,
                      addApartment: Home,
                      contractor: HardHat,
                      addContractor: HardHat,
                    };

                    const iconColorClasses: Record<string, string> = {
                      primary: 'text-amber-600',
                      amber: 'text-amber-600',
                      success: 'text-emerald-600',
                      emerald: 'text-emerald-600',
                      danger: 'text-rose-600',
                      rose: 'text-rose-600',
                      warning: 'text-orange-500',
                      orange: 'text-orange-500',
                      info: 'text-blue-600',
                      blue: 'text-blue-600',
                      indigo: 'text-indigo-600',
                      purple: 'text-purple-600',
                      slate: 'text-slate-600',
                    };

                    const configuredButtons = (currentUser?.customButtonConfig && currentUser.customButtonConfig.length > 0)
                      ? currentUser.customButtonConfig
                      : DEFAULT_ACTION_BUTTONS;

                    const activeQuickButtons = configuredButtons
                      .filter(b => (b.enabled !== false && b.isEnabled !== false) && (actionHandlers[b.id] || actionHandlers[b.actionKey || b.id]))
                      .sort((a, b) => a.order - b.order);

                    return activeQuickButtons.map(btn => {
                      const handler = actionHandlers[btn.id] || actionHandlers[btn.actionKey || btn.id];
                      const IconComponent = actionIcons[btn.id] || actionIcons[btn.actionKey || btn.id] || Plus;
                      const iconColor = iconColorClasses[btn.color] || 'text-amber-600';
                      const label = language === 'ps' ? (btn.labelPs || btn.labelFa || btn.label || btn.id) : language === 'en' ? (btn.labelEn || btn.label || btn.id) : (btn.labelFa || btn.label || btn.id);

                      return (
                        <button
                          key={btn.id}
                          onClick={() => {
                            setQuickAddOpen(false);
                            handler?.();
                          }}
                          className="w-full text-start px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-2 rtl:space-x-reverse transition-colors"
                        >
                          <IconComponent className={`w-4 h-4 ${iconColor} shrink-0`} />
                          <span className="truncate">
                            {label}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Quick Photo Capture */}
            <div className="hidden lg:block">
              <button
                type="button"
                onClick={() => openCameraForCapture()}
                title={t.captureWithCamera}
                aria-label={t.captureWithCamera}
                className={circleBtn}
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* AI Assistant */}
            {onOpenAiAssistant && aiAccess().allowed && (
              <div className="block">
                <button
                  type="button"
                  onClick={() => onOpenAiAssistant()}
                  title={tp('AI Assistant', 'هوش مصنوعی', 'مصنوعي ځیرکتیا')}
                  aria-label={tp('AI Assistant', 'هوش مصنوعی', 'مصنوعي ځیرکتیا')}
                  className={circleBtn}
                >
                  <Bot className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Help Guide */}
            {onOpenSystemGuide && (
              <div className="hidden lg:block">
                <button
                  type="button"
                  onClick={() => onOpenSystemGuide()}
                  title={tp('Guide', 'راهنما', 'لارښود')}
                  aria-label={tp('Guide', 'راهنما', 'لارښود')}
                  className={circleBtn}
                >
                  <BookOpen className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* More Actions — Google Drive tools */}
            <div ref={moreRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                title={t.actions}
                aria-label={t.actions}
                className={circleBtn}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {moreMenuOpen && (
                <div className="absolute top-full mt-1.5 end-0 w-60 max-w-[85vw] bg-surface rounded-2xl shadow-2xl border border-line py-1.5 z-50 animate-in fade-in zoom-in-95">
                  {/* Google Drive Status & Connection */}
                  <button
                    onClick={() => { setMoreMenuOpen(false); isGoogleDriveConnected ? setActiveTab('documents') : connectGoogleDrive(); }}
                    className="w-full text-start px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-2 rtl:space-x-reverse transition-colors"
                  >
                    <Cloud className={`w-4 h-4 shrink-0 ${isGoogleDriveConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} />
                    <span className="flex-1">{isGoogleDriveConnected ? tp('Google Drive connected', 'Google Drive متصل است', 'Google Drive وصل دی') : tp('Connect Google Drive', 'اتصال به Google Drive', 'له Google Drive سره وصلېدل')}</span>
                    {isGoogleDriveConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                  </button>

                  {/* Google Drive Cloud Storage */}
                  {onOpenDrive && (
                    <button
                      onClick={() => { setMoreMenuOpen(false); onOpenDrive(); }}
                      className="w-full text-start px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-2 rtl:space-x-reverse transition-colors"
                    >
                      <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="flex-1">{tp('Drive', 'درایو', 'ډرایو')}</span>
                      {isGoogleDriveConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Language Selector */}
            <div ref={langRef} className="relative block">
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                title={tp('Language', 'زبان', 'ژبه')}
                className="flex items-center justify-center gap-1 h-9 w-9 sm:w-auto sm:px-3 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-700/70 hover:bg-white dark:hover:bg-slate-700 shadow-xs transition-colors shrink-0"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">
                  {language === 'en' ? 'EN' : language === 'fa' ? 'دری' : 'پښتو'}
                </span>
                <ChevronDown className="hidden sm:block w-3 h-3 text-slate-400" />
              </button>
              {langDropdownOpen && (
                <div className="absolute top-full mt-1.5 end-0 w-36 bg-surface rounded-2xl shadow-2xl border border-line py-1 z-50 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => { setLanguage('en'); setLangDropdownOpen(false); }}
                    className={`w-full text-start px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${language === 'en' ? 'font-bold text-amber-700' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    <span>English</span>
                    {language === 'en' && <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>}
                  </button>
                  <button
                    onClick={() => { setLanguage('fa'); setLangDropdownOpen(false); }}
                    className={`w-full text-start px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${language === 'fa' ? 'font-bold text-amber-700' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    <span>دری</span>
                    {language === 'fa' && <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>}
                  </button>
                  <button
                    onClick={() => { setLanguage('ps'); setLangDropdownOpen(false); }}
                    className={`w-full text-start px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${language === 'ps' ? 'font-bold text-amber-700' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    <span>پښتو</span>
                    {language === 'ps' && <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>}
                  </button>
                </div>
              )}
            </div>

            {/* Day / Night Toggle */}
            <button
              type="button"
              onClick={cycleThemeSchedule}
              title={tp('Day / Night', 'روز / شب', 'ورځ / شپه')}
              aria-label={tp('Day / Night', 'روز / شب', 'ورځ / شپه')}
              className={circleBtn}
            >
              {appSettings.darkMode ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
            </button>

            {/* User Profile Dropdown */}
            <div ref={userRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-1.5 ps-1 pe-2 py-1 rounded-full bg-white/80 dark:bg-slate-700/70 hover:bg-white dark:hover:bg-slate-700 shadow-xs transition-colors"
              >
                <span className="hidden xl:inline max-w-[100px] truncate text-xs font-extrabold tracking-wide text-slate-700 dark:text-slate-100 uppercase">{currentUser?.name}</span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                  currentUser?.role === 'admin' ? 'bg-rose-600' : currentUser?.role === 'accountant' ? 'bg-amber-600' : 'bg-slate-600'
                }`}>
                  {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {userDropdownOpen && (
                <div className="absolute top-full mt-1.5 end-0 w-64 bg-surface rounded-2xl shadow-2xl border border-line py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-line">
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{currentUser?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
                  </div>

                  {(currentUser?.role === 'admin' || currentUser?.isMasterSuperAdmin) && !currentUser?.ownerAdminId && (
                    <div className="px-4 py-2.5 border-b border-line">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center space-x-1 rtl:space-x-reverse">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t.role}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => { switchUserRole('admin'); setUserDropdownOpen(false); }}
                          className={`px-1.5 py-1 text-[11px] rounded-lg font-bold transition-colors ${currentUser?.role === 'admin' ? 'bg-rose-600 text-white' : 'bg-surface-2 text-slate-700 dark:text-slate-300'}`}
                        >
                          {tp('Admin', 'ادمین', 'اډمېن')}
                        </button>
                        <button
                          onClick={() => { switchUserRole('accountant'); setUserDropdownOpen(false); }}
                          className={`px-1.5 py-1 text-[11px] rounded-lg font-bold transition-colors ${currentUser?.role === 'accountant' ? 'bg-amber-600 text-white' : 'bg-surface-2 text-slate-700 dark:text-slate-300'}`}
                        >
                          {tp('Accountant', 'حسابدار', 'محاسب')}
                        </button>
                        <button
                          onClick={() => { switchUserRole('viewer'); setUserDropdownOpen(false); }}
                          className={`px-1.5 py-1 text-[11px] rounded-lg font-bold transition-colors ${currentUser?.role === 'viewer' ? 'bg-slate-700 text-white' : 'bg-surface-2 text-slate-700 dark:text-slate-300'}`}
                        >
                          {tp('Viewer', 'بیننده', 'کتونکی')}
                        </button>
                      </div>
                    </div>
                  )}

                  {(currentUser?.role === 'admin' || currentUser?.isMasterSuperAdmin) && !currentUser?.ownerAdminId && (
                    <>
                      {currentUser?.isMasterSuperAdmin && (
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            setIsMasterAdminOpen(true);
                          }}
                          className="w-full text-start px-4 py-2.5 text-xs text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 flex items-center space-x-2 rtl:space-x-reverse font-black transition-colors border-y border-line bg-gradient-to-l from-violet-500/5 to-indigo-500/5"
                        >
                          <ShieldCheck className="w-4 h-4 text-violet-600 shrink-0" />
                          <span>{tp('Office 7 (office_7)', 'دفتر هفت (office_7)', 'دفتر اووه (office_7)')}</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveTab('users');
                        }}
                        className="w-full text-start px-4 py-2.5 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center space-x-2 rtl:space-x-reverse font-bold transition-colors border-b border-line"
                      >
                        <Users className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{tp('Staff Management', 'مدیریت کارمندان', 'د کارکوونکو مدیریت')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveTab('settings');
                        }}
                        className="w-full text-start px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center space-x-2 rtl:space-x-reverse font-bold transition-colors border-b border-line"
                      >
                        <Sliders className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{t.companySettings}</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-start px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-2 rtl:space-x-reverse font-semibold transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t.logout}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Settings shortcut */}
            <div className="hidden lg:block">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                title={t.companySettings}
                aria-label={t.companySettings}
                className={circleBtn}
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {onOpenMobileMenu && (
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={onOpenMobileMenu}
                  aria-label="Menu"
                  className={circleBtn}
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
        {/* Search Bar */}
        <div ref={searchRef} className="relative mt-2 hidden lg:block">
          <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-black/5 dark:border-white/10">
            <Search className="w-4 h-4 text-slate-400 absolute start-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full ps-11 pe-9 py-2.5 text-sm bg-transparent border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-ink transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute top-full mt-1.5 start-0 w-full bg-surface rounded-2xl shadow-2xl border border-line py-2 z-50 max-h-96 overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 flex items-center justify-between border-b border-line pb-1.5 mb-1">
                <span>{tp(`Found (${totalResultsCount})`, `یافت شده (${totalResultsCount})`, `موندل شوي (${totalResultsCount})`)}</span>
              </div>
              {totalResultsCount === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">{t.noRecords}</div>
              ) : (
                <div className="space-y-1 px-2">
                  {searchResults.expenses.slice(0, 3).map(e => (
                    <div 
                      key={e.id} 
                      onClick={() => { setActiveTab('expenses'); setSearchFocused(false); }}
                      className="p-2 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{e.category}: {e.description}</span>
                      <span className="text-slate-500 font-mono">${e.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {searchResults.apartments.slice(0, 3).map(a => (
                    <div 
                      key={a.id} 
                      onClick={() => { setActiveTab('apartments'); setSearchFocused(false); }}
                      className="p-2 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{tp(`Unit #${a.unitNumber}`, `واحد #${a.unitNumber}`, `واحد #${a.unitNumber}`)}</span>
                      <span className="text-slate-500">{a.buyerName || a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
