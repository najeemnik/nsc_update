/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';
import { MobileMenuDrawer } from './components/MobileMenuDrawer';
import { LoginView } from './components/LoginView';
import { FirstRunSetupView } from './components/FirstRunSetupView';

// Views
import { DashboardView } from './components/views/DashboardView';
import { ProjectsView } from './components/views/ProjectsView';
import { ExpensesView } from './components/views/ExpensesView';
import { SteelView } from './components/views/SteelView';
import { ConcreteView } from './components/views/ConcreteView';
import { ContractorsView } from './components/views/ContractorsView';
import { LaborView } from './components/views/LaborView';
import { SuppliersView } from './components/views/SuppliersView';
import { AssetsView } from './components/views/AssetsView';
import { ApartmentsView } from './components/views/ApartmentsView';
import { PaymentsView } from './components/views/PaymentsView';
import { DocumentsView } from './components/views/DocumentsView';
import { ReportsView } from './components/views/ReportsView';
import { BuilderView } from './components/views/BuilderView';
import { BudgetView } from './components/views/BudgetView';
import { AccountingView } from './components/views/AccountingView';
import { UsersView } from './components/views/UsersView';
import { AuditLogView } from './components/views/AuditLogView';
import { SettingsView } from './components/views/SettingsView';

// Modals
import { NewProjectModal } from './components/modals/NewProjectModal';
import { EditProjectModal } from './components/modals/EditProjectModal';
import { ProjectPartnersModal } from './components/modals/ProjectPartnersModal';
import { ProjectTransferModal } from './components/modals/ProjectTransferModal';
import { AddExpenseModal } from './components/modals/AddExpenseModal';
import { AddSteelModal } from './components/modals/AddSteelModal';
import { AddConcreteModal } from './components/modals/AddConcreteModal';
import { AddContractorModal } from './components/modals/AddContractorModal';
import { AddSupplierModal } from './components/modals/AddSupplierModal';
import { AddApartmentModal } from './components/modals/AddApartmentModal';
import { AddPaymentModal } from './components/modals/AddPaymentModal';
import { AddDocumentModal } from './components/modals/AddDocumentModal';
import { SystemGuideModal } from './components/modals/SystemGuideModal';
import { AddIncomeModal } from './components/modals/AddIncomeModal';
import { AddMaterialModal } from './components/modals/AddMaterialModal';
import { AddLaborModal } from './components/modals/AddLaborModal';
import { AddTransferModal } from './components/modals/AddTransferModal';
import { AddPettyCashModal } from './components/modals/AddPettyCashModal';
import { AddAssetModal } from './components/modals/AddAssetModal';
import { MasterAdminModal } from './components/MasterAdminModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { CameraModal } from './components/CameraModal';
import { PwaManager } from './components/PwaManager';
import { NotificationToasts } from './components/NotificationCenter';
import { Project } from './types';
import { resolveWallpaper, wallpaperLayerStyle } from './utils/projectBranding';

function MainApp() {
  const {
    currentUser,
    users,
    isTestMode,
    isDarkMode, 
    language, tp, 
    isAiAssistantOpen, 
    setIsAiAssistantOpen,
    isMasterAdminOpen,
    setIsMasterAdminOpen,
    isTabAllowed,
    storageError,
    clearStorageError,
    authNotice,
    clearAuthNotice,
    notifySessionExpired,
    logout,
    can,
    denyAccess,
    accessNotice,
    clearAccessNotice,
    currentProject,
    appSettings
  } = useApp();
  const wallpaper = resolveWallpaper(currentProject, {
    backgroundImageUrl: appSettings.backgroundImageUrl,
    backgroundOpacity: appSettings.backgroundOpacity,
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // اطمینان از مجاز بودن تب طبق پرمیژن‌های دفتر هفت
  useEffect(() => {
    if (activeTab !== 'dashboard' && !isTabAllowed(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isTabAllowed]);

  // 🛡 دفتر هفت fast-path: master login lands DIRECTLY inside the panel (no second key)
  const [masterDirectAccess, setMasterDirectAccess] = useState(false);
  useEffect(() => {
    if (!currentUser) {
      setMasterDirectAccess(false);
      return;
    }
    if (currentUser.isMasterSuperAdmin) {
      setMasterDirectAccess(true);
      setIsMasterAdminOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Wave 31: private Office7 entry link (#/office7) — opens the panel only for
  // the master account; everyone else (and logged-out visitors) still faces
  // the login screen, and the panel itself still demands the gate key.
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === '#/office7' && currentUser?.isMasterSuperAdmin) {
        setMasterDirectAccess(true);
        setIsMasterAdminOpen(true);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // نشست مرده سرور (401/403): خروج اجباری + پیام ورود مجدد
  useEffect(() => {
    const onSessionExpired = () => {
      notifySessionExpired();
      logout();
    };
    window.addEventListener('nsc:session-expired', onSessionExpired);
    return () => window.removeEventListener('nsc:session-expired', onSessionExpired);
  }, [notifySessionExpired, logout]);

  // Wave 12: notification deep-links (tab only — payload project is set via context).
  useEffect(() => {
    const VALID_TABS = new Set([
      'dashboard', 'projects', 'apartments', 'expenses', 'payments', 'suppliers',
      'contractors', 'labor', 'steel', 'concrete', 'assets', 'documents',
      'budget', 'accounting', 'reports', 'users', 'settings', 'audit_logs', 'builder',
    ]);
    const onGotoTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab && VALID_TABS.has(tab)) setActiveTab(tab);
    };
    window.addEventListener('nsc:goto-tab', onGotoTab);
    return () => window.removeEventListener('nsc:goto-tab', onGotoTab);
  }, []);

  // دفتر هفت telemetry: log every section a user opens (who, where, when)
  const { trackFeature } = useApp();
  useEffect(() => {
    trackFeature(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Modal visibility states
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [partnersProject, setPartnersProject] = useState<Project | null>(null);
  const [transferProjectData, setTransferProjectData] = useState<Project | null>(null);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddSteelOpen, setIsAddSteelOpen] = useState(false);
  const [isAddConcreteOpen, setIsAddConcreteOpen] = useState(false);
  const [isAddContractorOpen, setIsAddContractorOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddApartmentOpen, setIsAddApartmentOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isAddDocumentOpen, setIsAddDocumentOpen] = useState(false);
  const [isSystemGuideOpen, setIsSystemGuideOpen] = useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isAddLaborOpen, setIsAddLaborOpen] = useState(false);
  const [isAddInterProjectTransferOpen, setIsAddInterProjectTransferOpen] = useState(false);
  const [isAddPettyCashOpen, setIsAddPettyCashOpen] = useState(false);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);

  // Pre-selected payment payee if opened from contractor/supplier card
  const [paymentRecipient, setPaymentRecipient] = useState<{ id: string; name: string } | null>(null);

  // Wave 37 go-live: fresh production (zero users) -> first-run setup, not login.
  if (!isTestMode && users.length === 0) {
    return <FirstRunSetupView />;
  }
  if (!currentUser) {
    return <LoginView />;
  }

  const handleOpenPaymentForPayee = (id: string, name: string) => {
    if (!can('payments', 'create')) { denyAccess('payments', 'create'); return; }
    setPaymentRecipient({ id, name });
    setIsAddPaymentOpen(true);
  };

  // Wave 19: single choke-point for every "new / add" modal opener.
  const openGuarded = (section: string, fn: () => void) => {
    if (can(section, 'create')) fn();
    else denyAccess(section, 'create');
  };

  const isRtl = language === 'fa' || language === 'ps';

  // 🛡 دفتر هفت full-screen mode: hide the ENTIRE construction app — panel is a standalone page
  if (currentUser.isMasterSuperAdmin && isMasterAdminOpen) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="h-dscreen w-full overflow-hidden bg-slate-100">
        <MasterAdminModal
          isOpen={isMasterAdminOpen}
          onClose={() => setIsMasterAdminOpen(false)}
          directAccess={masterDirectAccess}
          fullPage
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-dscreen bg-canvas text-ink flex flex-col"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {wallpaper.url && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 print:hidden" style={wallpaperLayerStyle(wallpaper)} />
      )}
      {authNotice === 'server-lockout' && (
        <div className="relative bg-amber-500 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between gap-3" role="alert">
          <span>
            {tp('Server is temporarily rate-limited (too many login attempts). Local mode works fine — online sync will resume automatically.', 'سرور موقتاً محدود شده است (تلاش ورود زیاد). حالت محلی سالم کار می‌کند — همگام‌سازی آنلاین اتومات برمی‌گردد.', 'سرور په موقتي توګه محدود شوی دی (ډېرې ننوتنې). ځايي حالت سم کار کوي — آنلاین همغږي به په اوتومات ډول بېرته شي.')}
          </span>
          <button type="button" onClick={clearAuthNotice} className="shrink-0 underline hover:no-underline">
            {tp('Dismiss', 'بستن', 'بندول')}
          </button>
        </div>
      )}
      {storageError && (
        <div className="relative bg-red-600 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between gap-3" role="alert">
          <span>
            {tp(`⚠️ Local storage failed (section: ${storageError}). New data may be lost on reload — free browser space or download a JSON backup.`, `⚠️ خطا در ذخیره‌سازی محلی (بخش: ${storageError}). معلومات جدید ممکن است بعد از بستن صفحه از بین برود — حافظه مرورگر را خالی کنید یا یک بکاپ JSON بگیرید.`, `⚠️ په ځايي ذخیره کې تېروتنه (برخه: ${storageError}). نوي معلومات ښايي پاڼه له تړلو وروسته ورک شي — د براوزر حافظه تشه کړئ یا یو JSON بکاپ کښته کړئ.`)}
          </span>
          <button type="button" onClick={clearStorageError} className="shrink-0 underline hover:no-underline">
            {tp('Dismiss', 'بستن', 'بندول')}
          </button>
        </div>
      )}
      {accessNotice && (
        <div className="relative bg-rose-600 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between gap-3" role="alert">
          <span>
            {accessNotice.action === 'expired'
              ? tp('Your session ended: account deactivated or access period finished. Please contact the company owner.', 'نشست شما پایان یافت: حساب غیرفعال شده یا مهلت دسترسی تمام شده است. با مالک شرکت تماس بگیرید.', 'ستاسو ناسته پای ته ورسېده: حساب غیر فعال شوی یا د لاسرسي موده پای ته رسېدلې. د شرکت له مالک سره اړیکه ونیسئ.')
              : tp(`Access denied: you don't have the "${accessNotice.action}" right for "${accessNotice.section}". This attempt was logged.`, `دسترسی رد شد: شما مجوز «${accessNotice.action}» برای بخش «${accessNotice.section}» را ندارید. این تلاش ثبت شد.`, `لاسرسی رد شو: تاسې د «${accessNotice.section}» برخې لپاره د «${accessNotice.action}» اجازه نه لرئ. دا هڅه ثبت شوه.`)}
          </span>
          <button type="button" onClick={clearAccessNotice} className="shrink-0 underline hover:no-underline">
            {tp('Dismiss', 'بستن', 'بندول')}
          </button>
        </div>
      )}
      <div className="relative z-[1] flex flex-1 h-dscreen overflow-hidden">
        {/* Desktop / Tablet Sidebar */}
        <div className="hidden md:flex shrink-0">
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onOpenSystemGuide={() => setIsSystemGuideOpen(true)}
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Navbar */}
          <Navbar 
            onOpenNewProject={() => openGuarded('projects', () => setIsNewProjectOpen(true))}
            setActiveTab={setActiveTab}
            onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            onOpenSystemGuide={() => setIsSystemGuideOpen(true)}
            onOpenAddExpense={() => openGuarded('expenses', () => setIsAddExpenseOpen(true))}
            onOpenAddPayment={() => openGuarded('payments', () => setIsAddPaymentOpen(true))}
            onOpenAddSteel={() => openGuarded('steel', () => setIsAddSteelOpen(true))}
            onOpenAddConcrete={() => openGuarded('concrete', () => setIsAddConcreteOpen(true))}
            onOpenAddApartment={() => openGuarded('apartments', () => setIsAddApartmentOpen(true))}
            onOpenAddContractor={() => openGuarded('contractors', () => setIsAddContractorOpen(true))}
            onOpenAddIncome={() => openGuarded('payments', () => setIsAddIncomeOpen(true))}
            onOpenAddMaterial={() => openGuarded('suppliers', () => setIsAddMaterialOpen(true))}
            onOpenAddLabor={() => openGuarded('labor', () => setIsAddLaborOpen(true))}
            onOpenAddTransfer={() => openGuarded('projects', () => setIsAddInterProjectTransferOpen(true))}
            onOpenAddPettyCash={() => openGuarded('expenses', () => setIsAddPettyCashOpen(true))}
            onOpenAddAsset={() => openGuarded('assets', () => setIsAddAssetOpen(true))}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          />

          {/* Main Tab Content */}
          <main className="flex-1 overflow-y-auto scroll-touch p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
            <div className="max-w-7xl mx-auto">
              {activeTab === 'dashboard' && (
                <DashboardView 
                  onOpenNewProject={() => openGuarded('projects', () => setIsNewProjectOpen(true))}
                  onOpenAddExpense={() => openGuarded('expenses', () => setIsAddExpenseOpen(true))}
                  onOpenAddPayment={() => openGuarded('payments', () => setIsAddPaymentOpen(true))}
                  onOpenAddSteel={() => openGuarded('steel', () => setIsAddSteelOpen(true))}
                  onOpenAddConcrete={() => openGuarded('concrete', () => setIsAddConcreteOpen(true))}
                  onOpenAddApartment={() => openGuarded('apartments', () => setIsAddApartmentOpen(true))}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'projects' && (
                <ProjectsView 
                  onOpenNewProject={() => openGuarded('projects', () => setIsNewProjectOpen(true))}
                  onOpenEditProject={(p) => setEditingProject(p)}
                  onOpenPartners={(p) => setPartnersProject(p)}
                  onOpenTransfer={(p) => setTransferProjectData(p)}
                />
              )}

              {activeTab === 'expenses' && (
                <ExpensesView 
                  onOpenAddExpense={() => openGuarded('expenses', () => setIsAddExpenseOpen(true))}
                />
              )}

              {activeTab === 'steel' && (
                <SteelView 
                  onOpenAddSteel={() => openGuarded('steel', () => setIsAddSteelOpen(true))}
                />
              )}

              {activeTab === 'concrete' && (
                <ConcreteView 
                  onOpenAddConcrete={() => openGuarded('concrete', () => setIsAddConcreteOpen(true))}
                />
              )}

              {activeTab === 'contractors' && (
                <ContractorsView 
                  onOpenAddContractor={() => openGuarded('contractors', () => setIsAddContractorOpen(true))}
                  onOpenAddPayment={handleOpenPaymentForPayee}
                />
              )}

              {activeTab === 'labor' && (
                <LaborView 
                  onOpenAddLabor={() => openGuarded('labor', () => setIsAddLaborOpen(true))}
                />
              )}

              {activeTab === 'suppliers' && (
                <SuppliersView 
                  onOpenAddSupplier={() => openGuarded('suppliers', () => setIsAddSupplierOpen(true))}
                  onOpenAddPayment={handleOpenPaymentForPayee}
                />
              )}

              {activeTab === 'assets' && (
                <AssetsView 
                  onOpenAddAsset={() => openGuarded('assets', () => setIsAddAssetOpen(true))}
                />
              )}

              {activeTab === 'apartments' && (
                <ApartmentsView 
                  onOpenAddApartment={() => openGuarded('apartments', () => setIsAddApartmentOpen(true))}
                />
              )}

              {activeTab === 'payments' && (
                <PaymentsView 
                  onOpenAddPayment={() => openGuarded('payments', () => {
                    setPaymentRecipient(null);
                    setIsAddPaymentOpen(true);
                  })}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetView />
              )}

              {activeTab === 'accounting' && (
                <AccountingView />
              )}

              {activeTab === 'documents' && (
                <DocumentsView 
                  onOpenAddDocument={() => openGuarded('documents', () => setIsAddDocumentOpen(true))}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView />
              )}

              {activeTab === 'builder' && (
                <BuilderView setActiveTab={setActiveTab} />
              )}

              {activeTab === 'users' && (
                <UsersView />
              )}

              {activeTab === 'audit_logs' && (
                <AuditLogView />
              )}

              {activeTab === 'settings' && (
                <SettingsView />
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />
      </div>
      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
      />

      {/* Modals Container */}
      <NewProjectModal 
        isOpen={isNewProjectOpen} 
        onClose={() => setIsNewProjectOpen(false)} 
      />

      {editingProject && (
        <EditProjectModal 
          isOpen={!!editingProject} 
          project={editingProject}
          onClose={() => setEditingProject(null)} 
        />
      )}

      {partnersProject && (
        <ProjectPartnersModal 
          isOpen={!!partnersProject} 
          project={partnersProject}
          onClose={() => setPartnersProject(null)} 
        />
      )}

      {transferProjectData && (
        <ProjectTransferModal 
          isOpen={!!transferProjectData}
          project={transferProjectData}
          onClose={() => setTransferProjectData(null)}
        />
      )}

      <AddExpenseModal 
        isOpen={isAddExpenseOpen} 
        onClose={() => setIsAddExpenseOpen(false)} 
      />

      <AddSteelModal 
        isOpen={isAddSteelOpen} 
        onClose={() => setIsAddSteelOpen(false)} 
      />

      <AddConcreteModal 
        isOpen={isAddConcreteOpen} 
        onClose={() => setIsAddConcreteOpen(false)} 
      />

      <AddContractorModal 
        isOpen={isAddContractorOpen} 
        onClose={() => setIsAddContractorOpen(false)} 
      />

      <AddSupplierModal 
        isOpen={isAddSupplierOpen} 
        onClose={() => setIsAddSupplierOpen(false)} 
      />

      <AddApartmentModal 
        isOpen={isAddApartmentOpen} 
        onClose={() => setIsAddApartmentOpen(false)} 
      />

      <AddPaymentModal 
        isOpen={isAddPaymentOpen} 
        onClose={() => {
          setIsAddPaymentOpen(false);
          setPaymentRecipient(null);
        }} 
      />

      <AddDocumentModal 
        isOpen={isAddDocumentOpen} 
        onClose={() => setIsAddDocumentOpen(false)} 
      />

      <AddIncomeModal
        isOpen={isAddIncomeOpen}
        onClose={() => setIsAddIncomeOpen(false)}
      />

      <AddMaterialModal
        isOpen={isAddMaterialOpen}
        onClose={() => setIsAddMaterialOpen(false)}
      />

      <AddLaborModal
        isOpen={isAddLaborOpen}
        onClose={() => setIsAddLaborOpen(false)}
      />

      <AddTransferModal
        isOpen={isAddInterProjectTransferOpen}
        onClose={() => setIsAddInterProjectTransferOpen(false)}
      />

      <AddPettyCashModal
        isOpen={isAddPettyCashOpen}
        onClose={() => setIsAddPettyCashOpen(false)}
      />

      <AddAssetModal
        isOpen={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
      />



      <SystemGuideModal 
        isOpen={isSystemGuideOpen} 
        onClose={() => setIsSystemGuideOpen(false)} 
      />

      <MasterAdminModal 
        isOpen={isMasterAdminOpen} 
        onClose={() => setIsMasterAdminOpen(false)}
        directAccess={masterDirectAccess}
      />

      <AiAssistantModal 
        isOpen={isAiAssistantOpen} 
        onClose={() => setIsAiAssistantOpen(false)} 
      />

      <CameraModal />

      <PwaManager />
      <NotificationToasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
