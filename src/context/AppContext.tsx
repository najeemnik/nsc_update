import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  Language, 
  User, 
  Project, 
  Expense, 
  SteelRecord, 
  ConcreteRecord, 
  Contractor, 
  Supplier, 
  ApartmentUnit, 
  Payment, 
  PaymentStatus,
  DocumentRecord, 
  AuditLog, 
  ProjectFinancialSummary,
  AppSettings,
  AppTheme,
  ProjectPartner,
  ProjectInvestment,
  ProjectTransferEvent,
  GoogleDriveConfig,
  InstallmentRecord,
  InstallmentPaymentRecord,
  SystemReminderNotification,
  NotificationPrefs,
  JournalEntry,
  AccountBalance,
  TrialBalanceRow,
  ProjectBudget,
  BudgetLineReport,
  UserPermissions,
  UserActivityEvent,
  CustomBillDesign,
  CustomActionButton,
  GrantAction,
  ProjectGrant,
  InterProjectTransfer,
  LaborRecord,
  FixedAsset,
  PartnerEquityTransfer
} from '../types';
import { DEFAULT_NOTIFICATION_PREFS } from '../types';
import { 
  initialUsers, 
  initialProjects, 
  initialContractors, 
  initialSuppliers, 
  initialSteelRecords, 
  initialConcreteRecords, 
  initialExpenses, 
  initialApartments, 
  initialPayments, 
  initialDocuments, 
  initialAuditLogs,
  initialProjectPartners,
  initialProjectInvestments,
  initialProjectBudgets
} from '../data/seedData';
import { translations } from '../i18n/translations';
import { initAuth, googleSignIn, googleSignOut, getAccessToken } from '../services/googleDriveAuth';
import { getOrCreateFolder, uploadFileToGoogleDrive, listGoogleDriveFiles, deleteGoogleDriveFile } from '../services/googleDriveService';
import { calculateInstallmentStatus, normalizeApartmentInstallments, generateSmartReminders, pruneNotifications, type ReminderLang } from '../utils/installmentUtils';
import { buildJournal, computeAccountBalances, buildTrialBalance } from '../utils/journalEngine';
import { getAccount, getAccountName, getFullChart, nextLeafCode, sanitizeCustomAccounts, setCustomAccounts as setRegistryAccounts, accountDeleteBlocker } from '../data/chartOfAccounts';
import type { Account } from '../data/chartOfAccounts';
import { computeBudgetReport, findUpdatableBudgetLine } from '../utils/budgetUtils';
import { isOffice7Theme } from '../utils/configSnapshots';
import { humanizeKey, labelPaymentMethod, labelExpenseCategory, labelUnit, DOC_CATEGORY_TKEY, normalizeLang, type StoredKind } from '../utils/displayLabels';
import { hashPassword, verifyPassword, isPasswordHash } from '../utils/hash';
import { sanitizeLayout, savePublishedLayout, clearDraftLayout } from '../utils/pageBuilder';
import {
  AI_GLOBAL_KEY, AI_LIMITS_KEY, DEFAULT_AI_GLOBAL, checkAiAccess, countUsage, loadUsageLog,
  recordUsage, sanitizeGlobal, sanitizeUserLimits,
  type AiAccessResult, type AiGlobalPolicy, type AiUserLimits,
} from '../utils/aiGovernance';
import type { PageLayout } from '../utils/pageBuilder';
import { canDo, grantedProjectIds } from '../utils/permissions';
import { validateEquityTransfer, applyEquityTransfer } from '../utils/partnerFinance';
import { canonicalMoney, isLockedDoc, expenseReversalMoney, paymentReversalMoney, payUSD } from '../utils/docFinance';
import { backendApi } from '../services/backendApi';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  tx: (kind: StoredKind, value: string | undefined) => string;
  getCompanyDefaultLang: (company?: string) => Language | null;
  aiGlobal: AiGlobalPolicy;
  setAiGlobal: (patch: Partial<AiGlobalPolicy>) => void;
  getUserAiLimits: (userId: string) => AiUserLimits;
  setUserAiLimits: (userId: string, limits: AiUserLimits | null) => void;
  getUserAiUsage: (userId: string) => { today: number; month: number; total: number };
  aiAccess: () => AiAccessResult;
  recordAiUse: () => AiAccessResult;
  aiUsageTick: number;
  setCompanyDefaultLang: (company: string | undefined, lang: Language) => void;
  t: ((key: string) => string) & typeof translations['en'];
  tp: (en: string, fa: string, ps: string) => string;
  currentUser: User | null;
  login: (usernameOrEmail: string, password?: string, loginType?: 'admin' | 'employee', remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  users: User[];
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => { success: boolean; error?: string };
  /** دفتر هفت: per-user usage telemetry (features visited, login/logout moments) */
  activityEvents: UserActivityEvent[];
  trackFeature: (feature: string, label?: string) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  toggleUserActive: (id: string) => void;
  registerCompanyOwner: (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    companyName: string;
    companyAddress: string;
  }) => { success: boolean; otpCode: string; error?: string };
  verifyOtpAndActivate: (email: string, otpCode: string) => { success: boolean; error?: string };
  requestPasswordReset: (email: string) => { success: boolean; otpCode?: string; error?: string };
  completePasswordReset: (email: string, otpCode: string, newPassword: string) => { success: boolean; error?: string };
  changeOwnPassword: (currentPassword: string, newPassword: string) => { success: boolean; error?: string };
  changeOwnUsername: (newUsername: string) => { success: boolean; error?: string };
  bootstrapMasterAdmin: (data: { name: string; username: string; email: string; password: string; companyName: string }) => { success: boolean; error?: string };
  factoryReset: () => { success: boolean; error?: string };
  chargeUserSubscription: (userId: string, durationMonths: number) => void;
  toggleLockUserBySuperAdmin: (userId: string) => void;
  createTenantCompanyOwnerBySuperAdmin: (data: {
    name: string;
    username: string;
    email: string;
    password: string;
    phone: string;
    companyName: string;
    companyAddress?: string;
    subscriptionMonths?: number;
    initialProjectName?: string;
  }) => { success: boolean; user?: User; error?: string };
  createEmployeeAccount: (employee: {
    name: string;
    username: string;
    email: string;
    password: string;
    phone?: string;
    role: 'accountant' | 'viewer';
    permissions: User['permissions'];
  }) => { success: boolean; error?: string };
  updateEmployeeAccount: (employeeId: string, updates: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    permissions?: User['permissions'];
    active?: boolean;
  }) => { success: boolean; error?: string };
  deleteEmployeeAccount: (employeeId: string) => void;
  toggleAiForUser: (userId: string, enabled: boolean) => void;
  updateTenantByMasterAdmin: (userId: string, updates: {
    name?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    companyAddress?: string;
    password?: string;
    customLogoUrl?: string;
    customBillDesign?: CustomBillDesign;
    customButtonConfig?: CustomActionButton[];
    customEnabledModules?: User['customEnabledModules'];
    aiEnabled?: boolean;
    subscriptionExpiresAt?: string;
    isLockedBySuperAdmin?: boolean;
    active?: boolean;
    subscriptionPlan?: User['subscriptionPlan'];
    customTheme?: AppTheme;
    /** Master-level permission merge (tab access, manage flags) */
    permissions?: Partial<UserPermissions>;
    projectGrants?: ProjectGrant[];
    accessExpiresAt?: string;
  }) => { success: boolean; error?: string };
  impersonateTenant: (user: User) => void;
  toggleDarkMode: () => void;
  setTheme: (theme: AppTheme) => void;
  themeSchedule: 'auto' | 'light' | 'dark';
  setThemeSchedule: (mode: 'auto' | 'light' | 'dark') => void;
  setUiScale: (s: 's' | 'm' | 'l') => void;
  cycleThemeSchedule: () => void;
  isTabAllowed: (tabId: string) => boolean;
  /** Wave 19: can current user do `action` on `section` (default project = current)? */
  can: (section: string, action: GrantAction, projectId?: string) => boolean;
  /** Wave 19: record + surface an access denial. */
  denyAccess: (section: string, action: GrantAction) => void;
  /** Wave 19: window.print() only with the print grant, else deny + toast. */
  printIfAllowed: (section: string) => void;
  /** Wave 19: projects the current user may open. */
  grantedProjects: Project[];
  accessNotice: { section: string; action: string; at: number } | null;
  clearAccessNotice: () => void;
  approveExpense: (id: string) => void;
  rejectExpense: (id: string) => void;
  postExpense: (id: string) => void;
  unpostExpense: (id: string) => void;
  reverseExpense: (id: string, note?: string) => void;
  postPayment: (id: string) => void;
  unpostPayment: (id: string) => void;
  reversePayment: (id: string, note?: string) => void;
  updateReportCustomization: (updates: Partial<import('../types').ReportCustomization>) => void;
  uploadCustomReportTemplate: (fileName: string, fileContent: string) => void;
  projects: Project[];
  currentProject: Project | null;
  setCurrentProjectId: (id: string) => void;
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  transferProject: (transferData: Omit<import('../types').ProjectTransferEvent, 'id' | 'createdAt'>) => import('../types').ProjectTransferEvent;
  projectPartners: ProjectPartner[];
  projectInvestments: ProjectInvestment[];
  addProjectPartner: (partner: Omit<ProjectPartner, 'id' | 'createdAt'>) => ProjectPartner;
  updateProjectPartner: (id: string, updates: Partial<ProjectPartner>) => void;
  deleteProjectPartner: (id: string) => void;
  addProjectInvestment: (investment: Omit<ProjectInvestment, 'id' | 'createdAt'>) => ProjectInvestment;
  updateProjectInvestment: (id: string, updates: Partial<ProjectInvestment>) => void;
  deleteProjectInvestment: (id: string) => void;
  partnerEquityTransfers: PartnerEquityTransfer[];
  transferPartnerEquity: (transfer: Omit<PartnerEquityTransfer, 'id' | 'createdAt'>) => { success: boolean; error?: string; record?: PartnerEquityTransfer };
  interProjectTransfers: InterProjectTransfer[];
  requestInterProjectTransfer: (t: Omit<InterProjectTransfer, 'id' | 'createdAt' | 'status'>) => { success: boolean; error?: string; record?: InterProjectTransfer };
  approveInterProjectTransfer: (id: string) => void;
  rejectInterProjectTransfer: (id: string) => void;
  getProjectPartners: (projectId: string) => ProjectPartner[];
  getProjectInvestments: (projectId: string) => ProjectInvestment[];
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'createdBy'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  getExpensePayments: (expenseId: string) => Payment[];
  steelRecords: SteelRecord[];
  addSteelRecord: (record: Omit<SteelRecord, 'id' | 'tons' | 'totalAmount' | 'remainingBalance' | 'createdAt'>) => void;
  updateSteelRecord: (id: string, updates: Partial<SteelRecord>) => void;
  deleteSteelRecord: (id: string) => void;
  concreteRecords: ConcreteRecord[];
  addConcreteRecord: (record: Omit<ConcreteRecord, 'id' | 'totalAmount' | 'remainingBalance' | 'createdAt'>) => void;
  updateConcreteRecord: (id: string, updates: Partial<ConcreteRecord>) => void;
  deleteConcreteRecord: (id: string) => void;
  contractors: Contractor[];
  addContractor: (contractor: Omit<Contractor, 'id' | 'createdAt'>) => void;
  updateContractor: (id: string, updates: Partial<Contractor>) => void;
  deleteContractor: (id: string) => void;
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  laborRecords: LaborRecord[];
  addLaborRecord: (record: Omit<LaborRecord, 'id' | 'createdAt'>) => void;
  deleteLaborRecord: (id: string) => void;
  assets: FixedAsset[];
  addAsset: (asset: Omit<FixedAsset, 'id' | 'createdAt'>) => void;
  updateAsset: (id: string, updates: Partial<FixedAsset>) => void;
  deleteAsset: (id: string) => void;
  apartments: ApartmentUnit[];
  addApartment: (unit: Omit<ApartmentUnit, 'id' | 'salePrice' | 'remainingBalance' | 'createdAt'> & { salePrice?: number }) => void;
  updateApartment: (id: string, updates: Partial<ApartmentUnit>) => void;
  deleteApartment: (id: string) => void;
  addInstallmentPayment: (apartmentId: string, installmentId: string, amount: number, paymentMethod?: string, receiptNumber?: string, notes?: string) => void;
  updateInstallment: (apartmentId: string, installmentId: string, updates: Partial<InstallmentRecord>) => void;
  addInstallmentToApartment: (apartmentId: string, installmentData: Omit<InstallmentRecord, 'id' | 'remainingAmount' | 'status' | 'paymentHistory'>) => void;
  deleteInstallment: (apartmentId: string, installmentId: string) => void;
  // Wave 12: full notification center (revives the Wave-1 stub).
  notifications: SystemReminderNotification[];
  unreadNotificationCount: number;
  notificationPrefs: NotificationPrefs;
  markNotificationRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearReadNotifications: () => void;
  setNotificationPrefs: (patch: Partial<NotificationPrefs>) => void;
  builderRev: number;
  publishPageLayout: (pageKey: string, layout: PageLayout) => void;
  payments: Payment[];
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt' | 'createdBy'>) => void;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  appSettings: AppSettings;
  updateAppSettings: (updates: Partial<AppSettings>) => void;
  debtorParties: Array<{
    partyName: string;
    category: string;
    relatedType: 'contractor' | 'supplier' | 'steel' | 'concrete' | 'expense' | 'material_steel' | 'material_concrete';
    relatedId: string;
    debtAmount: number;
    title: string;
  }>;
  documents: DocumentRecord[];
  addDocument: (doc: Omit<DocumentRecord, 'id' | 'createdAt'>) => void;
  updateDocument: (id: string, updates: Partial<DocumentRecord>) => void;
  deleteDocument: (id: string) => void;
  auditLogs: AuditLog[];
  logAudit: (
    action: 'create' | 'update' | 'delete' | 'login' | string,
    entityType: AuditLog['entityType'],
    entityId: string,
    recordTitle: string,
    details: string,
    previousValue?: string,
    newValue?: string,
    projId?: string
  ) => void;
  currentFinancials: ProjectFinancialSummary;
  getProjectFinancials: (projectId: string) => ProjectFinancialSummary;
  /**
   * Accounting layer (Chart of Accounts). The double-entry journal is a
   * pure projection derived from the business records — it is rebuilt
   * automatically whenever expenses/steel/concrete/payments/apartments/
   * investments change, so it can never drift out of sync with the UI data.
   */
  chartOfAccounts: Account[];
  // Wave 17: admin-managed custom COA sub-accounts (5xxx trades only).
  customAccounts: Account[];
  addCustomAccount: (input: { parentCode: string; nameFa: string; nameEn?: string; namePs?: string; isBudgetMinor?: boolean }) => { success: boolean; error?: string; account?: Account };
  updateCustomAccount: (code: string, updates: { nameFa?: string; nameEn?: string; namePs?: string; isBudgetMinor?: boolean }) => { success: boolean; error?: string };
  deleteCustomAccount: (code: string) => { success: boolean; error?: string };
  getAccountDisplayName: (code: string, lang?: Language) => string;
  journalEntries: JournalEntry[];
  accountBalances: AccountBalance[];
  getAccountBalance: (accountCode: string, projectId?: string) => AccountBalance | undefined;
  getTrialBalance: (projectId?: string) => { rows: TrialBalanceRow[]; totalDebitUSD: number; totalCreditUSD: number };
  getProjectJournal: (projectId: string) => JournalEntry[];
  /** Project Budget: one budget line per (project, COA account) */
  projectBudgets: ProjectBudget[];
  getProjectBudgets: (projectId: string) => ProjectBudget[];
  getBudgetReport: (projectId: string) => BudgetLineReport[];
  addProjectBudget: (budget: Omit<ProjectBudget, 'id' | 'createdAt' | 'createdBy'>) => void;
  updateProjectBudget: (id: string, updates: Partial<ProjectBudget>) => void;
  deleteProjectBudget: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: {
    projects: Project[];
    contractors: Contractor[];
    suppliers: Supplier[];
    apartments: ApartmentUnit[];
    expenses: Expense[];
    steel: SteelRecord[];
    concrete: ConcreteRecord[];
    payments: Payment[];
  };
  cameraModalOpen: boolean;
  setCameraModalOpen: (open: boolean) => void;
  cameraTargetData: { title?: string; relatedType?: string; relatedId?: string; amount?: number } | null;
  openCameraForCapture: (target?: { title?: string; relatedType?: string; relatedId?: string; amount?: number }) => void;
  saveCameraPhotoAsDocument: (photoDataUrl: string, title: string, amount?: number) => void;
  isApartmentsUnlocked: boolean;
  unlockApartments: (password: string) => boolean;
  lockApartments: () => void;
  isSectionProtected: (sectionId: string) => boolean;
  isSectionUnlocked: (sectionId: string) => boolean;
  unlockSection: (sectionId: string, passwordAttempt: string) => boolean;
  lockSection: (sectionId: string) => void;
  setSectionPassword: (sectionId: string, newPassword: string, isEnabled?: boolean) => void;
  clearSampleData: () => void;
  isTestMode: boolean;
  enterTestMode: () => void;
  exitTestMode: () => void;
  wipeTestData: () => void;
  exportJsonBackup: () => { success: boolean; error?: string };
  restoreJsonBackup: (jsonContent: string) => { success: boolean; error?: string };
  exportBackupJSON: () => { success: boolean; error?: string };
  /** نام بخش ذخیره‌سازی ناموفق (null = سالم) — نمایش بنر هشدار در MainApp */
  storageError: string | null;
  clearStorageError: () => void;
  /** اطلاع امنیتی نشست: منقضی‌شده (خروج اجباری) یا قفل موقت سرور (429) */
  authNotice: 'session-expired' | 'server-lockout' | 'server-locked' | null;
  serverSync: { status: 'unknown' | 'checking' | 'ok' | 'no-token' | 'outdated' | 'offline'; lastSyncAt: string | null; lastError: string | null; pendingCount: number };
  refreshServerSyncStatus: () => Promise<void>;
  syncAllUsersToServer: () => Promise<{ pushed: number; queued: number; failed: number; firstError?: string }>;
  clearAuthNotice: () => void;
  notifySessionExpired: () => void;
  importBackupJSON: (json: any) => void;
  clearAuditLogs: () => void;
  formatCurrency: (amount: number | undefined, currency?: string) => string;
  formatNumber: (value: number | undefined, decimals?: number) => string;
  isDarkMode: boolean;
  // Google Drive integration
  isGoogleDriveConnected: boolean;
  googleDriveUserEmail: string | null;
  googleUser: { displayName?: string; email?: string } | null;
  connectGoogleDrive: () => Promise<any>;
  disconnectGoogleDrive: () => Promise<void>;
  backupToGoogleDrive: () => Promise<any>;
  uploadDocumentToGoogleDrive: (docId: string) => Promise<{ success: boolean; link?: string; error?: string }>;
  uploadDocumentToDrive: (doc: DocumentRecord) => Promise<any>;
  restoreFromGoogleDrive: (fileId: string) => Promise<any>;
  isAiAssistantOpen: boolean;
  setIsAiAssistantOpen: (open: boolean) => void;
  isMasterAdminOpen: boolean;
  setIsMasterAdminOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Wave 35: separate test version — own localStorage namespace, empty data, no-login demo user.
const TEST_MODE_KEY = 'nsc_test_mode';
// Wave 37 go-live: production builds start with ZERO seed data (no demo users,
// no sample transactions). Dev builds keep seeds for development. Fresh
// production shows the first-run setup screen (bootstrapMasterAdmin).
export const isTestModeActive = (): boolean => {
  try { return localStorage.getItem(TEST_MODE_KEY) === '1'; } catch { return false; }
};
const TEST_MODE = isTestModeActive();
const EMPTY_SEED = import.meta.env.PROD === true;

// Audit fix: local-login brute-force throttle (5 fails -> 60s lockout, per username).
const LOGIN_FAIL_PREFIX = 'nsc_login_fails_';
const readLoginFails = (key: string): { n: number; until: number } => {
  try {
    const raw = localStorage.getItem(LOGIN_FAIL_PREFIX + key);
    if (raw) { const o = JSON.parse(raw); return { n: Number(o.n) || 0, until: Number(o.until) || 0 }; }
  } catch { /* ignore */ }
  return { n: 0, until: 0 };
};
const writeLoginFails = (key: string, n: number, until: number): void => {
  try { localStorage.setItem(LOGIN_FAIL_PREFIX + key, JSON.stringify({ n, until })); } catch { /* ignore */ }
};
const OTP_TTL_MS = 10 * 60 * 1000;
const isOtpExpired = (issuedAt?: string): boolean => {
  if (!issuedAt) return true;
  const ms = new Date(issuedAt).getTime();
  return Number.isNaN(ms) || (Date.now() - ms) > OTP_TTL_MS;
};
const TEST_PREFIX = 'nik_smart_count_test_';
const STORAGE_PREFIX = TEST_MODE ? TEST_PREFIX : 'nik_smart_count_';

const TEST_USER: User = {
  id: 'user-test',
  username: 'tester',
  email: 'tester@test.local',
  name: 'Test User',
  phone: '',
  role: 'admin',
  active: true,
  verified: true,
  createdAt: new Date().toISOString(),
};

const TEST_PROJECT: Project = {
  id: 'test-p1',
  name: 'Test Project',
  code: 'TEST-001',
  address: '',
  city: 'Kabul',
  landInfo: '',
  floors: 0,
  units: 0,
  buildingArea: 0,
  status: 'planning',
  description: 'Playground project for the test version (empty data).',
  currency: 'USD',
  defaultExchangeRate: 70,
  createdAt: new Date().toISOString(),
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + key);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(`Failed to load ${key} from storage`, e);
  }
  return fallback;
}

function saveToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Failed to save ${key} to storage`, e);
    return false;
  }
}

// Wave 38 remember-me: the session user lives in localStorage when "remember"
// is checked, otherwise in sessionStorage (dies with the tab — nothing is
// kept in the browser). All currentUser writes go through these helpers.
function loadCurrentUser(): User | null {
  try {
    const local = localStorage.getItem(STORAGE_PREFIX + 'currentUser');
    if (local) return JSON.parse(local);
  } catch { /* fall through to session */ }
  try {
    const sess = sessionStorage.getItem(STORAGE_PREFIX + 'currentUser');
    if (sess) return JSON.parse(sess);
  } catch { /* ignore */ }
  return null;
}
function saveCurrentUser(u: User | null, remember?: boolean): void {
  const key = STORAGE_PREFIX + 'currentUser';
  let useSession: boolean;
  if (remember === undefined) {
    try { useSession = !!sessionStorage.getItem(key); }
    catch { useSession = false; }
  } else {
    useSession = !remember;
  }
  try {
    if (useSession) {
      localStorage.removeItem(key);
      if (u) sessionStorage.setItem(key, JSON.stringify(u));
      else sessionStorage.removeItem(key);
    } else {
      sessionStorage.removeItem(key);
      saveToStorage('currentUser', u);
    }
  } catch { /* ignore */ }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return normalizeLang(loadFromStorage<Language>('lang', 'en'));
  });
  const [users, setUsers] = useState<User[]>(() => loadFromStorage('users', TEST_MODE ? [TEST_USER] : (EMPTY_SEED ? [] : initialUsers)));
  const [accessNotice, setAccessNotice] = useState<{ section: string; action: string; at: number } | null>(null);
  const clearAccessNotice = () => setAccessNotice(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (TEST_MODE) return TEST_USER;
    return loadCurrentUser();
  });
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage('projects', TEST_MODE ? [TEST_PROJECT] : (EMPTY_SEED ? [] : initialProjects)));
  const [currentProjectId, setCurrentProjectIdState] = useState<string>(() => loadFromStorage('currentProjId', TEST_MODE ? TEST_PROJECT.id : (EMPTY_SEED ? '' : (initialProjects[0]?.id || ''))));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage('expenses', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialExpenses)));
  const [steelRecords, setSteelRecords] = useState<SteelRecord[]>(() => loadFromStorage('steel', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialSteelRecords)));
  const [concreteRecords, setConcreteRecords] = useState<ConcreteRecord[]>(() => loadFromStorage('concrete', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialConcreteRecords)));
  const [contractors, setContractors] = useState<Contractor[]>(() => loadFromStorage('contractors', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialContractors)));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromStorage('suppliers', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialSuppliers)));
  const [apartments, setApartments] = useState<ApartmentUnit[]>(() => loadFromStorage('apartments', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialApartments)));
  const initialLaborRecords: LaborRecord[] = [
    {
      id: 'lab-1',
      projectId: 'p1',
      workerName: 'استاد رحیم گل‌کار',
      role: 'گل‌کار و سنگ‌کار نما',
      phone: '0789123456',
      workPeriod: 'ماه جاری',
      daysWorked: 26,
      dailyRate: 1200,
      grossWage: 31200,
      advanceDeduction: 5000,
      netPayable: 26200,
      paymentStatus: 'paid',
      paidDate: '2026-09-30',
      approvedBy: 'مهندس ناظر پروژه',
      notes: 'تکمیل سنگ‌کاری دیوارهای لابی',
      createdAt: new Date().toISOString()
    },
    {
      id: 'lab-2',
      projectId: 'p1',
      workerName: 'شیرخان آرماتوربند',
      role: 'سرکارگر بافت میلگرد',
      phone: '0772345678',
      workPeriod: 'ماه جاری',
      daysWorked: 24,
      dailyRate: 1100,
      grossWage: 26400,
      advanceDeduction: 4000,
      netPayable: 22400,
      paymentStatus: 'paid',
      paidDate: '2026-09-30',
      approvedBy: 'مهندس ناظر پروژه',
      notes: 'آرماتوربندی سقف طبقه ۳',
      createdAt: new Date().toISOString()
    },
    {
      id: 'lab-3',
      projectId: 'p1',
      workerName: 'غلام‌حیدر کارگر ساده',
      role: 'تخلیه مصالح و بتن‌ریزی',
      phone: '0798765432',
      workPeriod: 'ماه جاری',
      daysWorked: 28,
      dailyRate: 600,
      grossWage: 16800,
      advanceDeduction: 3000,
      netPayable: 13800,
      paymentStatus: 'pending',
      approvedBy: 'سرپرست کارگاه',
      notes: 'کمک در تخلیه سیمان و نظافت',
      createdAt: new Date().toISOString()
    }
  ];

  const initialAssets: FixedAsset[] = [
    {
      id: 'ast-1',
      assetTag: 'AST-101',
      name: 'تاور کرین ۶۰ متر لیبهر (Liebherr)',
      category: 'machinery',
      assignedProjectId: 'p1',
      purchaseDate: '2024-03-15',
      purchaseCost: 85000,
      salvageValue: 15000,
      usefulLifeYears: 8,
      monthlyDepreciation: 729,
      accumulatedDepreciation: 21870,
      currentBookValue: 63130,
      runningHours: 1420,
      hourlyOperatingRate: 25,
      serialNumber: 'LH-60EC-9921',
      assignedPerson: 'استاد صمد جرثقیل‌ران',
      status: 'active',
      notes: 'سرویس دوره‌ای سیم بکسل و هیدرولیک انجام شد',
      createdAt: new Date().toISOString()
    },
    {
      id: 'ast-2',
      assetTag: 'AST-102',
      name: 'پمپ کانکریت هوایی ۳۶ متری شوئینگ',
      category: 'machinery',
      assignedProjectId: 'p1',
      purchaseDate: '2024-06-10',
      purchaseCost: 120000,
      salvageValue: 20000,
      usefulLifeYears: 10,
      monthlyDepreciation: 833,
      accumulatedDepreciation: 22491,
      currentBookValue: 97509,
      runningHours: 980,
      hourlyOperatingRate: 40,
      serialNumber: 'SCH-36B-5510',
      assignedPerson: 'انجنیر حمید پمپ‌چی',
      status: 'active',
      notes: 'لوله و بست‌های خروجی در وضعیت عالی',
      createdAt: new Date().toISOString()
    },
    {
      id: 'ast-3',
      assetTag: 'AST-103',
      name: 'دیزل جنراتور ۲۵۰ کاوا کامینز سایلنت',
      category: 'equipment',
      assignedProjectId: 'p1',
      purchaseDate: '2024-08-01',
      purchaseCost: 22000,
      salvageValue: 4000,
      usefulLifeYears: 6,
      monthlyDepreciation: 250,
      accumulatedDepreciation: 6250,
      currentBookValue: 15750,
      runningHours: 2150,
      hourlyOperatingRate: 15,
      serialNumber: 'CUM-250S-8812',
      assignedPerson: 'مسئول برق کارگاه',
      status: 'active',
      notes: 'تأمین برق اضطراری و موتور جوش‌ها',
      createdAt: new Date().toISOString()
    },
    {
      id: 'ast-4',
      assetTag: 'AST-104',
      name: 'لفت و بالابر مصالح ۱ تنی کارگاهی',
      category: 'equipment',
      assignedProjectId: 'p1',
      purchaseDate: '2025-01-10',
      purchaseCost: 7500,
      salvageValue: 1000,
      usefulLifeYears: 5,
      monthlyDepreciation: 108,
      accumulatedDepreciation: 2160,
      currentBookValue: 5340,
      runningHours: 3200,
      hourlyOperatingRate: 8,
      serialNumber: 'HST-1T-4029',
      assignedPerson: 'سرپرست کارگاه',
      status: 'maintenance',
      notes: 'تعویض لنت ترمز و میکروسوئیچ ایمنی طبقات',
      createdAt: new Date().toISOString()
    }
  ];

  const [assets, setAssets] = useState<FixedAsset[]>(() => loadFromStorage('assets', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialAssets)));
  const [laborRecords, setLaborRecords] = useState<LaborRecord[]>(() => loadFromStorage('labor', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialLaborRecords)));
  const [payments, setPayments] = useState<Payment[]>(() => loadFromStorage('payments', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialPayments)));
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => loadFromStorage('documents', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialDocuments)));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadFromStorage('auditLogs', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialAuditLogs)));
  const [activityEvents, setActivityEvents] = useState<UserActivityEvent[]>(() => loadFromStorage('activityEvents', []));
  const [notifications, setNotifications] = useState<SystemReminderNotification[]>(() => loadFromStorage('notifications', []));
  const [customAccounts, setCustomAccountsState] = useState<Account[]>(() => {
    const clean = sanitizeCustomAccounts(loadFromStorage('customAccounts', []));
    setRegistryAccounts(clean);
    return clean;
  });
  // Wave 32: bumped on every builder publish so live pages re-resolve layouts.
  const [builderRev, setBuilderRev] = useState(0);
  // Wave 34: AI governance — global policy + per-user overrides + usage tick.
  const [aiGlobal, setAiGlobalState] = useState<AiGlobalPolicy>(() => {
    try {
      const raw = localStorage.getItem(AI_GLOBAL_KEY);
      return sanitizeGlobal(raw ? JSON.parse(raw) : DEFAULT_AI_GLOBAL);
    } catch {
      return { ...DEFAULT_AI_GLOBAL };
    }
  });
  const [aiLimitsMap, setAiLimitsMap] = useState<Record<string, AiUserLimits>>(() => {
    try {
      const raw = localStorage.getItem(AI_LIMITS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const out: Record<string, AiUserLimits> = {};
      for (const [k, v] of Object.entries(parsed)) out[k.slice(0, 64)] = sanitizeUserLimits(v);
      return out;
    } catch {
      return {};
    }
  });
  const [aiUsageTick, setAiUsageTick] = useState(0);
  const [notificationPrefs, setNotificationPrefsState] = useState<NotificationPrefs>(() => {
    const loaded = loadFromStorage<Partial<NotificationPrefs>>('notificationPrefs', {});
    return {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...loaded,
      categories: { ...DEFAULT_NOTIFICATION_PREFS.categories, ...(loaded.categories || {}) },
    };
  });
  const [projectPartners, setProjectPartners] = useState<ProjectPartner[]>(() => loadFromStorage('projectPartners', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialProjectPartners)));
  const [projectInvestments, setProjectInvestments] = useState<ProjectInvestment[]>(() => loadFromStorage('projectInvestments', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialProjectInvestments)));
  const [partnerEquityTransfers, setPartnerEquityTransfers] = useState<PartnerEquityTransfer[]>(() => loadFromStorage('partnerEquityTransfers', []));
  const [interProjectTransfers, setInterProjectTransfers] = useState<InterProjectTransfer[]>(() => loadFromStorage('interProjectTransfers', []));
  const [projectBudgets, setProjectBudgets] = useState<ProjectBudget[]>(() => loadFromStorage('projectBudgets', TEST_MODE ? [] : (EMPTY_SEED ? [] : initialProjectBudgets)));

  // Google Drive state (in-memory token cached in googleDriveAuth)
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState<boolean>(false);
  const [googleDriveUserEmail, setGoogleDriveUserEmail] = useState<string | null>(null);

  // Initialize Firebase Auth listener for Google Workspace
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setIsGoogleDriveConnected(true);
        setGoogleDriveUserEmail(user.email);
      },
      () => {
        setIsGoogleDriveConnected(false);
        setGoogleDriveUserEmail(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const connectGoogleDrive = async (): Promise<boolean> => {
    try {
      const res = await googleSignIn();
      if (res) {
        setIsGoogleDriveConnected(true);
        setGoogleDriveUserEmail(res.user.email);
        logAudit('login', 'user', res.user.uid, `Connected Google Drive (${res.user.email})`, 'Google Drive OAuth Authorized');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Google Drive connection failed:', err);
      return false;
    }
  };

  const disconnectGoogleDrive = async (): Promise<void> => {
    await googleSignOut();
    setIsGoogleDriveConnected(false);
    setGoogleDriveUserEmail(null);
    logAudit('update', 'user', 'gdrive', 'Disconnected Google Drive', 'User signed out from Google Drive');
  };

  // خطای ذخیره‌سازی محلی (QuotaExceeded / حالت خصوصی مرورگر) — باید مرئی باشد (§2.7)
  const [storageError, setStorageError] = useState<string | null>(null);
  const clearStorageError = () => setStorageError(null);
  const [authNotice, setAuthNotice] = useState<'session-expired' | 'server-lockout' | 'server-locked' | null>(null);
  const [serverSync, setServerSync] = useState<{ status: 'unknown' | 'checking' | 'ok' | 'no-token' | 'outdated' | 'offline'; lastSyncAt: string | null; lastError: string | null; pendingCount: number }>({
    status: 'unknown', lastSyncAt: null, lastError: null, pendingCount: 0,
  });
  const clearAuthNotice = () => setAuthNotice(null);

  // Sync to local storage
  useEffect(() => { if (!saveToStorage('users', users)) { setStorageError('users'); } }, [users]);
  useEffect(() => { if (!saveToStorage('projects', projects)) { setStorageError('projects'); } }, [projects]);
  useEffect(() => { if (!saveToStorage('currentProjId', currentProjectId)) { setStorageError('currentProjId'); } }, [currentProjectId]);
  useEffect(() => { if (!saveToStorage('expenses', expenses)) { setStorageError('expenses'); } }, [expenses]);
  useEffect(() => { if (!saveToStorage('steel', steelRecords)) { setStorageError('steel'); } }, [steelRecords]);
  useEffect(() => { if (!saveToStorage('concrete', concreteRecords)) { setStorageError('concrete'); } }, [concreteRecords]);
  useEffect(() => { if (!saveToStorage('contractors', contractors)) { setStorageError('contractors'); } }, [contractors]);
  useEffect(() => { if (!saveToStorage('suppliers', suppliers)) { setStorageError('suppliers'); } }, [suppliers]);
  useEffect(() => { if (!saveToStorage('labor', laborRecords)) { setStorageError('labor'); } }, [laborRecords]);
  useEffect(() => { if (!saveToStorage('assets', assets)) { setStorageError('assets'); } }, [assets]);
  useEffect(() => { if (!saveToStorage('apartments', apartments)) { setStorageError('apartments'); } }, [apartments]);
  useEffect(() => { if (!saveToStorage('payments', payments)) { setStorageError('payments'); } }, [payments]);
  useEffect(() => { if (!saveToStorage('documents', documents)) { setStorageError('documents'); } }, [documents]);
  useEffect(() => { if (!saveToStorage('auditLogs', auditLogs)) { setStorageError('auditLogs'); } }, [auditLogs]);
  useEffect(() => { if (!saveToStorage('activityEvents', activityEvents.slice(-600))) { setStorageError('activityEvents'); } }, [activityEvents]);
  useEffect(() => { if (!saveToStorage('notifications', notifications.slice(-150))) { setStorageError('notifications'); } }, [notifications]);
  useEffect(() => { if (!saveToStorage('notificationPrefs', notificationPrefs)) { setStorageError('notificationPrefs'); } }, [notificationPrefs]);
  useEffect(() => { if (!saveToStorage('customAccounts', customAccounts)) { setStorageError('customAccounts'); } }, [customAccounts]);
  useEffect(() => { if (!saveToStorage('projectPartners', projectPartners)) { setStorageError('projectPartners'); } }, [projectPartners]);
  useEffect(() => { if (!saveToStorage('projectInvestments', projectInvestments)) { setStorageError('projectInvestments'); } }, [projectInvestments]);
  useEffect(() => { if (!saveToStorage('partnerEquityTransfers', partnerEquityTransfers)) { setStorageError('partnerEquityTransfers'); } }, [partnerEquityTransfers]);
  useEffect(() => { if (!saveToStorage('interProjectTransfers', interProjectTransfers)) { setStorageError('interProjectTransfers'); } }, [interProjectTransfers]);
  useEffect(() => { if (!saveToStorage('projectBudgets', projectBudgets)) { setStorageError('projectBudgets'); } }, [projectBudgets]);

  const isCurrentTimeDay = (): boolean => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19;
  };

  const defaultAppSettings: AppSettings = {
    companyName: 'شرکت ساختمانی احمد شاه',
    companySubtitle: 'سیستم جامع مدیریت پروژه‌ها و حسابداری بلندمنزل',
    logoUrl: '/assets/logo.png',
    receiptHeader: 'شرکت ساختمانی احمد شاه - سند رسمی پرداخت و رسید',
    receiptFooter: 'این سند صرف با مهر و امضای رسمی اداره معتبر می‌باشد.',
    receiptContact: '0093783788278 / info@nik-smartcount.com',
    theme: 'glassmorphism',
    darkMode: !isCurrentTimeDay(),
    themeSchedule: 'auto',
    backgroundImageUrl: '',
    backgroundOpacity: 12,
    customCategories: [],
    aiEnabled: true,
    googleDrive: {
      connected: false,
    },
    sectionProtection: {
      passwords: {
        apartments: '22277512',
        expenses: '',
        payments: '',
        steel: '',
        concrete: '',
        contractors: '',
        suppliers: '',
        reports: '',
        auditLogs: '',
        documents: '',
      },
      enabled: {
        apartments: true,
        expenses: false,
        payments: false,
        steel: false,
        concrete: false,
        contractors: false,
        suppliers: false,
        reports: false,
        auditLogs: false,
        documents: false,
      }
    },
    reportCustomization: {
      style: 'classic',
      showLogo: true,
      showSignatures: true,
      signature1Title: 'مسؤول مالی و محاسب',
      signature2Title: 'انجنیر ساحه و نظارت',
      signature3Title: 'رئیس عمومی شرکت',
      headerNote: 'گزارش رسمی مصارف و عواید ساختمانی',
      footerNote: 'تمامی ارقام و محاسبات با اسناد دست‌داشته و دفاتر رسمی مطابقت دارد.',
      watermarkText: '',
    }
  };

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const loaded = loadFromStorage<AppSettings>('appSettings', defaultAppSettings);
    const validThemes = ['glassmorphism', 'neumorphism', 'skeuomorphism', 'squirclemorphism', 'metalmorphism', 'ar_morphism'];
    const currentSchedule = loaded.themeSchedule || 'auto';
    const computedDark = currentSchedule === 'auto' ? !isCurrentTimeDay() : (loaded.darkMode ?? false);
    return {
      ...defaultAppSettings,
      ...loaded,
      theme: validThemes.includes(loaded.theme) ? loaded.theme : 'glassmorphism',
      logoUrl: loaded.logoUrl || '/assets/logo.png',
      darkMode: computedDark,
      themeSchedule: currentSchedule,
      sectionProtection: loaded.sectionProtection || defaultAppSettings.sectionProtection,
      reportCustomization: loaded.reportCustomization || defaultAppSettings.reportCustomization,
    };
  });

  // Persist app settings (theme, dark mode, branding, rates, ...) so the
  // anti-FOUC script in index.html and the next visit can restore them.
  useEffect(() => { if (!saveToStorage('appSettings', appSettings)) { setStorageError('appSettings'); } }, [appSettings]);

  useEffect(() => {
    if (appSettings.themeSchedule === 'auto') {
      const isNight = !isCurrentTimeDay();
      if (appSettings.darkMode !== isNight) {
        setAppSettings(prev => ({ ...prev, darkMode: isNight }));
      }
      const interval = setInterval(() => {
        const night = !isCurrentTimeDay();
        setAppSettings(prev => {
          if (prev.themeSchedule === 'auto' && prev.darkMode !== night) {
            return { ...prev, darkMode: night };
          }
          return prev;
        });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [appSettings.themeSchedule]);

  useEffect(() => {
    if (appSettings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appSettings.darkMode]);

  // Wave 42: apply interface size to the root (rem-based layout scales with it).
  useEffect(() => {
    const px = appSettings.uiScale === 'l' ? '17px' : appSettings.uiScale === 'm' ? '16px' : '14px';
    document.documentElement.style.fontSize = px;
  }, [appSettings.uiScale]);

  useEffect(() => {
    const morphismClasses = [
      'theme-glassmorphism',
      'theme-neumorphism',
      'theme-skeuomorphism',
      'theme-squirclemorphism',
      'theme-metalmorphism',
      'theme-ar-morphism',
      'theme-cosmic-orange',
      'theme-blue-titanium',
      'theme-desert-titanium'
    ];
    // Stored theme values map to CSS hook classes (note: 'ar_morphism' → 'theme-ar-morphism')
    const themeClassMap: Record<string, string> = {
      glassmorphism: 'theme-glassmorphism',
      neumorphism: 'theme-neumorphism',
      skeuomorphism: 'theme-skeuomorphism',
      squirclemorphism: 'theme-squirclemorphism',
      metalmorphism: 'theme-metalmorphism',
      ar_morphism: 'theme-ar-morphism',
      'ar-morphism': 'theme-ar-morphism',
      cosmic_orange: 'theme-cosmic-orange',
      blue_titanium: 'theme-blue-titanium',
      desert_titanium: 'theme-desert-titanium',
    };
    document.documentElement.classList.remove(...morphismClasses);
    const activeClass = themeClassMap[appSettings.theme || 'glassmorphism'] || 'theme-glassmorphism';
    document.documentElement.classList.add(activeClass);
  }, [appSettings.theme]);

  // Section protection
  const [unlockedSections, setUnlockedSections] = useState<Record<string, boolean>>({
    apartments: false,
  });

  const isSectionProtected = (sectionId: string): boolean => {
    const protection = appSettings.sectionProtection;
    if (!protection) return sectionId === 'apartments';
    return !!protection.enabled?.[sectionId];
  };

  const isSectionUnlocked = (sectionId: string): boolean => {
    if (!isSectionProtected(sectionId)) return true;
    return !!unlockedSections[sectionId];
  };

  const unlockSection = (sectionId: string, passwordAttempt: string): boolean => {
    // Audit fix: the old default PIN must NOT work after the admin changes it
    // (the `|| attempt === DEFAULT` backdoor is removed); PINs are hash-verified.
    const stored = appSettings.sectionProtection?.passwords?.[sectionId] ?? (sectionId === 'apartments' ? '22277512' : '');
    const cleanAttempt = passwordAttempt.trim();
    if (!stored || !cleanAttempt) return false;
    const ok = isPasswordHash(stored)
      ? verifyPassword(cleanAttempt, stored, `section:${sectionId}`)
      : cleanAttempt === stored.trim();
    if (ok) {
      if (!isPasswordHash(stored)) {
        const hashed = hashPassword(cleanAttempt, `section:${sectionId}`);
        setAppSettings(prev => ({
          ...prev,
          sectionProtection: {
            passwords: { ...(prev.sectionProtection?.passwords || {}), [sectionId]: hashed },
            enabled: { ...(prev.sectionProtection?.enabled || {}) },
          },
        }));
      }
      setUnlockedSections(prev => ({ ...prev, [sectionId]: true }));
      return true;
    }
    return false;
  };

  const lockSection = (sectionId: string) => {
    setUnlockedSections(prev => ({ ...prev, [sectionId]: false }));
  };

  const setSectionPassword = (sectionId: string, newPassword: string, isEnabled?: boolean) => {
    setAppSettings(prev => {
      const current = prev.sectionProtection || defaultAppSettings.sectionProtection!;
      const trimmed = newPassword.trim();
      return {
        ...prev,
        sectionProtection: {
          passwords: {
            ...current.passwords,
            ...(trimmed ? { [sectionId]: hashPassword(trimmed, `section:${sectionId}`) } : {}),
          }, 
          enabled: {
            ...current.enabled,
            [sectionId]: isEnabled !== undefined ? isEnabled : (newPassword.trim().length > 0),
          }
        }
      };
    });
    logAudit('update', 'user', currentUser?.id || 'admin', `Updated password protection for section: ${sectionId}`, 'Section security updated');
  };

  const isApartmentsUnlocked = isSectionUnlocked('apartments');
  const unlockApartments = (pwd: string) => unlockSection('apartments', pwd);
  const lockApartments = () => lockSection('apartments');

  const [searchQuery, setSearchQuery] = useState('');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraTargetData, setCameraTargetData] = useState<{ title?: string; relatedType?: string; relatedId?: string; amount?: number } | null>(null);

  const updateAppSettings = (updates: Partial<AppSettings>) => {
    if (!guard('settings', 'edit')) return;
    setAppSettings(prev => ({ ...prev, ...updates }));
    // Wave 29: persist company branding back to the owner's user record so it
    // survives logout/login and is inherited by their employees.
    if (currentUser && (
      updates.logoUrl !== undefined || updates.billDesign !== undefined ||
      updates.companyName !== undefined || updates.receiptHeader !== undefined ||
      updates.receiptFooter !== undefined || updates.receiptContact !== undefined
    )) {
      setUsers(prevUsers => prevUsers.map(u => {
        if (u.id !== currentUser.id) return u;
        const bill: CustomBillDesign = { ...(u.customBillDesign || {}), ...(updates.billDesign || {}) };
        if (updates.receiptHeader !== undefined) bill.receiptHeader = updates.receiptHeader || undefined;
        if (updates.receiptFooter !== undefined) bill.receiptFooter = updates.receiptFooter || undefined;
        if (updates.receiptContact !== undefined) bill.receiptContact = updates.receiptContact || undefined;
        return {
          ...u,
          companyName: updates.companyName !== undefined ? updates.companyName : u.companyName,
          customLogoUrl: updates.logoUrl !== undefined ? (updates.logoUrl || undefined) : u.customLogoUrl,
          customBillDesign: bill,
        };
      }));
      setCurrentUser(prevUser => {
        if (!prevUser || prevUser.id !== currentUser.id) return prevUser;
        const bill: CustomBillDesign = { ...(prevUser.customBillDesign || {}), ...(updates.billDesign || {}) };
        if (updates.receiptHeader !== undefined) bill.receiptHeader = updates.receiptHeader || undefined;
        if (updates.receiptFooter !== undefined) bill.receiptFooter = updates.receiptFooter || undefined;
        if (updates.receiptContact !== undefined) bill.receiptContact = updates.receiptContact || undefined;
        const next = {
          ...prevUser,
          companyName: updates.companyName !== undefined ? updates.companyName : prevUser.companyName,
          customLogoUrl: updates.logoUrl !== undefined ? (updates.logoUrl || undefined) : prevUser.customLogoUrl,
          customBillDesign: bill,
        };
        saveCurrentUser( next);
        return next;
      });
    }
    logAudit('update', 'user', 'settings', 'App Settings & Branding', 'Updated system branding, theme or wallpaper');
  };

  // Wave 19: unified permission gate — explicit grants, legacy fallback inside canDo().
  const can = (section: string, action: GrantAction, projectId?: string): boolean => {
    if (TEST_MODE && (section === 'apartments' || section === 'payments')) return false;
    return canDo(currentUser, projectId ?? currentProjectId ?? '', section, action);
  };

  const denyAccess = (section: string, action: GrantAction): void => {
    logAudit('denied', 'user', currentUser?.id || 'anon', `Access denied: ${action} on ${section}`, `User: ${currentUser?.username || 'anonymous'}`);
    setAccessNotice({ section, action, at: Date.now() });
  };

  const printIfAllowed = (section: string): void => {
    if (can(section, 'print')) { window.print(); return; }
    denyAccess(section, 'print');
  };

  const guard = (section: string, action: GrantAction): boolean => {
    if (can(section, action)) return true;
    denyAccess(section, action);
    return false;
  };

  const grantedProjects = useMemo(() => {
    const ids = new Set(grantedProjectIds(currentUser?.projectGrants, projects.map(p => p.id)));
    return projects.filter(p => ids.has(p.id));
  }, [currentUser, projects]);

  const isTabAllowed = (tabId: string): boolean => can(tabId, 'view');

  const cycleThemeSchedule = () => {
    setAppSettings(prev => {
      const current = prev.themeSchedule || 'auto';
      let nextMode: 'auto' | 'light' | 'dark' = 'light';
      let nextDark = false;
      if (current === 'auto') {
        nextMode = 'light';
        nextDark = false;
      } else if (current === 'light') {
        nextMode = 'dark';
        nextDark = true;
      } else {
        nextMode = 'auto';
        nextDark = !isCurrentTimeDay();
      }
      return {
        ...prev,
        themeSchedule: nextMode,
        darkMode: nextDark,
      };
    });
  };

  const setThemeSchedule = (mode: 'auto' | 'light' | 'dark') => {
    setAppSettings(prev => ({
      ...prev,
      themeSchedule: mode,
      darkMode: mode === 'auto' ? !isCurrentTimeDay() : (mode === 'dark'),
    }));
  };

  const updateReportCustomization = (updates: Partial<import('../types').ReportCustomization>) => {
    setAppSettings(prev => ({
      ...prev,
      reportCustomization: {
        ...(prev.reportCustomization || defaultAppSettings.reportCustomization!),
        ...updates,
      }
    }));
  };

  const uploadCustomReportTemplate = (fileName: string, fileContent: string) => {
    setAppSettings(prev => ({
      ...prev,
      reportCustomization: {
        ...(prev.reportCustomization || defaultAppSettings.reportCustomization!),
        uploadedWordTemplateName: fileName,
        uploadedTemplateContent: fileContent,
      }
    }));
    logAudit('update', 'user', currentUser?.id || 'admin', `Uploaded custom report template: ${fileName}`, 'Report template updated');
  };

  useEffect(() => {
    document.documentElement.lang = language;
    if (language === 'fa' || language === 'ps') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [language]);

  // Wave 33: document-level lang/dir (a11y + correct RTL/LTR everywhere).
  const applyDocumentLang = (lang: Language) => {
    try {
      const clean = normalizeLang(lang);
      document.documentElement.lang = clean === 'ps' ? 'ps' : clean === 'fa' ? 'fa' : 'en';
      document.documentElement.dir = clean === 'en' ? 'ltr' : 'rtl';
      document.title = clean === 'ps' ? 'نیک اسمارت کاونټ | NIK Smart Count'
        : clean === 'fa' ? 'نیک اسمارت کانت | NIK Smart Count' : 'NIK Smart Count';
    } catch { /* non-DOM env */ }
  };
  const setLanguage = (lang: Language) => {
    const clean = normalizeLang(lang);
    setLanguageState(clean);
    saveToStorage('lang', clean);
    try { localStorage.setItem('lang_manual', '1'); } catch { /* noop */ }
    applyDocumentLang(clean);
  };

  const t = useMemo(() => {
    const raw = translations[language] || translations['en'];
    // کلید گمشده: نمایش خوانا به‌جای کلید خام (مثلاً companyName → Company Name)
    const humanize = (key: string) =>
      key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, (ch) => ch.toUpperCase());
    const fn = ((key: string) => (raw as any)[key] ?? humanize(key)) as any;
    return Object.assign(fn, raw);
  }, [language]);

  /** متن سه‌زبانه: انگلیسی / دری / پشتو — جایگزین یکدست تمام ternaryهای زبانی */
  const tp = (en: string, fa: string, ps: string): string => {
    if (language === 'ps') return ps;
    if (language === 'fa') return fa;
    return en;
  };

  // Wave 33: render a STORED value (payment method, category, doc id, unit)
  // in the active language — never leak the storage language into the UI.
  const tx = (kind: StoredKind, value: string | undefined): string => {
    if (kind === 'doc') {
      const tkey = DOC_CATEGORY_TKEY[(value || '').trim().toLowerCase()];
      if (tkey) return t(tkey);
      return humanizeKey(value);
    }
    if (kind === 'payment') return labelPaymentMethod(value, language);
    if (kind === 'unit') return labelUnit(value, language);
    return labelExpenseCategory(value, language);
  };

  // Wave 33: per-company default language (owner-set). Applies on login only
  // when this device never had a manual language choice.
  const companyLangKey = (company?: string): string =>
    `lang_default_${(company || 'default').trim().slice(0, 80) || 'default'}`;
  const getCompanyDefaultLang = (company?: string): Language | null => {
    try {
      const v = localStorage.getItem(companyLangKey(company));
      return v === 'fa' || v === 'ps' || v === 'en' ? v : null;
    } catch {
      return null;
    }
  };
  const setCompanyDefaultLang = (company: string | undefined, lang: Language): void => {
    const clean = normalizeLang(lang);
    try { localStorage.setItem(companyLangKey(company), clean); } catch { /* noop */ }
    logAudit('update', 'settings', companyLangKey(company), `Company default language set to ${clean}`, `Company: ${company || 'default'}`);
  };

  useEffect(() => { applyDocumentLang(language); }, [language]);

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === currentProjectId) || projects[0] || null;
  }, [projects, currentProjectId]);

  const setCurrentProjectId = (id: string) => {
    setCurrentProjectIdState(id);
  };

  const logAudit = (
    action: 'create' | 'update' | 'delete' | 'login' | string,
    entityType: AuditLog['entityType'],
    entityId: string,
    recordTitle: string,
    details: string,
    previousValue?: string,
    newValue?: string,
    projId?: string
  ) => {
    const now = new Date();
    const targetProj = projects.find(p => p.id === (projId || currentProjectId));
    const newLog: AuditLog = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      projectId: projId || currentProjectId,
      projectName: targetProj?.name || 'Project',
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || 'System User',
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      action,
      entityType,
      entityId,
      recordTitle,
      previousValue,
      newValue,
      details,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const recordActivity = (user: User, kind: UserActivityEvent['kind'], feature?: string, label?: string) => {
    const ev: UserActivityEvent = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      userId: user.id,
      userName: user.name,
      role: user.role,
      kind,
      feature,
      label,
      timestamp: new Date().toISOString(),
    };
    setActivityEvents(prev => [...prev.slice(-599), ev]);
  };

  const trackFeature = (feature: string, label?: string) => {
    if (!currentUser) return;
    recordActivity(currentUser, 'feature', feature, label);
  };

  // ============ Wave 40: multi-device user sync ============
  // The server is the shared source of truth for ACCOUNTS (business data
  // stays per-device). Local login always works offline; unknown or stale
  // accounts fall back to the server and are cached locally afterwards.
  const saltOf = (u: Pick<User, 'username' | 'hashSalt'>): string =>
    (u.hashSalt || u.username || '').trim().toLowerCase();

  const serializeUserForSync = (u: User): Record<string, unknown> => {
    const pw = (u.password || '').trim();
    return {
      id: u.id,
      name: u.name,
      username: (u.username || '').trim(),
      email: (u.email || '').trim(),
      passwordHash: isPasswordHash(pw) ? pw : hashPassword(pw, saltOf(u)),
      hashSalt: saltOf(u),
      role: u.role,
      isMaster: u.isMasterSuperAdmin === true,
      active: u.active !== false,
      isLockedBySuperAdmin: u.isLockedBySuperAdmin === true,
      ownerAdminId: u.ownerAdminId || '',
      phone: u.phone || '',
      companyName: u.companyName || '',
      companyAddress: u.companyAddress || '',
      subscriptionPlan: u.subscriptionPlan || 'pro',
      subscriptionExpiresAt: u.subscriptionExpiresAt || '',
      permissions: u.permissions || {},
      allowedTabs: u.permissions?.allowedTabs || [],
      customEnabledModules: u.customEnabledModules || {},
      appProfile: {
        projectGrants: u.projectGrants || [],
        accessExpiresAt: u.accessExpiresAt || '',
        customTheme: u.customTheme || '',
        customBackgroundUrl: u.customBackgroundUrl || '',
        customLogoUrl: u.customLogoUrl || '',
        customBillDesign: u.customBillDesign || null,
        customButtonConfig: u.customButtonConfig || [],
        verified: u.verified === true,
        subscriptionPlan: u.subscriptionPlan || '',
      },
    };
  };

  const serverUserToLocal = (su: any, passwordHash: string, keepId?: string): User => {
    const prof = (su.appProfile && typeof su.appProfile === 'object') ? su.appProfile : {};
    const role = su.role === 'admin' || su.role === 'accountant' ? su.role : 'viewer';
    const perms = (su.permissions && typeof su.permissions === 'object') ? su.permissions : {};
    return {
      id: keepId || su.id,
      name: su.name || su.username,
      username: su.username,
      email: su.email || '',
      password: passwordHash,
      hashSalt: (su.username || '').trim().toLowerCase(),
      phone: su.phone || '',
      companyName: su.companyName || '',
      companyAddress: su.companyAddress || prof.companyAddress || '',
      role,
      isMasterSuperAdmin: su.isMasterSuperAdmin === true,
      ownerAdminId: su.ownerAdminId || undefined,
      active: true,
      verified: prof.verified === true,
      subscriptionPlan: (prof.subscriptionPlan as User['subscriptionPlan'])
        || (su.subscriptionPlan === 'trial' || su.subscriptionPlan === 'lifetime' ? su.subscriptionPlan : '1_year'),
      subscriptionExpiresAt: su.subscriptionExpiresAt || undefined,
      isLockedBySuperAdmin: false,
      permissions: { ...perms, allowedTabs: Array.isArray(su.allowedTabs) ? su.allowedTabs : (perms.allowedTabs || []) },
      projectGrants: Array.isArray(prof.projectGrants) ? prof.projectGrants : [],
      accessExpiresAt: prof.accessExpiresAt || undefined,
      customTheme: prof.customTheme || undefined,
      customBackgroundUrl: prof.customBackgroundUrl || undefined,
      customLogoUrl: prof.customLogoUrl || undefined,
      customBillDesign: prof.customBillDesign || undefined,
      customButtonConfig: Array.isArray(prof.customButtonConfig) ? prof.customButtonConfig : undefined,
      customEnabledModules: (su.customEnabledModules && typeof su.customEnabledModules === 'object') ? su.customEnabledModules : undefined,
      createdAt: new Date().toISOString(),
    };
  };

  // Wave 41: pushes are never silent anymore. Without a server session the
  // payload is parked in the outbox (replays after next login); failures are
  // recorded in serverSync so the Users page can show them.
  const pushUserToServer = (u: User): void => {
    if (TEST_MODE) return; // the test version never touches the production server
    const payload = serializeUserForSync(u);
    if (!backendApi.getToken()) {
      backendApi.queueUserSync('sync_user', { user: payload }).catch(() => {});
      setServerSync(prev => ({ ...prev, status: 'no-token', pendingCount: prev.pendingCount + 1 }));
      return;
    }
    try {
      backendApi.syncUser(payload).then((res) => {
        if (res.success && !res.queued) {
          setServerSync(prev => ({ ...prev, status: 'ok', lastSyncAt: new Date().toISOString(), lastError: null }));
        } else if (res.queued || res.offline) {
          setServerSync(prev => ({ ...prev, pendingCount: prev.pendingCount + 1 }));
        } else {
          setServerSync(prev => ({ ...prev, lastError: res.error || 'sync-failed' }));
        }
      }).catch(() => {});
    } catch { /* offline queue / network — replays automatically */ }
  };

  const deleteUserOnServer = (id: string, username: string): void => {
    if (TEST_MODE) return;
    const payload = { id, username };
    if (!backendApi.getToken()) {
      backendApi.queueUserSync('delete_user', payload).catch(() => {});
      return;
    }
    try {
      backendApi.deleteServerUser(payload).catch(() => {});
    } catch { /* ignore */ }
  };

  // Wave 41: capability probe — outdated server files vs offline vs no session.
  const refreshServerSyncStatus = async (): Promise<void> => {
    if (TEST_MODE) return;
    setServerSync(prev => ({ ...prev, status: 'checking' }));
    try {
      const pending = await backendApi.getOfflinePendingCount().catch(() => 0);
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (!online) {
        setServerSync(prev => ({ ...prev, status: 'offline', pendingCount: pending }));
        return;
      }
      const ping = await backendApi.pingServer();
      if (ping.ok) {
        setServerSync(prev => ({
          ...prev,
          status: backendApi.getToken() ? 'ok' : 'no-token',
          pendingCount: pending,
          lastError: backendApi.getToken() ? prev.lastError : null,
        }));
      } else if (ping.status >= 500) {
        // Reachable but crashing — almost always config.php / DB / PHP version.
        setServerSync(prev => ({ ...prev, status: 'outdated', pendingCount: pending, lastError: 'server-500' }));
      } else if (ping.status === 0) {
        setServerSync(prev => ({ ...prev, status: 'outdated', pendingCount: pending, lastError: 'no-response' }));
      } else {
        setServerSync(prev => ({ ...prev, status: 'outdated', pendingCount: pending }));
      }
    } catch {
      setServerSync(prev => ({ ...prev, status: 'offline' }));
    }
  };

  // Wave 41: heal accounts created before the server knew them (pre-patch
  // users, token-less sessions). Idempotent — the server upserts by username.
  const syncAllUsersToServer = async (): Promise<{ pushed: number; queued: number; failed: number; firstError?: string }> => {
    const summary: { pushed: number; queued: number; failed: number; firstError?: string } = { pushed: 0, queued: 0, failed: 0 };
    if (TEST_MODE) return summary;
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    const hasToken = !!backendApi.getToken();
    if (online && hasToken) {
      await backendApi.syncOfflineQueue().catch(() => {});
    }
    for (const u of users) {
      if (!u.password || !isPasswordHash(u.password)) continue; // legacy plaintext upgrades on next login
      if (!online || !hasToken) {
        try {
          await backendApi.queueUserSync('sync_user', { user: serializeUserForSync(u) });
          summary.queued += 1;
        } catch { summary.failed += 1; }
        continue;
      }
      try {
        const res = await backendApi.syncUser(serializeUserForSync(u));
        if (res.success && !res.queued) summary.pushed += 1;
        else if (res.queued || res.offline) summary.queued += 1;
        else {
          summary.failed += 1;
          if (!summary.firstError) summary.firstError = res.error || `server-${res.status ?? '?'}`;
        }
      } catch { summary.failed += 1; if (!summary.firstError) summary.firstError = 'network'; }
    }
    setServerSync({
      status: !online ? 'offline' : (hasToken ? 'ok' : 'no-token'),
      lastSyncAt: new Date().toISOString(),
      lastError: summary.firstError || null,
      pendingCount: summary.queued,
    });
    return summary;
  };

  const login = async (
    usernameOrEmail: string,
    password?: string,
    loginType?: 'admin' | 'employee',
    remember: boolean = true
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmedInput = usernameOrEmail.trim().toLowerCase();
    // Wave 40: every creation path trims the password, so login must too —
    // otherwise cross-device hashes would never match. The untrimmed variant
    // is still accepted for legacy space-padded passwords.
    const rawPw = password || '';
    const pw = rawPw.trim();
    let found = users.find(u =>
      u.email.toLowerCase() === trimmedInput ||
      u.username.toLowerCase() === trimmedInput
    );
    const verifyLocal = (candidate: string) =>
      !!found && !!candidate && !!found.password && verifyPassword(candidate, found.password, saltOf(found));
    const localOk = verifyLocal(pw) || (rawPw !== pw && verifyLocal(rawPw));
    let justFetched = false;
    let serverStatus = -1; // Wave 43: remember WHY the server leg failed
    if (!localOk) {
      // Unknown on this device, or changed on another one — ask the server.
      try {
        const res = await backendApi.login(trimmedInput, pw);
        serverStatus = res.status ?? -1;
        const su = (res.data as any)?.user;
        if (res.success && su && su.username) {
          const cached = serverUserToLocal(su, hashPassword(pw, (su.username || trimmedInput).toLowerCase()), found?.id);
          setUsers(prev => {
            const ix = prev.findIndex(u => u.id === cached.id || u.username.toLowerCase() === cached.username.toLowerCase());
            if (ix >= 0) { const next = [...prev]; next[ix] = { ...cached, createdAt: prev[ix].createdAt }; return next; }
            return [...prev, cached];
          });
          found = cached;
          justFetched = true;
        } else if (res.status === 403) {
          return { success: false, error: res.error || 'حساب کاربری توسط مدیریت مسدود شده است' };
        } else if (res.status === 429) {
          setAuthNotice('server-lockout');
          return { success: false, error: tp('Too many attempts. Please try again in 15 minutes.', 'تلاش‌ها بیش از حد شد. لطفاً ۱۵ دقیقه بعد تلاش کنید.', 'هڅې ډېرې شوې. مهرباني وکړئ ۱۵ دقیقې وروسته بیا هڅه وکړئ.') };
        }
      } catch { serverStatus = 0; /* offline — fall through to the local error below */ }
    }
    if (!found) {
      // Wave 43: never blame "not found" for connection/server failures.
      if (serverStatus === 0) {
        return { success: false, error: tp('Cannot reach the server. Check your internet connection.', 'به سرور وصل نشد. اینترنت را بررسی کنید.', 'سرور ته ونه رسېد. انټرنېټ وګورئ.') };
      }
      if (serverStatus >= 500) {
        return { success: false, error: tp(`Server error (${serverStatus}). Contact your administrator.`, `خطای سرور (${serverStatus}). با مدیر تماس بگیرید.`, `د سرور تېروتنه (${serverStatus}). له مدیر سره اړیکه ونیسئ.`) };
      }
      return { success: false, error: 'حساب کاربری یافت نشد / Account not found' };
    }
    if (!justFetched && !localOk) {
      const fails0 = readLoginFails(trimmedInput);
      const n = fails0.n + 1;
      writeLoginFails(trimmedInput, n, n >= 5 ? Date.now() + 60000 : 0);
      if (!pw || !found.password) {
        return { success: false, error: tp('Password is required.', 'رمز عبور الزامی است.', 'پټ نوم اړین دی.') };
      }
      return { success: false, error: 'رمز عبور اشتباه است / Incorrect password' };
    }
    if (!found.active) {
      return { success: false, error: 'حساب مسدود است / Account is disabled' };
    }
    const fails = readLoginFails(trimmedInput);
    if (fails.until > Date.now()) {
      const secs = Math.ceil((fails.until - Date.now()) / 1000);
      return { success: false, error: tp(`Too many failed attempts. Try again in ${secs}s.`, `تلاش‌های ناموفق زیاد است. ${secs} ثانیه بعد تلاش کنید.`, `ناسمې هڅې ډېرې شوې. ${secs} ثانیې وروسته بیا هڅه وکړئ.`) };
    }
    if (found.isLockedBySuperAdmin) {
      return { success: false, error: 'حساب کاربری توسط مدیریت مسدود شده است' };
    }
    writeLoginFails(trimmedInput, 0, 0);
    // Upgrade legacy plaintext passwords to salted hashes on successful login.
    if (!isPasswordHash(found.password)) {
      const upgraded = hashPassword(pw, found.username);
      const reanchored = { ...found, password: upgraded, hashSalt: found.username.toLowerCase() };
      const foundId = found.id;
      setUsers(prev => prev.map(u => u.id === foundId ? reanchored : u));
      found = reanchored;
    }
    if (!found.isMasterSuperAdmin && found.subscriptionExpiresAt) {
      const now = new Date().getTime();
      const expires = new Date(found.subscriptionExpiresAt).getTime();
      const gracePeriodMs = 7 * 24 * 60 * 60 * 1000;
      if (now > (expires + gracePeriodMs)) {
        return { 
          success: false, 
          error: 'اشتراک این حساب منقضی شده است. لطفا با شماره 0093783788278 تماس بگیرید.' 
        };
      }
    }
    if (found.accessExpiresAt) {
      const expMs = new Date(found.accessExpiresAt).getTime();
      if (!Number.isNaN(expMs) && Date.now() > expMs) {
        return { success: false, error: 'دسترسی این حساب به پایان رسیده است / Access period has expired' };
      }
    }
    const updatedUser = { ...found, lastLoginAt: new Date().toISOString() };
    setUsers(prev => prev.map(u => u.id === found.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    saveCurrentUser(updatedUser, remember);
    recordActivity(updatedUser, 'login');

    if (found.role !== 'admin' && !found.isMasterSuperAdmin) {
      const companyProj = projects.find(p => p.companyName === found.companyName || p.userId === found.ownerAdminId);
      if (companyProj) {
        setCurrentProjectId(companyProj.id);
      }
    }

    // Wave 29: branding follows the OWNER company — employees inherit their
    // owner's logo/design; nothing leaks across companies between sessions.
    const brandSrc = (found.customLogoUrl || found.customBillDesign)
      ? found
      : users.find(u => !!u.companyName && u.companyName === found.companyName && (u.customLogoUrl || u.customBillDesign));
    const brandDesign = brandSrc?.customBillDesign;
    setAppSettings(prev => ({
      ...prev,
      companyName: found.companyName || brandSrc?.companyName || 'NIK SMART COUNT',
      logoUrl: brandSrc?.customLogoUrl || '',
      billDesign: brandDesign || undefined,
      receiptHeader: brandDesign?.receiptHeader || '',
      receiptFooter: brandDesign?.receiptFooter || '',
      receiptContact: brandDesign?.receiptContact || '',
      enabledModules: found.customEnabledModules ? { ...prev.enabledModules, ...found.customEnabledModules } : prev.enabledModules,
      aiEnabled: found.permissions?.aiEnabled !== false,
      // Wave 31: per-user theme assigned by Office7 (validated allow-list; legacy users keep current theme).
      ...(isOffice7Theme(found.customTheme) ? { theme: found.customTheme as AppTheme } : {}),
    }));
    // Wave 33: company default language wins only when the device has no manual choice.
    try {
      if (!localStorage.getItem('lang_manual')) {
        const companyDefault = getCompanyDefaultLang(found.companyName || undefined);
        if (companyDefault) {
          setLanguageState(companyDefault);
          saveToStorage('lang', companyDefault);
          applyDocumentLang(companyDefault);
        }
      }
    } catch { /* noop */ }
    logAudit('login', 'user', found.id, `User ${found.name} logged in (${found.role})`, 'Authenticated successfully');
    if (!justFetched) {
      // Wave 40: refresh this device's copy from the server (grants, locks,
      // profile). A remote lock signs the user out immediately.
      backendApi.login(trimmedInput, pw).then((res) => {
        if (!res.success && res.status === 429) {
          setAuthNotice('server-lockout');
        } else if (!res.success && res.status === 403) {
          setAuthNotice('server-locked');
          logout();
        } else if (res.success && (res.data as any)?.user) {
          const su = (res.data as any).user;
          setUsers(prev => prev.map(u => {
            if (u.username.toLowerCase() !== (su.username || '').toLowerCase()) return u;
            const merged = serverUserToLocal(su, u.password || '', u.id);
            return { ...merged, password: u.password, hashSalt: u.hashSalt || merged.hashSalt, createdAt: u.createdAt };
          }));
          // Wave 41: server session is fresh — mark sync healthy and heal any
          // accounts that were created while there was no token (once).
          setServerSync(prev => ({ ...prev, status: 'ok', lastSyncAt: new Date().toISOString(), lastError: null }));
          try {
            if (!localStorage.getItem('nsc_bulkpush_v41')) {
              localStorage.setItem('nsc_bulkpush_v41', '1');
              setTimeout(() => { syncAllUsersToServer().catch(() => {}); }, 1500);
            }
          } catch { /* ignore */ }
        }
      }).catch(() => {});
    }
    return { success: true };
  };

  const createTenantCompanyOwnerBySuperAdmin = (data: {
    name: string;
    username: string;
    email: string;
    password: string;
    phone: string;
    companyName: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    taxNumber?: string;
    bankDetails?: string;
    subscriptionMonths?: number;
    initialProjectName?: string;
  }): { success: boolean; user?: User; error?: string } => {
    if (!currentUser?.isMasterSuperAdmin) { denyAccess('tenant_create', 'create'); return { success: false, error: 'forbidden' }; }
    const cleanUsername = data.username.trim().toLowerCase();
    const cleanEmail = data.email.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return { success: false, error: 'نام کاربری حداقل ۳ حرف باشد / Username must be at least 3 characters' };
    }
    const duplicate = users.find(u => 
      u.username.toLowerCase() === cleanUsername || 
      u.email.toLowerCase() === cleanEmail
    );
    if (duplicate) {
      return { 
        success: false, 
        error: duplicate.username.toLowerCase() === cleanUsername 
          ? 'این نام کاربری قبلاً استفاده شده است' 
          : 'این ایمیل قبلاً ثبت گردیده است' 
      };
    }
    const months = data.subscriptionMonths || 12;
    const expiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();
    const newOwner: User = {
      id: 'tenant-' + Date.now(),
      name: data.name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      password: hashPassword(data.password.trim(), cleanUsername),
      hashSalt: cleanUsername,
      phone: data.phone.trim(),
      companyName: data.companyName.trim(),
      companyAddress: data.companyAddress?.trim() || '',
      role: 'admin',
      active: true,
      verified: true,
      isMasterSuperAdmin: false,
      subscriptionPlan: months >= 24 ? 'lifetime' : months === 12 ? '1_year' : '6_months',
      subscriptionExpiresAt: expiresAt,
      customBillDesign: {
        companyAddress: data.companyAddress?.trim() || '',
        companyPhone: data.companyPhone?.trim() || '',
        companyEmail: data.companyEmail?.trim() || '',
        taxNumber: data.taxNumber?.trim() || '',
        bankDetails: data.bankDetails?.trim() || '',
        receiptContact: [data.companyPhone?.trim(), data.companyEmail?.trim()].filter(Boolean).join(' / '),
      },
      createdAt: new Date().toISOString(),
      permissions: {
        aiEnabled: true,
        canManageProjects: true,
        canManageExpenses: true,
        canManagePayments: true,
        canManageMaterials: true,
        canManageSales: true,
        canManageReports: true,
      }
    };
    setUsers(prev => [...prev, newOwner]);
    pushUserToServer(newOwner);
    const projectName = data.initialProjectName?.trim() || `پروژه ساختمانی - ${data.companyName.trim()}`;
    const initialProj: Project = {
      id: 'proj-' + Date.now(),
      name: projectName,
      code: 'PRJ-' + Math.floor(100 + Math.random() * 900),
      address: data.companyAddress?.trim() || 'کابل',
      city: 'کابل',
      landInfo: 'زمین ملکیت اختصاصی',
      buildingArea: 1200,
      totalArea: 1200,
      floors: 8,
      units: 16,
      currency: 'USD',
      description: `پروژه مرکزی شرکت ${data.companyName}`,
      status: 'in_construction',
      budget: 150000,
      startDate: new Date().toISOString().split('T')[0],
      defaultExchangeRate: 70,
      createdAt: new Date().toISOString(),
      companyName: data.companyName.trim(),
      userId: newOwner.id
    };
    setProjects(prev => [...prev, initialProj]);
    logAudit('create', 'user', newOwner.id, `Super Admin created Company Owner: ${newOwner.name} (${newOwner.companyName})`, `Username: @${newOwner.username}, Plan: ${months} months`);
    return { success: true, user: newOwner };
  };

  const registerCompanyOwner = (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    companyName: string;
    companyAddress: string;
  }): { success: boolean; otpCode: string; error?: string } => {
    const existing = users.find(u => u.email.toLowerCase() === data.email.trim().toLowerCase());
    if (existing) {
      return { success: false, otpCode: '', error: 'این ایمیل قبلاً ثبت شده است' };
    }
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const sixMonthsLater = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
    const regUsername = data.email.split('@')[0].trim().toLowerCase();
    if (regUsername.length < 3) {
      return { success: false, otpCode: '', error: 'بخش اول ایمیل حداقل ۳ حرف باشد / Email prefix must be at least 3 characters' };
    }
    const newUser: User = {
      id: 'usr-' + Date.now(),
      username: regUsername,
      email: data.email.trim().toLowerCase(),
      password: hashPassword(data.password.trim(), regUsername),
      hashSalt: regUsername,
      name: data.name.trim(),
      phone: data.phone.trim(),
      companyName: data.companyName.trim(),
      companyAddress: data.companyAddress.trim(),
      role: 'admin',
      active: true,
      verified: false,
      otpCode: generatedOtp,
      otpIssuedAt: new Date().toISOString(),
      subscriptionPlan: 'trial',
      subscriptionExpiresAt: sixMonthsLater,
      createdAt: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newUser]);
    // Wave 41: push when a server session exists (queued otherwise and healed
    // at the next login by syncAllUsersToServer).
    pushUserToServer(newUser);

    setAppSettings(prev => ({
      ...prev,
      companyName: data.companyName.trim(),
      companySubtitle: `مدیریت و حسابداری ساختمانی ${data.companyName.trim()}`,
      receiptHeader: `${data.companyName.trim()} - سند رسمی پرداخت و رسید`,
      receiptContact: `${data.phone.trim()} / ${data.email.trim()}`,
      receiptFooter: `اسناد رسمی شرکت ساختمانی ${data.companyName.trim()} با امضا و مهر معتبر است.`,
    }));

    // Safety: auto-download a JSON backup before resetting local data for the new tenant.
    try { exportJsonBackup(); } catch { /* best effort */ }
    setProjects([]);
    setExpenses([]);
    setSteelRecords([]);
    setConcreteRecords([]);
    setPayments([]);
    setApartments([]);
    setContractors([]);
    setSuppliers([]);
    setDocuments([]);
    logAudit('create', 'user', newUser.id, `New Company Admin Registered: ${newUser.companyName}`, `6 Months Free Trial activated. OTP issued.`);
    return { success: true, otpCode: generatedOtp };
  };

  const verifyOtpAndActivate = (email: string, otpCode: string): { success: boolean; error?: string } => {
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return { success: false, error: 'کاربر یافت نشد' };
    }
    if (!user.otpCode || user.otpCode !== otpCode.trim()) {
      return { success: false, error: 'کد تایید OTP نادرست است' };
    }
    if (isOtpExpired(user.otpIssuedAt)) {
      return { success: false, error: 'کد تایید منقضی شده است، دوباره درخواست دهید / Code expired, request a new one' };
    }
    const verifiedUser: User = {
      ...user,
      verified: true,
      otpCode: undefined,
      otpIssuedAt: undefined,
      lastLoginAt: new Date().toISOString(),
    };
    setUsers(prev => prev.map(u => u.id === user.id ? verifiedUser : u));
    setCurrentUser(verifiedUser);
    saveCurrentUser( verifiedUser);
    logAudit('update', 'user', user.id, `User ${user.name} verified account`, 'Account OTP verified and activated');
    return { success: true };
  };

  const requestPasswordReset = (email: string): { success: boolean; otpCode?: string; error?: string } => {
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return { success: false, error: 'حسابی با این ایمیل یافت نشد' };
    }
    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, otpCode: resetOtp, otpIssuedAt: new Date().toISOString() } : u));
    logAudit('update', 'user', user.id, `Password reset requested for ${user.email}`, `Reset OTP issued`);
    return { success: true, otpCode: resetOtp };
  };

  const completePasswordReset = (email: string, otpCode: string, newPassword: string): { success: boolean; error?: string } => {
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return { success: false, error: 'کاربر یافت نشد' };
    }
    if (!user.otpCode || user.otpCode !== otpCode.trim()) {
      return { success: false, error: 'کد تایید نادرست است' };
    }
    if (isOtpExpired(user.otpIssuedAt)) {
      return { success: false, error: 'کد تایید منقضی شده است، دوباره درخواست دهید / Code expired, request a new one' };
    }
    const nextPw = (newPassword || '').trim();
    if (nextPw.length < 6) {
      return { success: false, error: 'رمز جدید باید حداقل ۶ کاراکتر باشد / New password must be at least 6 characters' };
    }
    const resetUser: User = { ...user, password: hashPassword(nextPw, user.username), hashSalt: user.username.toLowerCase(), otpCode: undefined, otpIssuedAt: undefined };
    setUsers(prev => prev.map(u => u.id === user.id ? resetUser : u));
    pushUserToServer(resetUser);
    logAudit('update', 'user', user.id, `Password updated for ${user.email}`, 'Password changed successfully');
    return { success: true };
  };

  // Wave 31: Office7 self-service password change — verifies the CURRENT
  // password first (master approval of identity), enforces min length.
  const changeOwnPassword = (currentPassword: string, newPassword: string): { success: boolean; error?: string } => {
    if (!currentUser) {
      return { success: false, error: 'No active session / نشست فعال یافت نشد' };
    }
    const fresh = users.find(u => u.id === currentUser.id);
    if (!fresh) {
      return { success: false, error: 'User not found / کاربر یافت نشد' };
    }
    if (!verifyPassword(currentPassword || '', fresh.password, saltOf(fresh))) {
      logAudit('update', 'user', fresh.id, `Failed self password change for ${fresh.email}`, 'Current password mismatch');
      return { success: false, error: 'Current password is incorrect / رمز فعلی اشتباه است' };
    }
    const next = (newPassword || '').trim();
    if (next.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters / رمز جدید باید حداقل ۶ کاراکتر باشد' };
    }
    const updated = { ...fresh, password: hashPassword(next, fresh.username), hashSalt: fresh.username.toLowerCase() };
    setUsers(prev => prev.map(u => u.id === fresh.id ? updated : u));
    pushUserToServer(updated);
    setCurrentUser(updated);
    saveCurrentUser( updated);
    logAudit('update', 'user', fresh.id, `Self password change for ${fresh.email}`, 'Password changed successfully');
    return { success: true };
  };

  // Wave 37 go-live: master changes their own login username from Office7.
  const changeOwnUsername = (newUsername: string): { success: boolean; error?: string } => {
    if (!currentUser) {
      return { success: false, error: 'No active session / نشست فعال یافت نشد' };
    }
    const clean = (newUsername || '').trim().toLowerCase();
    if (clean.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters / نام کاربری حداقل ۳ کاراکتر باشد' };
    }
    if (!/^[a-z0-9._-]+$/.test(clean)) {
      return { success: false, error: 'Username may only contain latin letters, digits, . _ - / نام کاربری فقط حروف لاتین و عدد باشد' };
    }
    const taken = users.some(u => u.id !== currentUser.id && u.username.toLowerCase() === clean);
    if (taken) {
      return { success: false, error: 'This username is already taken / این نام کاربری قبلاً استفاده شده است' };
    }
    const old = currentUser.username;
    const updated = { ...currentUser, username: clean, hashSalt: currentUser.hashSalt || old };
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updated : u));
    pushUserToServer(updated);
    setCurrentUser(updated);
    saveCurrentUser( updated);
    logAudit('update', 'user', currentUser.id, `Username changed ${old} -> ${clean}`, 'Self username change from Office7');
    return { success: true };
  };

  // Wave 37 go-live: first-run setup — creates the ONE master owner when the
  // database is completely empty (fresh production). Refuses otherwise.
  const bootstrapMasterAdmin = (data: { name: string; username: string; email: string; password: string; companyName: string }): { success: boolean; error?: string } => {
    if (TEST_MODE) {
      return { success: false, error: 'Not available in test version / در نسخه تست در دسترس نیست' };
    }
    if (users.length > 0) {
      return { success: false, error: 'System is already initialized / سیستم قبلاً راه‌اندازی شده است' };
    }
    const cleanUsername = (data.username || '').trim().toLowerCase();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanName = (data.name || '').trim();
    const cleanCompany = (data.companyName || '').trim() || 'My Company';
    const pw = (data.password || '').trim();
    if (cleanName.length < 2) {
      return { success: false, error: 'Please enter your full name / لطفاً نام کامل را وارد کنید' };
    }
    if (cleanUsername.length < 3 || !/^[a-z0-9._-]+$/.test(cleanUsername)) {
      return { success: false, error: 'Username: min 3 chars, latin letters/digits only / نام کاربری: حداقل ۳ کاراکتر لاتین' };
    }
    if (!cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email / ایمیل معتبر وارد کنید' };
    }
    if (pw.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters / رمز حداقل ۶ کاراکتر باشد' };
    }
    const master: User = {
      id: 'usr-master-' + Date.now(),
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      password: hashPassword(pw, cleanUsername),
      hashSalt: cleanUsername,
      phone: '',
      companyName: cleanCompany,
      role: 'admin',
      isMasterSuperAdmin: true,
      active: true,
      verified: true,
      subscriptionPlan: 'lifetime',
      subscriptionExpiresAt: '2099-12-31T23:59:59Z',
      createdAt: new Date().toISOString(),
    };
    setUsers([master]);
    setCurrentUser(master);
    saveToStorage('users', [master]);
    saveCurrentUser( master);
    setAppSettings(prev => ({ ...prev, companyName: cleanCompany }));
    logAudit('create', 'user', master.id, `Master owner initialized: ${master.username}`, `Company: ${cleanCompany}`);
    return { success: true };
  };

  // Wave 37 go-live: factory reset — auto-backup, then wipe ALL users and ALL
  // transactional data (production namespace only; test playground untouched).
  // Master super admin only. After reset the first-run setup screen appears.
  const factoryReset = (): { success: boolean; error?: string } => {
    if (!currentUser?.isMasterSuperAdmin) { denyAccess('factory_reset', 'del'); return { success: false, error: 'forbidden' }; }
    try { exportJsonBackup(); } catch { /* best effort */ }
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nik_smart_count_') && !k.startsWith(TEST_PREFIX)) doomed.push(k);
      }
      doomed.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setUsers([]);
    setProjects([]);
    setCurrentProjectIdState('');
    setExpenses([]);
    setSteelRecords([]);
    setConcreteRecords([]);
    setContractors([]);
    setSuppliers([]);
    setApartments([]);
    setAssets([]);
    setLaborRecords([]);
    setPayments([]);
    setDocuments([]);
    setAuditLogs([]);
    setProjectPartners([]);
    setProjectInvestments([]);
    setProjectBudgets([]);
    setCurrentUser(null);
    return { success: true };
  };

  const chargeUserSubscription = (userId: string, durationMonths: number) => {
    if (!currentUser?.isMasterSuperAdmin) { denyAccess('subscription', 'edit'); return; }
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const currentExp = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).getTime() : Date.now();
        const baseTime = Math.max(Date.now(), currentExp);
        const newExpiry = new Date(baseTime + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
        const updated = {
          ...u,
          subscriptionExpiresAt: newExpiry,
          isLockedBySuperAdmin: false,
          active: true,
        };
        logAudit('update', 'user', u.id, `Subscription extended for ${u.name}`, `Added ${durationMonths} months until ${newExpiry}`);
        return updated;
      }
      return u;
    }));
  };

  const toggleLockUserBySuperAdmin = (userId: string) => {
    if (!currentUser?.isMasterSuperAdmin) { denyAccess('user_lock', 'edit'); return; }
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const isLocked = !u.isLockedBySuperAdmin;
        logAudit('update', 'user', u.id, `Super admin toggled lock for ${u.name}`, `Locked: ${isLocked}`);
        backendApi.toggleUserLock(userId, isLocked).catch(() => {});
        return { ...u, isLockedBySuperAdmin: isLocked };
      }
      return u;
    }));
  };

  const createEmployeeAccount = (employee: {
    name: string;
    username: string;
    email: string;
    password: string;
    phone?: string;
    role: 'accountant' | 'viewer';
    permissions: User['permissions'];
  }): { success: boolean; error?: string } => {
    if (!currentUser?.isMasterSuperAdmin && currentUser?.role !== 'admin') { denyAccess('staff', 'create'); return { success: false, error: 'forbidden' }; }
    const existing = users.find(u => u.email.toLowerCase() === employee.email.trim().toLowerCase() || u.username.toLowerCase() === employee.username.trim().toLowerCase());
    if (existing) {
      return { success: false, error: 'این ایمیل یا نام کاربری قبلاً استفاده شده است' };
    }
    const newEmp: User = {
      id: 'emp-' + Date.now(),
      username: employee.username.trim(),
      email: employee.email.trim(),
      password: employee.password,
      name: employee.name.trim(),
      phone: employee.phone?.trim(),
      companyName: currentUser?.companyName || appSettings.companyName,
      role: employee.role,
      ownerAdminId: currentUser?.id,
      active: true,
      verified: true,
      permissions: employee.permissions,
      createdAt: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newEmp]);
    logAudit('create', 'user', newEmp.id, `Created Staff Member ${newEmp.name}`, `Role: ${newEmp.role}`);
    return { success: true };
  };

  const updateEmployeeAccount = (employeeId: string, updates: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    permissions?: User['permissions'];
    active?: boolean;
  }): { success: boolean; error?: string } => {
    const target0 = users.find(u => u.id === employeeId);
    if (!target0) return { success: false };
    {
      const u = target0;
      {
        const updatedUser: User = {
          ...u,
          name: updates.name !== undefined ? updates.name.trim() : u.name,
          email: updates.email !== undefined ? updates.email.trim() : u.email,
          phone: updates.phone !== undefined ? updates.phone.trim() : u.phone,
          password: updates.password && updates.password.trim() ? (isPasswordHash(updates.password.trim()) ? updates.password.trim() : hashPassword(updates.password.trim(), u.username)) : u.password,
          hashSalt: updates.password && updates.password.trim() && !isPasswordHash(updates.password.trim()) ? u.username.toLowerCase() : u.hashSalt,
          permissions: updates.permissions !== undefined ? updates.permissions : u.permissions,
          active: updates.active !== undefined ? updates.active : u.active,
        };
        logAudit('update', 'user', u.id, `Updated Staff Member ${updatedUser.name}`, 'Permissions / credentials updated');
        setUsers(prev => prev.map(x => (x.id === employeeId ? updatedUser : x)));
        pushUserToServer(updatedUser);
      }
    }
    return { success: true };
  };

  const deleteEmployeeAccount = (employeeId: string) => {
    const target = users.find(u => u.id === employeeId);
    const ownStaff = !!currentUser && currentUser.role === 'admin' && !!target?.ownerAdminId && target.ownerAdminId === currentUser.id;
    if (!currentUser?.isMasterSuperAdmin && !ownStaff) { denyAccess('staff', 'del'); return; }
    setUsers(prev => prev.filter(u => u.id !== employeeId));
    if (target) deleteUserOnServer(target.id, target.username);
    logAudit('delete', 'user', employeeId, 'Deleted Staff Member', 'Account removed by company admin');
  };

  const toggleAiForUser = (userId: string, enabled: boolean) => {
    if (!currentUser?.isMasterSuperAdmin) { denyAccess('ai_governance', 'edit'); return; }
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const toggled: User = { ...target, permissions: { ...(target.permissions || {}), aiEnabled: enabled } };
    setUsers(prev => prev.map(u => (u.id === userId ? toggled : u)));
    logAudit('update', 'user', userId, `Toggled AI status for ${target.name}`, `AI Enabled: ${enabled}`);
    pushUserToServer(toggled);
  };

  const updateTenantByMasterAdmin = (userId: string, updates: {
    name?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    companyAddress?: string;
    password?: string;
    customLogoUrl?: string;
    customBillDesign?: CustomBillDesign;
    customButtonConfig?: CustomActionButton[];
    customEnabledModules?: User['customEnabledModules'];
    aiEnabled?: boolean;
    subscriptionExpiresAt?: string;
    isLockedBySuperAdmin?: boolean;
    active?: boolean;
    subscriptionPlan?: User['subscriptionPlan'];
    customTheme?: AppTheme;
    /** Master-level permission merge (tab access, manage flags) */
    permissions?: Partial<UserPermissions>;
    projectGrants?: ProjectGrant[];
    accessExpiresAt?: string;
  }): { success: boolean; error?: string } => {
    if (!currentUser?.isMasterSuperAdmin) { denyAccess('tenant_edit', 'edit'); return { success: false, error: 'forbidden' }; }
    const target0 = users.find(u => u.id === userId);
    if (!target0) return { success: false, error: 'User not found' };
    {
      const u = target0;
      {
        const newPermissions = {
          ...(u.permissions || {}),
          ...(updates.permissions || {}),
          aiEnabled: updates.aiEnabled !== undefined ? updates.aiEnabled : (updates.permissions?.aiEnabled !== undefined ? updates.permissions.aiEnabled : u.permissions?.aiEnabled),
        };
        const uUpdated: User = {
          ...u,
          name: updates.name !== undefined ? updates.name : u.name,
          email: updates.email !== undefined ? updates.email : u.email,
          phone: updates.phone !== undefined ? updates.phone : u.phone,
          companyName: updates.companyName !== undefined ? updates.companyName : u.companyName,
          companyAddress: updates.companyAddress !== undefined ? updates.companyAddress : u.companyAddress,
          password: updates.password !== undefined && updates.password.trim() ? (isPasswordHash(updates.password.trim()) ? updates.password.trim() : hashPassword(updates.password.trim(), u.username)) : u.password,
          hashSalt: updates.password !== undefined && updates.password.trim() && !isPasswordHash(updates.password.trim()) ? u.username.toLowerCase() : u.hashSalt,
          customLogoUrl: updates.customLogoUrl !== undefined ? updates.customLogoUrl : u.customLogoUrl,
          customBillDesign: updates.customBillDesign !== undefined ? updates.customBillDesign : u.customBillDesign,
          customButtonConfig: updates.customButtonConfig !== undefined ? updates.customButtonConfig : u.customButtonConfig,
          customEnabledModules: updates.customEnabledModules !== undefined ? updates.customEnabledModules : u.customEnabledModules,
          subscriptionPlan: updates.subscriptionPlan !== undefined ? updates.subscriptionPlan : u.subscriptionPlan,
          subscriptionExpiresAt: updates.subscriptionExpiresAt !== undefined ? updates.subscriptionExpiresAt : u.subscriptionExpiresAt,
          isLockedBySuperAdmin: updates.isLockedBySuperAdmin !== undefined ? updates.isLockedBySuperAdmin : u.isLockedBySuperAdmin,
          active: updates.active !== undefined ? updates.active : u.active,
          customTheme: updates.customTheme !== undefined ? updates.customTheme : u.customTheme,
          permissions: newPermissions,
          projectGrants: updates.projectGrants !== undefined ? updates.projectGrants : u.projectGrants,
          accessExpiresAt: updates.accessExpiresAt !== undefined ? updates.accessExpiresAt : u.accessExpiresAt,
        };
      setUsers(prev => prev.map(x => (x.id === userId ? uUpdated : x)));
      pushUserToServer(uUpdated);
      if (currentUser?.id === userId) {
        setCurrentUser(uUpdated);
        saveCurrentUser( uUpdated);
      }
      }
    }
    if (currentUser?.id === userId) {
      setAppSettings(prev => ({
        ...prev,
        companyName: updates.companyName || prev.companyName,
        logoUrl: updates.customLogoUrl || prev.logoUrl,
        receiptHeader: updates.customBillDesign?.receiptHeader || prev.receiptHeader,
        billDesign: updates.customBillDesign || prev.billDesign,
        actionButtons: updates.customButtonConfig || prev.actionButtons,
        receiptFooter: updates.customBillDesign?.receiptFooter || prev.receiptFooter,
        receiptContact: updates.customBillDesign?.receiptContact || prev.receiptContact,
        enabledModules: updates.customEnabledModules ? { ...prev.enabledModules, ...updates.customEnabledModules } : prev.enabledModules,
      }));
    }
    logAudit('update', 'user', userId, `Master Admin updated tenant settings`, 'Tenant full-control configuration updated');
    backendApi.updateTenantByOffice7({
      id: userId,
      ...updates,
    }).catch(() => {});
    return { success: true };
  };

  const impersonateTenant = (user: User) => {
    setCurrentUser(user);
    saveCurrentUser( user);
    setAppSettings(prev => ({
      ...prev,
      companyName: user.companyName || prev.companyName,
      logoUrl: user.customLogoUrl || prev.logoUrl,
      receiptHeader: user.customBillDesign?.receiptHeader || prev.receiptHeader,
      receiptFooter: user.customBillDesign?.receiptFooter || prev.receiptFooter,
      receiptContact: user.customBillDesign?.receiptContact || prev.receiptContact,
      enabledModules: user.customEnabledModules ? { ...prev.enabledModules, ...user.customEnabledModules } : prev.enabledModules,
      aiEnabled: user.permissions?.aiEnabled !== false,
    }));
    logAudit('login', 'user', user.id, `Master Admin impersonated ${user.name}`, 'Workspace inspection');
  };

  const toggleDarkMode = () => {
    setAppSettings(prev => ({
      ...prev,
      darkMode: !prev.darkMode,
    }));
  };

  const setTheme = (newTheme: AppTheme) => {
    setAppSettings(prev => ({
      ...prev,
      theme: newTheme,
    }));
  };

  // Wave 42: interface size — compact by default (owner found everything oversized).
  const setUiScale = (s: 's' | 'm' | 'l') => {
    setAppSettings(prev => ({ ...prev, uiScale: s }));
  };

  // Wave 19: auto-logout when the account is deactivated / locked / expired.
  useEffect(() => {
    if (!currentUser || currentUser.isMasterSuperAdmin) return;
    const fresh = users.find(u => u.id === currentUser.id);
    if (!fresh) return;
    const expired = fresh.accessExpiresAt
      ? (!Number.isNaN(new Date(fresh.accessExpiresAt).getTime()) && Date.now() > new Date(fresh.accessExpiresAt).getTime())
      : false;
    if (fresh.active === false || fresh.isLockedBySuperAdmin === true || expired) {
      setAccessNotice({ section: 'session', action: 'expired', at: Date.now() });
      setCurrentUser(null);
      saveCurrentUser( null);
      backendApi.setToken(null);
    }
  }, [users, currentUser]);

  // Wave 19: keep current project inside the granted set.
  useEffect(() => {
    if (!currentUser || currentUser.isMasterSuperAdmin) return;
    if (!currentUser.projectGrants || currentUser.projectGrants.length === 0) return;
    const ids = new Set(grantedProjectIds(currentUser.projectGrants, projects.map(p => p.id)));
    if (currentProjectId && !ids.has(currentProjectId)) {
      const first = projects.find(p => ids.has(p.id));
      setCurrentProjectIdState(first ? first.id : '');
      saveToStorage('currentProjId', first ? first.id : '');
    }
  }, [currentUser, projects, currentProjectId]);

  const enterTestMode = () => {
    try { localStorage.setItem(TEST_MODE_KEY, '1'); } catch { /* ignore */ }
    window.location.reload();
  };

  const exitTestMode = () => {
    try { localStorage.removeItem(TEST_MODE_KEY); } catch { /* ignore */ }
    window.location.reload();
  };

  const wipeTestData = () => {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(TEST_PREFIX)) doomed.push(k);
      }
      doomed.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
    window.location.reload();
  };

  const logout = () => {
    if (TEST_MODE) { exitTestMode(); return; }
    if (currentUser) {
      recordActivity(currentUser, 'logout');
      logAudit('login', 'user', currentUser.id, `User ${currentUser.name} logged out`, 'Session ended');
    }
    setCurrentUser(null);
    saveCurrentUser( null);
    backendApi.setToken(null);
  };

  const addUser = (userData: Omit<User, 'id' | 'createdAt'>): { success: boolean; error?: string } => {
    if (!guard('users', 'create')) return { success: false, error: 'access-denied' };
    const rawPw = (userData.password || '').trim();
    if (!rawPw) {
      return { success: false, error: 'رمز عبور الزامی است / Password is required' };
    }
    const cleanUsername = userData.username.trim().toLowerCase();
    const cleanEmail = userData.email.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return { success: false, error: 'نام کاربری حداقل ۳ حرف باشد / Username must be at least 3 characters' };
    }
    const duplicate = users.find(u =>
      u.username.toLowerCase() === cleanUsername ||
      u.email.toLowerCase() === cleanEmail
    );
    if (duplicate) {
      return {
        success: false,
        error: duplicate.username.toLowerCase() === cleanUsername
          ? 'این نام کاربری قبلاً استفاده شده است'
          : 'این ایمیل قبلاً ثبت گردیده است',
      };
    }
    const newUser: User = {
      ...userData,
      username: cleanUsername,
      email: cleanEmail,
      password: isPasswordHash(rawPw) ? rawPw : hashPassword(rawPw, cleanUsername),
      hashSalt: cleanUsername,
      id: 'user-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newUser]);
    pushUserToServer(newUser);
    logAudit('create', 'user', newUser.id, `Created user ${newUser.name}`, `Role: ${newUser.role}`);
    return { success: true };
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    const keys = Object.keys(updates);
    const selfPasswordOnly = currentUser && id === currentUser.id && keys.length > 0 && keys.every(k => k === 'password');
    if (!selfPasswordOnly && !guard('users', 'edit')) return;
    const target = users.find(u => u.id === id);
    const safe: Partial<User> = { ...updates };
    if (typeof safe.password === 'string' && safe.password.trim() && target && !isPasswordHash(safe.password.trim())) {
      safe.password = hashPassword(safe.password.trim(), target.username);
      safe.hashSalt = target.username.toLowerCase();
    }
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...safe } : u)));
    if (target) pushUserToServer({ ...target, ...safe });
    const logged: Record<string, unknown> = { ...safe };
    if ('password' in logged) logged.password = '[redacted]';
    logAudit('update', 'user', id, `Updated user profile`, JSON.stringify(logged));
  };

  const toggleUserActive = (id: string) => {
    if (!guard('users', 'edit')) return;
    const target = users.find(u => u.id === id);
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, active: !u.active };
        logAudit('update', 'user', id, `${u.name} status changed`, `Active: ${updated.active}`);
        return updated;
      }
      return u;
    }));
    if (target) pushUserToServer({ ...target, active: !target.active });
  };

  const deleteUser = (id: string) => {
    if (!guard('users', 'del')) return;
    const target = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    if (target) deleteUserOnServer(target.id, target.username);
    logAudit('delete', 'user', id, 'Deleted user account', 'User removed from team');
  };

  // Wave 19: expense approval workflow
  const approveExpense = (id: string) => {
    if (!guard('expenses', 'approve')) return;
    setExpenses(prev => prev.map(e => (e.id === id
      ? { ...e, approvalStatus: 'approved' as const, approvedBy: currentUser?.name || currentUser?.username, approvedAt: new Date().toISOString() }
      : e)));
    logAudit('update', 'expense', id, 'Approved expense', `By ${currentUser?.name || currentUser?.username || 'unknown'}`);
  };

  // Wave 23: document lifecycle (draft -> approved -> posted) + reversals.
  const postDoc = <T extends Expense | Payment>(kind: 'expenses' | 'payments', id: string) => {
    if (!guard(kind, 'approve')) return;
    const stamp = { docStatus: 'posted' as const, postedBy: currentUser?.name || currentUser?.username, postedAt: new Date().toISOString() };
    if (kind === 'expenses') {
      setExpenses(prev => prev.map(e => (e.id === id ? { ...e, ...stamp } : e)));
    } else {
      setPayments(prev => prev.map(p => (p.id === id ? { ...p, ...stamp } : p)));
    }
    logAudit('update', kind === 'expenses' ? 'expense' : 'payment', id, 'Posted document (locked)', `By ${stamp.postedBy || 'unknown'}`);
  };

  const unpostDoc = <T extends Expense | Payment>(kind: 'expenses' | 'payments', id: string) => {
    if (!guard(kind, 'approve')) return;
    if (kind === 'expenses') {
      setExpenses(prev => prev.map(e => (e.id === id ? { ...e, docStatus: 'approved' as const, postedBy: undefined, postedAt: undefined } : e)));
    } else {
      setPayments(prev => prev.map(p => (p.id === id ? { ...p, docStatus: 'approved' as const, postedBy: undefined, postedAt: undefined } : p)));
    }
    logAudit('update', kind === 'expenses' ? 'expense' : 'payment', id, 'Unposted document (unlocked for correction)', `By ${currentUser?.name || currentUser?.username || 'unknown'}`);
  };

  const postExpense = (id: string) => postDoc('expenses', id);
  const unpostExpense = (id: string) => unpostDoc('expenses', id);
  const postPayment = (id: string) => postDoc('payments', id);
  const unpostPayment = (id: string) => unpostDoc('payments', id);

  const reverseExpense = (id: string, note?: string) => {
    if (!guard('expenses', 'approve')) return;
    const old = expenses.find(e => e.id === id);
    if (!old || old.reversedBy) return;
    const today = new Date().toISOString().split('T')[0];
    const mirrorId = 'exp-rev-' + Date.now();
    const mirror: Expense = {
      ...old,
      ...expenseReversalMoney(old),
      id: mirrorId,
      date: today,
      title: `برگشت: ${old.title || old.description || ''}`.trim(),
      billNumber: old.billNumber ? `RV-${old.billNumber}` : undefined,
      approvalStatus: 'approved',
      docStatus: 'posted',
      postedBy: currentUser?.name || currentUser?.username,
      postedAt: new Date().toISOString(),
      reversalOf: old.id,
      reversedBy: undefined,
      correctionNote: note?.trim() || `Reversal of ${old.billNumber || old.id}`,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Admin',
    };
    setExpenses(prev => [mirror, ...prev.map(e => (e.id === id
      ? { ...e, reversedBy: mirrorId, docStatus: 'posted' as const, postedBy: mirror.postedBy, postedAt: mirror.postedAt }
      : e))]);
    if (old.partyName && old.partyName.trim() && old.docStatus !== 'draft') {
      const dPurch = -canonicalMoney(old.amount, old.currency, old.exchangeRate).usd;
      const dPaid = -canonicalMoney(old.paidAmount || 0, old.currency, old.exchangeRate).usd;
      setSuppliers(prev => prev.map(s => {
        if (s.projectId === old.projectId && s.name.trim().toLowerCase() === old.partyName!.trim().toLowerCase()) {
          const purchases = (s.totalPurchases || 0) + dPurch;
          const paid = (s.totalPaid || 0) + dPaid;
          return { ...s, totalPurchases: purchases, totalPaid: paid, remainingBalance: Math.max(0, purchases - paid) };
        }
        return s;
      }));
    }
    logAudit('create', 'expense', mirrorId, `Reversed expense ${old.billNumber || id}`, note?.trim() || `Mirror of ${id}; original preserved and locked.`, undefined, undefined, old.projectId);
  };

  const reversePayment = (id: string, note?: string) => {
    if (!guard('payments', 'approve')) return;
    const old = payments.find(p => p.id === id);
    if (!old || old.reversedBy) return;
    const today = new Date().toISOString().split('T')[0];
    const mirrorId = 'pay-rev-' + Date.now();
    const mirror: Payment = {
      ...old,
      ...paymentReversalMoney(old),
      id: mirrorId,
      date: today,
      receiptNumber: old.receiptNumber ? `RV-${old.receiptNumber}` : `RV-${Date.now().toString().slice(-5)}`,
      description: `برگشت: ${old.description || ''}`.trim(),
      docStatus: 'posted',
      postedBy: currentUser?.name || currentUser?.username,
      postedAt: new Date().toISOString(),
      reversalOf: old.id,
      reversedBy: undefined,
      correctionNote: note?.trim() || `Reversal of ${old.receiptNumber || id}`,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Admin',
    };
    setPayments(prev => [mirror, ...prev.map(p => (p.id === id
      ? { ...p, reversedBy: mirrorId, docStatus: 'posted' as const, postedBy: mirror.postedBy, postedAt: mirror.postedAt }
      : p))]);
    if (old.docStatus !== 'draft') {
      applyPaymentDelta(mirror, -payUSD(old));
    }
    logAudit('create', 'payment', mirrorId, `Reversed payment ${old.receiptNumber || id}`, note?.trim() || `Mirror of ${id}; original preserved and locked.`, undefined, undefined, old.projectId);
  };

  const rejectExpense = (id: string) => {
    if (!guard('expenses', 'approve')) return;
    setExpenses(prev => prev.map(e => (e.id === id
      ? { ...e, approvalStatus: 'rejected' as const, approvedBy: currentUser?.name || currentUser?.username, approvedAt: new Date().toISOString() }
      : e)));
    logAudit('update', 'expense', id, 'Rejected expense (excluded from accounts)', `By ${currentUser?.name || currentUser?.username || 'unknown'}`);
  };

  // Projects CRUD
  const addProject = (projectData: Omit<Project, 'id' | 'createdAt'>): Project => {
    if (!guard('projects', 'create')) { return { ...projectData, id: 'denied-' + Date.now(), createdAt: new Date().toISOString() }; }
    const newProject: Project = {
      ...projectData,
      id: 'proj-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectIdState(newProject.id);

    if (newProject.initialGeneralExpenses && newProject.initialGeneralExpenses.length > 0) {
      const createdExpenses: Expense[] = newProject.initialGeneralExpenses
        .filter(item => item.amount > 0)
        .map((item, idx) => {
          const exchangeRate = newProject.defaultExchangeRate || 70;
          const amountUSD = item.currency === 'USD' 
            ? item.amount 
            : (exchangeRate > 0 ? parseFloat((item.amount / exchangeRate).toFixed(2)) : item.amount);
          const amountAFN = item.currency === 'AFN'
            ? item.amount
            : Math.round(item.amount * exchangeRate);
          return {
            id: `exp-init-${Date.now()}-${idx}`,
            projectId: newProject.id,
            category: item.title,
            description: item.notes || `مصرف عمومی اولیه: ${item.title}`,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            amount: amountUSD,
            currency: item.currency,
            exchangeRate,
            amountInUSD: amountUSD,
            amountInAFN: amountAFN,
            paymentStatus: 'paid',
            paidAmount: amountUSD,
            remainingAmount: 0,
            paymentMethod: 'Cash',
            createdAt: new Date().toISOString(),
          };
        });
      if (createdExpenses.length > 0) {
        setExpenses(prev => [...prev, ...createdExpenses]);
      }
    }

    if (newProject.partners && newProject.partners.length > 0) {
      newProject.partners.forEach((part, pIdx) => {
        const pId = 'part-' + Date.now() + '-' + pIdx;
        const newPart: ProjectPartner = {
          ...part,
          id: pId,
          projectId: newProject.id,
          currency: part.currency || newProject.currency || 'AFN',
          createdAt: new Date().toISOString(),
        };
        setProjectPartners(prev => [...prev, newPart]);
        if (newPart.initialInvestment && newPart.initialInvestment > 0) {
          const newInv: ProjectInvestment = {
            id: 'inv-' + Date.now() + '-' + pIdx,
            projectId: newProject.id,
            partnerId: pId,
            partnerName: newPart.name || 'شریک',
            amount: newPart.initialInvestment,
            currency: newPart.currency,
            exchangeRate: newProject.defaultExchangeRate || 70,
            date: newPart.investmentDate || new Date().toISOString().split('T')[0],
            type: 'initial',
            paymentMethod: 'نقد',
            notes: newPart.notes || 'سرمایه‌گذاری اولیه ثبت پروژه',
            createdAt: new Date().toISOString(),
          };
          setProjectInvestments(prev => [newInv, ...prev]);
        }
      });
    }
    logAudit('create', 'project', newProject.id, newProject.name, `New building project created: ${newProject.floors} floors, ${newProject.units} units`, undefined, undefined, newProject.id);
    backendApi.saveProject({
      id: newProject.id,
      name: newProject.name,
      contractValue: newProject.budget,
      approvedBudget: newProject.budget,
      currency: newProject.currency,
      location: newProject.address || newProject.city || '',
      startDate: newProject.startDate,
      expectedFinish: newProject.expectedCompletionDate,
      status: newProject.status,
    }).catch(() => {});
    return newProject;
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    if (!guard('projects', 'edit')) return;
    const oldProj = projects.find(p => p.id === id);
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
    logAudit('update', 'project', id, updates.name || oldProj?.name || 'Project', `Project details updated`, JSON.stringify(oldProj), JSON.stringify(updates), id);
  };

  const deleteProject = (id: string) => {
    if (!guard('projects', 'del')) return;
    const oldProj = projects.find(p => p.id === id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (currentProjectId === id) {
      const remaining = projects.filter(p => p.id !== id);
      if (remaining.length > 0) {
        setCurrentProjectIdState(remaining[0].id);
      }
    }
    setProjectPartners(prev => prev.filter(p => p.projectId !== id));
    setProjectInvestments(prev => prev.filter(i => i.projectId !== id));
    logAudit('delete', 'project', id, oldProj?.name || 'Project', 'Project removed from system');
  };

  const transferProject = (transferData: Omit<ProjectTransferEvent, 'id' | 'createdAt'>): ProjectTransferEvent => {
    if (!guard('projects', 'edit')) { return { ...transferData, id: 'denied-' + Date.now(), createdAt: new Date().toISOString() }; }
    const newEvent: ProjectTransferEvent = {
      ...transferData,
      id: 'trans-' + Date.now(),
      createdAt: new Date().toISOString(),
    };

    setProjects(prev => prev.map(proj => {
      if (proj.id === transferData.projectId) {
        const initialOwner = proj.initialOwner || proj.clientOwner || transferData.previousOwner || 'مالک اولیه';
        const updatedHistory = [...(proj.transferHistory || []), newEvent];
        return {
          ...proj,
          initialOwner,
          currentOwner: transferData.newOwner,
          clientOwner: transferData.newOwner,
          transferHistory: updatedHistory,
        };
      }
      return proj;
    }));

    if (transferData.contractDocumentUrl) {
      const docRecord: DocumentRecord = {
        id: 'doc-trans-' + Date.now(),
        projectId: transferData.projectId,
        title: transferData.contractDocumentName || `سند انتقال پروژه به ${transferData.newOwner}`,
        category: 'contracts',
        fileUrl: transferData.contractDocumentUrl,
        notes: `سند توافق‌نامه و واگذاری به ${transferData.newOwner} در تاریخ ${transferData.transferDate}. ارزش انتقال: ${transferData.transferValue} ${transferData.currency}`,
        date: transferData.transferDate,
        createdAt: new Date().toISOString(),
      };
      setDocuments(prev => [docRecord, ...prev]);
    }

    logAudit(
      'transfer', 
      'project', 
      transferData.projectId, 
      `انتقال پروژه به ${transferData.newOwner}`, 
      `از: ${transferData.previousOwner} ➔ به: ${transferData.newOwner} • ارزش: ${transferData.transferValue} ${transferData.currency} • پرداخت‌شده: ${transferData.amountPaid} • باقی‌داری: ${transferData.remainingAmount} • مرحله: ${transferData.projectStage}`,
      transferData.previousOwner,
      transferData.newOwner,
      transferData.projectId
    );

    backendApi.interProjectTransfer({
      fromProjectId: transferData.projectId,
      toProjectId: transferData.projectId,
      amount: transferData.amountPaid || transferData.transferValue || 0,
      description: `انتقال به ${transferData.newOwner}: ${transferData.notes || ''}`,
      transferDate: transferData.transferDate,
      approvedBy: transferData.createdBy || 'مدیریت',
    }).catch(() => {});

    return newEvent;
  };

  // Partners & Investments Management
  const addProjectPartner = (partnerData: Omit<ProjectPartner, 'id' | 'createdAt'>): ProjectPartner => {
    if (!guard('projects', 'create')) { return { ...partnerData, id: 'denied-' + Date.now(), createdAt: new Date().toISOString() }; }
    const newPartner: ProjectPartner = {
      ...partnerData,
      id: 'part-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    };
    setProjectPartners(prev => [...prev, newPartner]);

    if (newPartner.initialInvestment && newPartner.initialInvestment > 0) {
      const proj = projects.find(p => p.id === newPartner.projectId);
      const exRate = proj?.defaultExchangeRate || 70;
      const initialInv: ProjectInvestment = {
        id: 'inv-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        projectId: newPartner.projectId,
        partnerId: newPartner.id,
        partnerName: newPartner.name || 'شریک',
        amount: newPartner.initialInvestment,
        currency: newPartner.currency || 'AFN',
        exchangeRate: exRate,
        date: newPartner.investmentDate || new Date().toISOString().split('T')[0],
        type: 'initial',
        paymentMethod: 'نقد',
        notes: newPartner.notes || 'سرمایه‌گذاری اولیه ثبت شریک',
        createdAt: new Date().toISOString(),
      };
      setProjectInvestments(prev => [initialInv, ...prev]);
    }
    logAudit('create', 'project', newPartner.projectId, `Partner: ${newPartner.name}`, `Added partner with share: ${newPartner.sharePercentage || 0}%`, undefined, undefined, newPartner.projectId);
    return newPartner;
  };

  const updateProjectPartner = (id: string, updates: Partial<ProjectPartner>) => {
    if (!guard('projects', 'edit')) return;
    const old = projectPartners.find(p => p.id === id);
    setProjectPartners(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
    if (updates.name && old && updates.name !== old.name) {
      setProjectInvestments(prev => prev.map(inv => inv.partnerId === id ? { ...inv, partnerName: updates.name! } : inv));
    }
    logAudit('update', 'project', id, `Partner: ${updates.name || old?.name || id}`, 'Updated partner information', undefined, undefined, old?.projectId);
  };

  const deleteProjectPartner = (id: string) => {
    if (!guard('projects', 'del')) return;
    const old = projectPartners.find(p => p.id === id);
    setProjectPartners(prev => prev.filter(p => p.id !== id));
    setProjectInvestments(prev => prev.filter(inv => inv.partnerId !== id));
    logAudit('delete', 'project', id, `Partner: ${old?.name || id}`, 'Deleted partner and associated records', undefined, undefined, old?.projectId);
  };

  const addProjectInvestment = (invData: Omit<ProjectInvestment, 'id' | 'createdAt'>): ProjectInvestment => {
    if (!guard('projects', 'create')) { return { ...invData, id: 'denied-' + Date.now(), createdAt: new Date().toISOString() }; }
    const proj = projects.find(p => p.id === invData.projectId);
    const newInv: ProjectInvestment = {
      ...invData,
      exchangeRate: invData.exchangeRate || proj?.defaultExchangeRate || 70,
      id: 'inv-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    };
    setProjectInvestments(prev => [newInv, ...prev]);
    logAudit('create', 'project', newInv.id, `Investment: ${newInv.partnerName}`, `Added ${newInv.type === 'initial' ? 'initial' : 'additional'} investment of ${newInv.amount.toLocaleString()} ${newInv.currency}`, undefined, undefined, newInv.projectId);
    return newInv;
  };

  const updateProjectInvestment = (id: string, updates: Partial<ProjectInvestment>) => {
    if (!guard('projects', 'edit')) return;
    const old = projectInvestments.find(inv => inv.id === id);
    setProjectInvestments(prev => prev.map(inv => (inv.id === id ? { ...inv, ...updates } : inv)));
    logAudit('update', 'project', id, `Investment: ${old?.partnerName || id}`, `Updated investment transaction`, undefined, undefined, old?.projectId);
  };

  const deleteProjectInvestment = (id: string) => {
    if (!guard('projects', 'del')) return;
    const old = projectInvestments.find(inv => inv.id === id);
    setProjectInvestments(prev => prev.filter(inv => inv.id !== id));
    logAudit('delete', 'project', id, `Investment: ${old?.partnerName || id}`, `Deleted investment record of ${old?.amount} ${old?.currency}`, undefined, undefined, old?.projectId);
  };

  const transferPartnerEquity = (data: Omit<PartnerEquityTransfer, 'id' | 'createdAt'>): { success: boolean; error?: string; record?: PartnerEquityTransfer } => {
    if (!guard('projects', 'edit')) return { success: false, error: 'access-denied' };
    const seller = projectPartners.find(p => p.id === data.fromPartnerId);
    const v = validateEquityTransfer({ ...data, transferPrice: Number(data.transferPrice) || 0, transferredPercentage: Number(data.transferredPercentage) || 0 }, seller, projectPartners);
    if (!v.ok) {
      logAudit('denied', 'project', data.projectId, 'Blocked invalid equity transfer', v.error || '');
      return { success: false, error: v.error };
    }
    const clean = { ...data, transferPrice: Number(data.transferPrice) || 0, transferredPercentage: Number(data.transferredPercentage) || 0 };
    const id = 'eq-tr-' + Date.now();
    const newTransfer: PartnerEquityTransfer = { ...clean, id, createdAt: new Date().toISOString() };
    const applied = applyEquityTransfer(projectPartners, clean);
    setPartnerEquityTransfers(prev => [newTransfer, ...prev]);
    setProjectPartners(applied.createdBuyer ? [...applied.partners, applied.createdBuyer] : applied.partners);
    logAudit('create', 'project', data.projectId, data.fromPartnerName, `انتقال ${clean.transferredPercentage}٪ سهم‌الشرکه از ${data.fromPartnerName} به ${data.toPartnerName} به مبلغ ${clean.transferPrice} ${data.currency}`, undefined, undefined, data.projectId);
    return { success: true, record: newTransfer };
  };

  // Wave 21: inter-project money/material ledger with owner approval
  const requestInterProjectTransfer = (t: Omit<InterProjectTransfer, 'id' | 'createdAt' | 'status'>): { success: boolean; error?: string; record?: InterProjectTransfer } => {
    if (!guard('projects', 'create')) return { success: false, error: 'access-denied' };
    const amount = Number(t.amount) || 0;
    if (!t.fromProjectId || !t.toProjectId || t.fromProjectId === t.toProjectId) {
      return { success: false, error: 'پروژه مبدأ و مقصد نباید یکسان باشند.' };
    }
    if (!projects.some(p => p.id === t.fromProjectId) || !projects.some(p => p.id === t.toProjectId)) {
      return { success: false, error: 'پروژه مبدأ یا مقصد یافت نشد.' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'مبلغ انتقال باید بزرگتر از صفر باشد.' };
    }
    if (t.date && Number.isNaN(new Date(t.date).getTime())) {
      return { success: false, error: 'تاریخ انتقال نامعتبر است.' };
    }
    const rec: InterProjectTransfer = {
      ...t,
      amount,
      date: t.date || new Date().toISOString().split('T')[0],
      status: 'pending',
      requestedBy: currentUser?.name || currentUser?.username,
      id: 'ipt-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setInterProjectTransfers(prev => [rec, ...prev]);
    logAudit('create', 'project', t.fromProjectId, `Inter-project transfer request → ${t.toProjectId}`, `${t.kind} • ${amount} ${t.currency}`, undefined, undefined, t.fromProjectId);
    return { success: true, record: rec };
  };

  const approveInterProjectTransfer = (id: string) => {
    if (!guard('projects', 'approve')) return;
    setInterProjectTransfers(prev => prev.map(x => (x.id === id && x.status === 'pending'
      ? { ...x, status: 'approved' as const, approvedBy: currentUser?.name || currentUser?.username, approvedAt: new Date().toISOString() }
      : x)));
    logAudit('update', 'project', id, 'Approved inter-project transfer', `By ${currentUser?.name || currentUser?.username || 'unknown'}`);
  };

  const rejectInterProjectTransfer = (id: string) => {
    if (!guard('projects', 'approve')) return;
    setInterProjectTransfers(prev => prev.map(x => (x.id === id && x.status === 'pending'
      ? { ...x, status: 'rejected' as const, approvedBy: currentUser?.name || currentUser?.username, approvedAt: new Date().toISOString() }
      : x)));
    logAudit('update', 'project', id, 'Rejected inter-project transfer', `By ${currentUser?.name || currentUser?.username || 'unknown'}`);
  };

  const getProjectPartners = (projectId: string): ProjectPartner[] => {
    return projectPartners.filter(p => p.projectId === projectId);
  };

  const getProjectInvestments = (projectId: string): ProjectInvestment[] => {
    return projectInvestments.filter(inv => inv.projectId === projectId);
  };

  // Expenses CRUD
  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!guard('expenses', 'create')) return;
    const time = expenseData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const proj = projects.find(p => p.id === expenseData.projectId);
    const exRate = expenseData.exchangeRate || proj?.defaultExchangeRate || 70;
    const currency = expenseData.currency || 'USD';
    // Wave 23: amount is RAW in `currency`; canonicals computed once here.
    const amount = Number(Number(expenseData.amount || 0).toFixed(2));
    const paidAmount = expenseData.paidAmount !== undefined ? Number(Number(expenseData.paidAmount).toFixed(2)) : 0;
    const remainingAmount = Math.max(0, Number((amount - paidAmount).toFixed(2)));
    const paymentStatus: PaymentStatus = expenseData.paymentStatus || (paidAmount >= amount ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'));
    const canon = canonicalMoney(amount, currency, exRate);
    const newExpense: Expense = {
      ...expenseData,
      time,
      amount,
      paidAmount,
      remainingAmount,
      paymentStatus,
      currency,
      exchangeRate: exRate,
      amountInUSD: canon.usd,
      amountInAFN: canon.afn,
      totalAmountUSD: canon.usd,
      totalAmountAFN: canon.afn,
      docStatus: expenseData.docStatus || 'approved',
      id: 'exp-' + Date.now(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Admin',
    };
    setExpenses(prev => [newExpense, ...prev]);

    if (paidAmount > 0) {
      const paidCanon = canonicalMoney(paidAmount, currency, exRate);
      const newPay: Payment = {
        id: 'pay-exp-' + Date.now(),
        projectId: newExpense.projectId,
        date: newExpense.date,
        time: newExpense.time || time,
        receiptNumber: newExpense.billNumber || `EXP-${Date.now().toString().slice(-4)}`,
        partyName: newExpense.partyName || newExpense.category,
        amount: paidAmount,
        currency,
        exchangeRate: exRate,
        amountInUSD: paidCanon.usd,
        amountInAFN: paidCanon.afn,
        amountUSD: paidCanon.usd,
        amountAFN: paidCanon.afn,
        docStatus: newExpense.docStatus,
        method: (newExpense.paymentMethod as any) || 'Cash',
        description: `پرداخت نقدی برای: ${newExpense.item || newExpense.description} (${newExpense.category})`,
        relatedId: newExpense.id,
        relatedType: 'expense',
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Admin',
      };
      setPayments(prev => [newPay, ...prev]);
    }

    // Supplier running balances are USD-based: convert once, update BOTH legs.
    const applySupplierDelta = (usdDelta: number, paidUsdDelta: number) => {
      if (!newExpense.partyName || !newExpense.partyName.trim()) return;
      const pName = newExpense.partyName.trim().toLowerCase();
      setSuppliers(prev => {
        const existing = prev.find(s => s.projectId === newExpense.projectId && s.name.trim().toLowerCase() === pName);
        if (existing) {
          const purchases = (existing.totalPurchases || 0) + usdDelta;
          const paid = (existing.totalPaid || 0) + paidUsdDelta;
          return prev.map(s => s.id === existing.id ? { ...s, totalPurchases: purchases, totalPaid: paid, remainingBalance: Math.max(0, purchases - paid) } : s);
        }
        const newSupp: Supplier = {
          id: 'supp-' + Date.now(),
          projectId: newExpense.projectId,
          name: newExpense.partyName!.trim(),
          phone: '',
          materialsSupplied: newExpense.item || newExpense.category,
          totalPurchases: usdDelta,
          totalPaid: paidUsdDelta,
          remainingBalance: Math.max(0, usdDelta - paidUsdDelta),
          createdAt: new Date().toISOString(),
        };
        return [...prev, newSupp];
      });
    };
    if (newExpense.docStatus !== 'draft') {
      applySupplierDelta(canon.usd, canonicalMoney(paidAmount, currency, exRate).usd);
    }
    logAudit('create', 'expense', newExpense.id, `${newExpense.category}: ${newExpense.description}`, `Amount: $${newExpense.amount.toLocaleString()} - Status: ${newExpense.paymentStatus}`, undefined, `$${newExpense.amount}`, newExpense.projectId);
    backendApi.createPayment({
      projectId: newExpense.projectId,
      amount: newExpense.amount,
      currency: newExpense.currency,
      exchangeRate: newExpense.exchangeRate,
      payeeName: newExpense.partyName || newExpense.category,
      expenseCategory: newExpense.category,
      description: newExpense.description || newExpense.item,
      paymentMethod: (newExpense.paymentMethod || 'cash').toLowerCase(),
      date: newExpense.date,
    }).catch(() => {});
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    if (!guard('expenses', 'edit')) return;
    const old = expenses.find(e => e.id === id);
    if (!old) return;
    if (isLockedDoc(old) && !can('expenses', 'approve')) { denyAccess('expenses', 'edit'); return; }
    const currency = updates.currency || old.currency || 'USD';
    const proj = projects.find(pr => pr.id === (updates.projectId || old.projectId));
    const exRate = updates.exchangeRate || old.exchangeRate || proj?.defaultExchangeRate || 70;
    const amount = updates.amount !== undefined ? Number(Number(updates.amount).toFixed(2)) : old.amount;
    const paidAmount = updates.paidAmount !== undefined ? Number(Number(updates.paidAmount).toFixed(2)) : (old.paidAmount ?? amount);
    const remainingAmount = Math.max(0, Number((amount - paidAmount).toFixed(2)));
    const paymentStatus: PaymentStatus = updates.paymentStatus || (paidAmount >= amount ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'));
    const canon = canonicalMoney(amount, currency, exRate);
    const nextStatus = updates.docStatus || old.docStatus || 'approved';
    setExpenses(prev => prev.map(e => (e.id === id ? {
      ...e,
      ...updates,
      amount,
      paidAmount,
      remainingAmount,
      paymentStatus,
      currency,
      exchangeRate: exRate,
      amountInUSD: canon.usd,
      amountInAFN: canon.afn,
      totalAmountUSD: canon.usd,
      totalAmountAFN: canon.afn,
      docStatus: nextStatus,
    } : e)));

    // Keep the supplier mirror in sync (USD-based): amount deltas + draft flips.
    const pName = (updates.partyName !== undefined ? updates.partyName : old.partyName) || '';
    const oldCounted = old.docStatus !== 'draft';
    const newCounted = nextStatus !== 'draft';
    if (pName.trim() && (updates.partyName === undefined || updates.partyName === old.partyName)) {
      const oldUsd = oldCounted ? canonicalMoney(old.amount, old.currency, old.exchangeRate).usd : 0;
      const newUsd = newCounted ? canon.usd : 0;
      const oldPaidUsd = oldCounted ? canonicalMoney(old.paidAmount || 0, old.currency, old.exchangeRate).usd : 0;
      const newPaidUsd = newCounted ? canonicalMoney(paidAmount, currency, exRate).usd : 0;
      const dPurch = newUsd - oldUsd;
      const dPaid = newPaidUsd - oldPaidUsd;
      if (dPurch !== 0 || dPaid !== 0) {
        setSuppliers(prev => prev.map(s => {
          if (s.projectId === (updates.projectId || old.projectId) && s.name.trim().toLowerCase() === pName.trim().toLowerCase()) {
            const purchases = (s.totalPurchases || 0) + dPurch;
            const paid = (s.totalPaid || 0) + dPaid;
            return { ...s, totalPurchases: purchases, totalPaid: paid, remainingBalance: Math.max(0, purchases - paid) };
          }
          return s;
        }));
      }
    }

    if (updates.paidAmount !== undefined || updates.description !== undefined) {
      setPayments(prev => prev.map(p => {
        if (p.relatedType === 'expense' && p.relatedId === id) {
          const pProj = projects.find(pr => pr.id === (updates.projectId || old.projectId));
          const pRate = p.exchangeRate || pProj?.defaultExchangeRate || 70;
          const newAmt = updates.paidAmount !== undefined ? updates.paidAmount : p.amount;
          const pc = canonicalMoney(newAmt, p.currency, pRate);
          return {
            ...p,
            amount: newAmt,
            amountInUSD: pc.usd,
            amountInAFN: pc.afn,
            amountUSD: pc.usd,
            amountAFN: pc.afn,
            description: updates.description ? `پرداخت برای: ${updates.description}` : p.description,
          };
        }
        return p;
      }));
    }
    logAudit('update', 'expense', id, updates.description || old.description || 'Expense', `Updated expense record`, `$${old.amount}`, `$${amount}`, old.projectId);
  };

  const deleteExpense = (id: string) => {
    if (!guard('expenses', 'del')) return;
    const old = expenses.find(e => e.id === id);
    if (!old) return;
    if (isLockedDoc(old) && !can('expenses', 'approve')) { denyAccess('expenses', 'del'); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (old.docStatus !== 'draft' && old.partyName && old.partyName.trim()) {
      const dPurch = -canonicalMoney(old.amount, old.currency, old.exchangeRate).usd;
      const dPaid = -canonicalMoney(old.paidAmount || 0, old.currency, old.exchangeRate).usd;
      setSuppliers(prev => prev.map(s => {
        if (s.projectId === old.projectId && s.name.trim().toLowerCase() === old.partyName!.trim().toLowerCase()) {
          const purchases = (s.totalPurchases || 0) + dPurch;
          const paid = (s.totalPaid || 0) + dPaid;
          return { ...s, totalPurchases: purchases, totalPaid: paid, remainingBalance: Math.max(0, purchases - paid) };
        }
        return s;
      }));
    }
    setPayments(prev => prev.filter(p => !(p.relatedType === 'expense' && p.relatedId === id)));
    logAudit('delete', 'expense', id, old?.description || 'Expense', `Deleted expense of $${old?.amount}`, `$${old?.amount}`, undefined, old?.projectId);
  };

  const getExpensePayments = (expenseId: string): Payment[] => {
    return payments.filter(p => p.relatedType === 'expense' && p.relatedId === expenseId);
  };

  // Steel CRUD
  const addSteelRecord = (data: Omit<SteelRecord, 'id' | 'tons' | 'totalAmount' | 'remainingBalance' | 'createdAt'>) => {
    if (!guard('steel', 'create')) return;
    const tons = Number((data.kg / 1000).toFixed(3));
    const totalAmount = Number((tons * data.pricePerTon).toFixed(2));
    const paidAmount = Number(Number(data.paidAmount || 0).toFixed(2));
    const remainingBalance = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
    const time = (data as any).time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const proj = projects.find(p => p.id === data.projectId);
    const exRate = (data as any).exchangeRate || proj?.defaultExchangeRate || 70;
    const newRecord: SteelRecord = {
      currency: 'USD',
      time,
      ...data,
      id: 'stl-' + Date.now(),
      tons,
      totalAmount,
      paidAmount,
      remainingBalance,
      exchangeRate: exRate,
      amountInUSD: totalAmount,
      amountInAFN: Math.round(totalAmount * exRate),
      createdAt: new Date().toISOString(),
    };
    setSteelRecords(prev => [newRecord, ...prev]);

    if (paidAmount > 0) {
      const newPay: Payment = {
        id: 'pay-stl-' + Date.now(),
        projectId: newRecord.projectId,
        date: newRecord.date,
        time: newRecord.time || time,
        receiptNumber: newRecord.billNumber,
        partyName: newRecord.supplierName,
        amount: paidAmount,
        currency: 'USD',
        exchangeRate: exRate,
        amountInUSD: paidAmount,
        amountInAFN: Math.round(paidAmount * exRate),
        method: 'Cash',
        description: `خرید نقدی سیخ‌گول (بل #${newRecord.billNumber})`,
        relatedId: newRecord.id,
        relatedType: 'material_steel',
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Admin',
      };
      setPayments(prev => [newPay, ...prev]);
    }

    if (newRecord.supplierName.trim()) {
      setSuppliers(prev => {
        const existing = prev.find(s => s.projectId === newRecord.projectId && s.name.trim().toLowerCase() === newRecord.supplierName.trim().toLowerCase());
        if (existing) {
          return prev;
        } else {
          const newSupp: Supplier = {
            id: 'supp-' + Date.now(),
            projectId: newRecord.projectId,
            name: newRecord.supplierName.trim(),
            phone: '',
            materialsSupplied: 'سیخ‌گول / فولاد',
            totalPurchases: totalAmount,
            totalPaid: paidAmount,
            remainingBalance,
            createdAt: new Date().toISOString(),
          };
          return [...prev, newSupp];
        }
      });
    }
    logAudit('create', 'steel', newRecord.id, `Steel Bill #${newRecord.billNumber} (${newRecord.supplierName})`, `${newRecord.kg} KG (${newRecord.tons} Tons) @ $${newRecord.pricePerTon}/Ton = $${newRecord.totalAmount.toLocaleString()}`, undefined, `$${newRecord.totalAmount}`, newRecord.projectId);
  };

  const updateSteelRecord = (id: string, updates: Partial<SteelRecord>) => {
    const old = steelRecords.find(s => s.id === id);
    if (!old) return;
    const kg = updates.kg !== undefined ? updates.kg : old.kg;
    const pricePerTon = updates.pricePerTon !== undefined ? updates.pricePerTon : old.pricePerTon;
    const paidAmount = updates.paidAmount !== undefined ? Number(Number(updates.paidAmount).toFixed(2)) : old.paidAmount;
    const tons = Number((kg / 1000).toFixed(3));
    const totalAmount = Number((tons * pricePerTon).toFixed(2));
    const remainingBalance = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
    setSteelRecords(prev => prev.map(s => (s.id === id ? { 
      ...s, 
      ...updates, 
      kg, 
      pricePerTon, 
      tons, 
      totalAmount, 
      paidAmount, 
      remainingBalance 
    } : s)));
    logAudit('update', 'steel', id, `Steel Bill #${updates.billNumber || old.billNumber}`, `Updated steel record`, `$${old.totalAmount}`, `$${totalAmount}`, old.projectId);
  };

  const deleteSteelRecord = (id: string) => {
    if (!guard('steel', 'del')) return;
    const old = steelRecords.find(s => s.id === id);
    setSteelRecords(prev => prev.filter(s => s.id !== id));
    setPayments(prev => prev.filter(p => !(p.relatedType === 'material_steel' && p.relatedId === id)));
    logAudit('delete', 'steel', id, `Steel Bill #${old?.billNumber}`, `Deleted steel record of $${old?.totalAmount}`, `$${old?.totalAmount}`, undefined, old?.projectId);
  };

  // Concrete CRUD
  const addConcreteRecord = (data: Omit<ConcreteRecord, 'id' | 'totalAmount' | 'remainingBalance' | 'createdAt'>) => {
    if (!guard('concrete', 'create')) return;
    const totalAmount = Number(((data.quantityM3 * data.pricePerM3) + (data.pumpCharge || 0)).toFixed(2));
    const paidAmount = Number(Number(data.paidAmount || 0).toFixed(2));
    const remainingBalance = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
    const time = (data as any).time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const proj = projects.find(p => p.id === data.projectId);
    const exRate = (data as any).exchangeRate || proj?.defaultExchangeRate || 70;
    const newRecord: ConcreteRecord = {
      currency: 'USD',
      time,
      ...data,
      id: 'cnc-' + Date.now(),
      totalAmount,
      paidAmount,
      remainingBalance,
      exchangeRate: exRate,
      amountInUSD: totalAmount,
      amountInAFN: Math.round(totalAmount * exRate),
      createdAt: new Date().toISOString(),
    };
    setConcreteRecords(prev => [newRecord, ...prev]);

    if (paidAmount > 0) {
      const newPay: Payment = {
        id: 'pay-cnc-' + Date.now(),
        projectId: newRecord.projectId,
        date: newRecord.date,
        time: newRecord.time || time,
        receiptNumber: newRecord.billNumber,
        partyName: newRecord.supplierName,
        amount: paidAmount,
        currency: 'USD',
        exchangeRate: exRate,
        amountInUSD: paidAmount,
        amountInAFN: Math.round(paidAmount * exRate),
        method: 'Cash',
        description: `پرداخت نقدی کانکریت‌ریزی (تکت #${newRecord.billNumber})`,
        relatedId: newRecord.id,
        relatedType: 'material_concrete',
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Admin',
      };
      setPayments(prev => [newPay, ...prev]);
    }

    if (newRecord.supplierName.trim()) {
      setSuppliers(prev => {
        const existing = prev.find(s => s.projectId === newRecord.projectId && s.name.trim().toLowerCase() === newRecord.supplierName.trim().toLowerCase());
        if (existing) {
          return prev;
        } else {
          const newSupp: Supplier = {
            id: 'supp-' + Date.now(),
            projectId: newRecord.projectId,
            name: newRecord.supplierName.trim(),
            phone: '',
            materialsSupplied: 'کانکریت آماده و پمپ',
            totalPurchases: totalAmount,
            totalPaid: paidAmount,
            remainingBalance,
            createdAt: new Date().toISOString(),
          };
          return [...prev, newSupp];
        }
      });
    }
    logAudit('create', 'concrete', newRecord.id, `Concrete Bill #${newRecord.billNumber} (${newRecord.supplierName})`, `${newRecord.quantityM3} m³ @ $${newRecord.pricePerM3}/m³ = $${newRecord.totalAmount.toLocaleString()}`, undefined, `$${newRecord.totalAmount}`, newRecord.projectId);
  };

  const updateConcreteRecord = (id: string, updates: Partial<ConcreteRecord>) => {
    const old = concreteRecords.find(c => c.id === id);
    if (!old) return;
    const quantityM3 = updates.quantityM3 !== undefined ? updates.quantityM3 : old.quantityM3;
    const pricePerM3 = updates.pricePerM3 !== undefined ? updates.pricePerM3 : old.pricePerM3;
    const pumpCharge = updates.pumpCharge !== undefined ? updates.pumpCharge : (old.pumpCharge || 0);
    const paidAmount = updates.paidAmount !== undefined ? Number(Number(updates.paidAmount).toFixed(2)) : old.paidAmount;
    const totalAmount = Number(((quantityM3 * pricePerM3) + pumpCharge).toFixed(2));
    const remainingBalance = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
    setConcreteRecords(prev => prev.map(c => (c.id === id ? {
      ...c,
      ...updates,
      quantityM3,
      pricePerM3,
      pumpCharge,
      totalAmount,
      paidAmount,
      remainingBalance
    } : c)));
    logAudit('update', 'concrete', id, `Concrete Bill #${updates.billNumber || old.billNumber}`, `Updated concrete pour record`, `$${old.totalAmount}`, `$${totalAmount}`, old.projectId);
  };

  const deleteConcreteRecord = (id: string) => {
    if (!guard('concrete', 'del')) return;
    const old = concreteRecords.find(c => c.id === id);
    setConcreteRecords(prev => prev.filter(c => c.id !== id));
    setPayments(prev => prev.filter(p => !(p.relatedType === 'material_concrete' && p.relatedId === id)));
    logAudit('delete', 'concrete', id, `Concrete Bill #${old?.billNumber}`, `Deleted concrete record of $${old?.totalAmount}`, `$${old?.totalAmount}`, undefined, old?.projectId);
  };

  // Contractors CRUD
  const addContractor = (data: Omit<Contractor, 'id' | 'createdAt'>) => {
    if (!guard('contractors', 'create')) return;
    const newContractor: Contractor = {
      workDescription: '',
      ...data,
      id: 'cont-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setContractors(prev => [...prev, newContractor]);
    logAudit('create', 'contractor', newContractor.id, newContractor.name, `New contractor added: ${newContractor.contractType}, Contract: $${newContractor.contractAmount.toLocaleString()}`, undefined, `$${newContractor.contractAmount}`, newContractor.projectId);
  };

  const updateContractor = (id: string, updates: Partial<Contractor>) => {
    if (!guard('contractors', 'edit')) return;
    const old = contractors.find(c => c.id === id);
    setContractors(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
    logAudit('update', 'contractor', id, updates.name || old?.name || 'Contractor', `Updated contractor terms`, `$${old?.contractAmount}`, `$${updates.contractAmount ?? old?.contractAmount}`, old?.projectId);
  };

  const deleteContractor = (id: string) => {
    if (!guard('contractors', 'del')) return;
    const old = contractors.find(c => c.id === id);
    setContractors(prev => prev.filter(c => c.id !== id));
    logAudit('delete', 'contractor', id, old?.name || 'Contractor', `Deleted contractor`, `$${old?.contractAmount}`, undefined, old?.projectId);
  };

  // Suppliers CRUD
  const addSupplier = (data: Omit<Supplier, 'id' | 'createdAt'>) => {
    if (!guard('suppliers', 'create')) return;
    const newSupplier: Supplier = {
      contact: '',
      ...data,
      id: 'supp-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setSuppliers(prev => [...prev, newSupplier]);
    logAudit('create', 'supplier', newSupplier.id, newSupplier.name, `Registered supplier: ${newSupplier.materialsSupplied}`, undefined, undefined, newSupplier.projectId);
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    const old = suppliers.find(s => s.id === id);
    setSuppliers(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
    logAudit('update', 'supplier', id, updates.name || old?.name || 'Supplier', `Updated supplier information`, undefined, undefined, old?.projectId);
  };

  const deleteSupplier = (id: string) => {
    if (!guard('suppliers', 'del')) return;
    const old = suppliers.find(s => s.id === id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
    logAudit('delete', 'supplier', id, old?.name || 'Supplier', `Deleted supplier`, undefined, undefined, old?.projectId);
  };

  // Labor & Payroll Records
  const addLaborRecord = (record: Omit<LaborRecord, 'id' | 'createdAt'>) => {
    if (!guard('labor', 'create')) return;
    const id = 'lab-' + Date.now();
    const newRecord: LaborRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString()
    };
    setLaborRecords(prev => [newRecord, ...prev]);
    logAudit('create', 'expense', id, record.workerName, `ثبت معاش کارگری برای ${record.workerName}: ${record.netPayable} AFN`, undefined, undefined, record.projectId);
  };

  const deleteLaborRecord = (id: string) => {
    if (!guard('labor', 'del')) return;
    const old = laborRecords.find(l => l.id === id);
    setLaborRecords(prev => prev.filter(l => l.id !== id));
    logAudit('delete', 'expense', id, old?.workerName || 'Labor Record', `حذف رکورد معاش کارگری`, undefined, undefined, old?.projectId);
  };

  // Fixed Assets & Heavy Machinery CRUD
  const addAsset = (asset: Omit<FixedAsset, 'id' | 'createdAt'>) => {
    if (!guard('assets', 'create')) return;
    const id = 'ast-' + Date.now();
    const newAsset: FixedAsset = {
      ...asset,
      id,
      createdAt: new Date().toISOString()
    };
    setAssets(prev => [newAsset, ...prev]);
    logAudit('create', 'expense', id, asset.name, `ثبت دارایی ثابت/ماشین‌آلات: ${asset.name} (${asset.assetTag}) - قیمت: $${asset.purchaseCost}`, undefined, undefined, asset.assignedProjectId);
  };

  const updateAsset = (id: string, updates: Partial<FixedAsset>) => {
    if (!guard('assets', 'edit')) return;
    const old = assets.find(a => a.id === id);
    setAssets(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));
    logAudit('update', 'expense', id, updates.name || old?.name || 'Asset', `ویرایش مشخصات ماشین‌آلات/دارایی`, undefined, undefined, old?.assignedProjectId);
  };

  const deleteAsset = (id: string) => {
    if (!guard('assets', 'del')) return;
    const old = assets.find(a => a.id === id);
    setAssets(prev => prev.filter(a => a.id !== id));
    logAudit('delete', 'expense', id, old?.name || 'Asset', `حذف دارایی ثابت/ماشین‌آلات`, undefined, undefined, old?.assignedProjectId);
  };

  // Apartments & Sales CRUD
  const addApartment = (data: Omit<ApartmentUnit, 'id' | 'salePrice' | 'remainingBalance' | 'createdAt'> & { salePrice?: number }) => {
    if (!guard('apartments', 'create')) return;
    const pricePerM2 = data.pricePerM2 || (data.salePrice && data.areaM2 ? Math.round(data.salePrice / data.areaM2) : 0);
    const salePrice = data.salePrice || Math.round(data.areaM2 * pricePerM2);
    const amountReceived = data.amountReceived || 0;
    const remainingBalance = salePrice - amountReceived;
    const newUnit: ApartmentUnit = {
      ...data,
      id: 'unit-' + Date.now(),
      pricePerM2,
      salePrice,
      amountReceived,
      remainingBalance,
      createdAt: new Date().toISOString(),
    };
    setApartments(prev => [...prev, newUnit]);
    logAudit('create', 'apartment', newUnit.id, `Unit #${newUnit.unitNumber} (Floor ${newUnit.floor})`, `Added apartment unit: ${newUnit.areaM2} m², Status: ${newUnit.status}${newUnit.buyerName ? ` - Buyer: ${newUnit.buyerName}` : ''}`, undefined, `$${newUnit.salePrice}`, newUnit.projectId);
  };

  const updateApartment = (id: string, updates: Partial<ApartmentUnit>) => {
    if (!guard('apartments', 'edit')) return;
    const old = apartments.find(a => a.id === id);
    if (!old) return;
    const areaM2 = updates.areaM2 !== undefined ? updates.areaM2 : old.areaM2;
    const pricePerM2 = updates.pricePerM2 !== undefined ? updates.pricePerM2 : old.pricePerM2 || 0;
    const salePrice = updates.salePrice !== undefined ? updates.salePrice : (pricePerM2 > 0 ? Math.round(areaM2 * pricePerM2) : (old.salePrice || 0));
    const amountReceived = updates.amountReceived !== undefined ? updates.amountReceived : (old.amountReceived || 0);
    const remainingBalance = salePrice - amountReceived;
    setApartments(prev => prev.map(a => (a.id === id ? {
      ...a,
      ...updates,
      areaM2,
      pricePerM2,
      salePrice,
      amountReceived,
      remainingBalance
    } : a)));
    logAudit('update', 'apartment', id, `Unit #${updates.unitNumber || old.unitNumber}`, `Updated apartment / buyer details`, `$${old.salePrice}`, `$${salePrice}`, old.projectId);
  };

  const deleteApartment = (id: string) => {
    if (!guard('apartments', 'del')) return;
    const old = apartments.find(a => a.id === id);
    setApartments(prev => prev.filter(a => a.id !== id));
    logAudit('delete', 'apartment', id, `Unit #${old?.unitNumber}`, `Deleted apartment unit`, `$${old?.salePrice}`, undefined, old?.projectId);
  };

  // Apartment installments CRUD
  const addInstallmentToApartment = (apartmentId: string, installmentData: Omit<InstallmentRecord, 'id' | 'remainingAmount' | 'status' | 'paymentHistory'>) => {
    if (!guard('apartments', 'create')) return;
    const apt = apartments.find(a => a.id === apartmentId);
    if (!apt) return;
    const paidAmount = installmentData.paidAmount || 0;
    const newInst: InstallmentRecord = {
      ...installmentData,
      id: 'inst-' + Date.now(),
      paidAmount,
      remainingAmount: Math.max(0, installmentData.amount - paidAmount),
      status: paidAmount >= installmentData.amount ? 'Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Pending'),
      paymentHistory: [],
    };
    setApartments(prev => prev.map(a => (a.id === apartmentId ? { ...a, installments: [...(a.installments || []), newInst] } : a)));
    logAudit('create', 'apartment', apartmentId, `Unit #${apt.unitNumber} Installment #${newInst.installmentNumber}`, `Added installment of $${newInst.amount} due ${newInst.dueDate}`, undefined, `$${newInst.amount}`, apt.projectId);
  };

  const addInstallmentPayment = (apartmentId: string, installmentId: string, amount: number, paymentMethod?: string, receiptNumber?: string, notes?: string) => {
    if (!guard('apartments', 'create')) return;
    if (!amount || amount <= 0) return;
    const apt = apartments.find(a => a.id === apartmentId);
    const inst = apt?.installments?.find(i => i.id === installmentId);
    if (!apt || !inst) return;
    const today = new Date().toISOString().split('T')[0];
    const payment: InstallmentPaymentRecord = {
      id: 'instpay-' + Date.now(),
      amount,
      currency: inst.currency || apt.currency || 'USD',
      date: today,
      receiptNumber,
      notes: notes || (paymentMethod ? `Method: ${paymentMethod}` : undefined),
      receivedBy: currentUser?.name,
    };
    const paidAmount = inst.paidAmount + amount;
    const remainingAmount = Math.max(0, inst.amount - paidAmount);
    const fullyPaid = remainingAmount <= 0;
    setApartments(prev => prev.map(a => {
      if (a.id !== apartmentId) return a;
      const totalReceived = (a.totalReceived || 0) + amount;
      return {
        ...a,
        installments: (a.installments || []).map(i => (i.id === installmentId ? {
          ...i,
          paidAmount,
          remainingAmount,
          status: fullyPaid ? 'Paid' : 'Partially Paid',
          paymentHistory: [...i.paymentHistory, payment],
          received: fullyPaid ? true : i.received,
          receivedDate: fullyPaid ? today : i.receivedDate,
        } : i)),
        totalReceived,
        amountReceived: totalReceived,
        remainingBalance: (a.salePrice || 0) - totalReceived,
      };
    }));
    logAudit('create', 'payment', payment.id, `Installment #${inst.installmentNumber} (Unit #${apt.unitNumber})`, `Installment payment of $${amount}${paymentMethod ? ` via ${paymentMethod}` : ''}${receiptNumber ? ` — Receipt ${receiptNumber}` : ''}`, undefined, `$${amount}`, apt.projectId);
  };

  const updateInstallment = (apartmentId: string, installmentId: string, updates: Partial<InstallmentRecord>) => {
    if (!guard('apartments', 'edit')) return;
    const apt = apartments.find(a => a.id === apartmentId);
    const inst = apt?.installments?.find(i => i.id === installmentId);
    if (!apt || !inst) return;
    const amount = updates.amount !== undefined ? updates.amount : inst.amount;
    const paidAmount = updates.paidAmount !== undefined ? updates.paidAmount : inst.paidAmount;
    const delta = paidAmount - inst.paidAmount;
    const remainingAmount = Math.max(0, amount - paidAmount);
    const status = updates.status || (remainingAmount <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Pending'));
    setApartments(prev => prev.map(a => {
      if (a.id !== apartmentId) return a;
      const totalReceived = (a.totalReceived || 0) + delta;
      return {
        ...a,
        installments: (a.installments || []).map(i => (i.id === installmentId ? { ...i, ...updates, amount, paidAmount, remainingAmount, status } : i)),
        totalReceived,
        amountReceived: totalReceived,
        remainingBalance: (a.salePrice || 0) - totalReceived,
      };
    }));
    logAudit('update', 'apartment', apartmentId, `Unit #${apt.unitNumber} Installment #${inst.installmentNumber}`, `Updated installment schedule`, `$${inst.amount}`, `$${amount}`, apt.projectId);
  };

  const deleteInstallment = (apartmentId: string, installmentId: string) => {
    if (!guard('apartments', 'del')) return;
    const apt = apartments.find(a => a.id === apartmentId);
    const inst = apt?.installments?.find(i => i.id === installmentId);
    if (!apt || !inst) return;
    setApartments(prev => prev.map(a => {
      if (a.id !== apartmentId) return a;
      const totalReceived = Math.max(0, (a.totalReceived || 0) - inst.paidAmount);
      return {
        ...a,
        installments: (a.installments || []).filter(i => i.id !== installmentId),
        totalReceived,
        amountReceived: totalReceived,
        remainingBalance: (a.salePrice || 0) - totalReceived,
      };
    }));
    logAudit('delete', 'apartment', apartmentId, `Unit #${apt.unitNumber} Installment #${inst.installmentNumber}`, `Deleted installment of $${inst.amount}`, `$${inst.amount}`, undefined, apt.projectId);
  };

  // Payments CRUD
  // Wave 23: single choke-point for payment<->balance effects (balances are USD-based;
  // the linked expense leg converts into the expense's own currency).
  const applyPaymentDelta = (
    pay: { relatedType?: Payment['relatedType']; relatedId?: string; partyName: string; projectId: string; exchangeRate?: number },
    deltaUSD: number,
  ) => {
    if (!deltaUSD || !pay.relatedType) return;
    const proj = projects.find(p => p.id === pay.projectId);
    const rate = pay.exchangeRate || proj?.defaultExchangeRate || 70;
    const adding = deltaUSD >= 0;
    const mag = Math.abs(deltaUSD);
    if (pay.relatedType === 'apartment_sale' && pay.relatedId) {
      setApartments(prev => prev.map(u => {
        if (u.id !== pay.relatedId) return u;
        const salePrice = u.salePrice || 0;
        if (adding) {
          const newReceived = (u.amountReceived || 0) + mag;
          return { ...u, amountReceived: newReceived, remainingBalance: Math.max(0, salePrice - newReceived), status: newReceived >= salePrice ? 'sold' : u.status };
        }
        const newReceived = Math.max(0, (u.amountReceived || 0) - mag);
        return { ...u, amountReceived: newReceived, remainingBalance: Math.max(0, salePrice - newReceived), status: newReceived < salePrice && u.status === 'sold' ? 'reserved' : u.status };
      }));
    } else if ((pay.relatedType === 'material_steel' || pay.relatedType === 'steel') && pay.relatedId) {
      setSteelRecords(prev => prev.map(s => {
        if (s.id !== pay.relatedId) return s;
        const paidAmount = adding ? (s.paidAmount || 0) + mag : Math.max(0, (s.paidAmount || 0) - mag);
        return { ...s, paidAmount, remainingBalance: Math.max(0, s.totalAmount - paidAmount) };
      }));
    } else if ((pay.relatedType === 'material_concrete' || pay.relatedType === 'concrete') && pay.relatedId) {
      setConcreteRecords(prev => prev.map(x => {
        if (x.id !== pay.relatedId) return x;
        const paidAmount = adding ? (x.paidAmount || 0) + mag : Math.max(0, (x.paidAmount || 0) - mag);
        return { ...x, paidAmount, remainingBalance: Math.max(0, x.totalAmount - paidAmount) };
      }));
    } else if (pay.relatedType === 'contractor') {
      setContractors(prev => prev.map(x => {
        if (x.id !== pay.relatedId && x.name.toLowerCase() !== pay.partyName.toLowerCase()) return x;
        const newPaid = adding ? (x.totalPaid || 0) + mag : Math.max(0, (x.totalPaid || 0) - mag);
        return { ...x, totalPaid: newPaid, remainingBalance: Math.max(0, x.contractAmount - newPaid) };
      }));
    } else if (pay.relatedType === 'supplier') {
      setSuppliers(prev => prev.map(s => {
        if (s.id !== pay.relatedId && s.name.toLowerCase() !== pay.partyName.toLowerCase()) return s;
        const newPaid = adding ? (s.totalPaid || 0) + mag : Math.max(0, (s.totalPaid || 0) - mag);
        const purchases = s.totalPurchases || 0;
        return { ...s, totalPaid: newPaid, remainingBalance: Math.max(0, purchases - newPaid) };
      }));
    } else if (pay.relatedType === 'expense' && pay.relatedId) {
      const targetExp = expenses.find(e => e.id === pay.relatedId);
      const expRate = targetExp?.exchangeRate || rate;
      const deltaExp = targetExp && (targetExp.currency || 'USD').toUpperCase() === 'AFN' ? mag * expRate : mag;
      setExpenses(prev => prev.map(e => {
        if (e.id !== pay.relatedId) return e;
        const paidAmount = adding ? (e.paidAmount || 0) + deltaExp : Math.max(0, (e.paidAmount || 0) - deltaExp);
        return {
          ...e,
          paidAmount,
          remainingAmount: Math.max(0, e.amount - paidAmount),
          paymentStatus: paidAmount >= e.amount ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'),
        };
      }));
      const supplierName = targetExp?.partyName || pay.partyName;
      if (supplierName && supplierName.trim()) {
        setSuppliers(prev => prev.map(s => {
          if (s.projectId === (targetExp?.projectId || pay.projectId) && s.name.trim().toLowerCase() === supplierName.trim().toLowerCase()) {
            const newPaid = adding ? (s.totalPaid || 0) + mag : Math.max(0, (s.totalPaid || 0) - mag);
            const purchases = s.totalPurchases || 0;
            return { ...s, totalPaid: newPaid, remainingBalance: Math.max(0, purchases - newPaid) };
          }
          return s;
        }));
      }
    }
  };

  const addPayment = (paymentData: Omit<Payment, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!guard('payments', 'create')) return;
    const time = paymentData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const proj = projects.find(p => p.id === paymentData.projectId);
    const exRate = paymentData.exchangeRate || proj?.defaultExchangeRate || 70;
    const currency = paymentData.currency || 'USD';
    const raw = Number(paymentData.amount) || 0;
    const canon = canonicalMoney(raw, currency, exRate);
    const newPayment: Payment = {
      ...paymentData,
      time,
      amount: raw,
      currency,
      exchangeRate: exRate,
      amountInUSD: canon.usd,
      amountInAFN: canon.afn,
      amountUSD: canon.usd,
      amountAFN: canon.afn,
      docStatus: paymentData.docStatus || 'approved',
      id: 'pay-' + Date.now(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Admin',
    };
    setPayments(prev => [newPayment, ...prev]);
    if (newPayment.docStatus !== 'draft') {
      applyPaymentDelta(newPayment, canon.usd);
    }
    logAudit('create', 'payment', newPayment.id, `Payment to/from: ${newPayment.partyName}`, `Amount: $${newPayment.amount.toLocaleString()} (${newPayment.method}) - ${newPayment.description}`, undefined, `$${newPayment.amount}`, newPayment.projectId);
  };

  const deletePayment = (id: string) => {
    if (!guard('payments', 'del')) return;
    const old = payments.find(p => p.id === id);
    if (!old) return;
    if (isLockedDoc(old) && !can('payments', 'approve')) { denyAccess('payments', 'del'); return; }
    setPayments(prev => prev.filter(p => p.id !== id));
    if (old.docStatus !== 'draft') {
      applyPaymentDelta(old, -payUSD(old));
    }
    logAudit('delete', 'payment', id, `Payment: ${old?.partyName}`, `Deleted payment voucher #${old?.receiptNumber || id}`, `$${old?.amount}`, undefined, old?.projectId);
  };

  const updatePayment = (id: string, updates: Partial<Payment>) => {
    if (!guard('payments', 'edit')) return;
    const old = payments.find(p => p.id === id);
    if (!old) return;
    if (isLockedDoc(old) && !can('payments', 'approve')) { denyAccess('payments', 'edit'); return; }
    const currency = updates.currency || old.currency || 'USD';
    const proj = projects.find(pr => pr.id === (updates.projectId || old.projectId));
    const exRate = updates.exchangeRate || old.exchangeRate || proj?.defaultExchangeRate || 70;
    const raw = updates.amount !== undefined ? Number(updates.amount) || 0 : old.amount;
    const canon = canonicalMoney(raw, currency, exRate);
    const next: Payment = {
      ...old,
      ...updates,
      amount: raw,
      currency,
      exchangeRate: exRate,
      amountInUSD: canon.usd,
      amountInAFN: canon.afn,
      amountUSD: canon.usd,
      amountAFN: canon.afn,
    };
    setPayments(prev => prev.map(p => (p.id === id ? next : p)));
    // Re-apply balance effects: unapply old, apply new (handles amount + retarget edits).
    const wasCounted = old.docStatus !== 'draft';
    const isCounted = next.docStatus !== 'draft';
    const targetChanged = updates.relatedId !== undefined || updates.relatedType !== undefined || updates.projectId !== undefined;
    if (wasCounted && (targetChanged || !isCounted)) {
      applyPaymentDelta(old, -payUSD(old));
    }
    if (isCounted) {
      if (wasCounted && !targetChanged) {
        const delta = canon.usd - payUSD(old);
        if (delta !== 0) applyPaymentDelta(next, delta);
      } else {
        applyPaymentDelta(next, canon.usd);
      }
    }
    logAudit('update', 'payment', id, updates.partyName || old.partyName || 'Payment', `Updated payment: $${old.amount} -> $${raw} ${currency}`, `$${old.amount}`, `$${raw}`, next.projectId);
  };

  const debtorParties = useMemo(() => {
    const list: Array<{
      partyName: string;
      category: string;
      relatedType: 'contractor' | 'supplier' | 'steel' | 'concrete' | 'expense' | 'material_steel' | 'material_concrete';
      relatedId: string;
      debtAmount: number;
      title: string;
    }> = [];

    contractors.filter(c => c.projectId === currentProjectId).forEach(c => {
      const remaining = Math.max(0, c.contractAmount - (c.totalPaid || 0));
      if (remaining > 0) {
        list.push({
          partyName: c.name,
          category: 'contractor',
          relatedType: 'contractor',
          relatedId: c.id,
          debtAmount: remaining,
          title: `${c.name} (${c.contractType || 'Contractor'}) - باقی‌داری: $${remaining.toLocaleString()}`,
        });
      }
    });

    suppliers.filter(s => s.projectId === currentProjectId).forEach(s => {
      const remaining = s.remainingBalance !== undefined ? s.remainingBalance : Math.max(0, (s.totalPurchases || 0) - (s.totalPaid || 0));
      if (remaining > 0) {
        list.push({
          partyName: s.name,
          category: 'supplier',
          relatedType: 'supplier',
          relatedId: s.id,
          debtAmount: remaining,
          title: `${s.name} (${s.materialsSupplied || 'Supplier'}) - باقی‌داری: $${remaining.toLocaleString()}`,
        });
      }
    });

    steelRecords.filter(s => s.projectId === currentProjectId && s.remainingBalance > 0).forEach(s => {
      list.push({
        partyName: s.supplierName,
        category: 'steel',
        relatedType: 'material_steel',
        relatedId: s.id,
        debtAmount: s.remainingBalance,
        title: `${s.supplierName} (بل سیخ #${s.billNumber}) - باقی‌داری: $${s.remainingBalance.toLocaleString()}`,
      });
    });

    concreteRecords.filter(c => c.projectId === currentProjectId && c.remainingBalance > 0).forEach(c => {
      list.push({
        partyName: c.supplierName,
        category: 'concrete',
        relatedType: 'material_concrete',
        relatedId: c.id,
        debtAmount: c.remainingBalance,
        title: `${c.supplierName} (تکت کانکریت #${c.billNumber}) - باقی‌داری: $${c.remainingBalance.toLocaleString()}`,
      });
    });

    expenses.filter(e => e.projectId === currentProjectId && (e.remainingAmount || 0) > 0).forEach(e => {
      const itemTitle = e.item ? `${e.item}${e.quantity ? ` (${e.quantity} ${e.unit || ''})` : ''}` : e.description;
      const billInfo = e.billNumber ? ` (بل #${e.billNumber})` : '';
      const party = e.partyName ? ` - فروشنده: ${e.partyName}` : e.category;
      list.push({
        partyName: e.partyName || e.category,
        category: 'expense',
        relatedType: 'expense',
        relatedId: e.id,
        debtAmount: e.remainingAmount || 0,
        title: `خریداری: ${itemTitle} ${billInfo ? ` ${billInfo}` : ''} - ${party} - باقی‌داری: $${(e.remainingAmount || 0).toLocaleString()}`,
      });
    });

    return list;
  }, [contractors, suppliers, steelRecords, concreteRecords, expenses, currentProjectId]);

  // Documents CRUD & Camera Capture
  const addDocument = (docData: Omit<DocumentRecord, 'id' | 'createdAt'>) => {
    if (!guard('documents', 'create')) return;
    const newDoc: DocumentRecord = {
      ...docData,
      id: 'doc-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setDocuments(prev => [newDoc, ...prev]);
    logAudit('create', 'expense', newDoc.id, `Document: ${newDoc.title}`, `Category: ${newDoc.category} - File: ${newDoc.fileName}`, undefined, undefined, newDoc.projectId);
  };

  const updateDocument = (id: string, updates: Partial<DocumentRecord>) => {
    if (!guard('documents', 'edit')) return;
    const old = documents.find(d => d.id === id);
    if (!old) return;
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, ...updates } : d)));
    logAudit('update', 'expense', id, `Document updated: ${old.title}`, `Fields: ${Object.keys(updates).join(', ')}`, undefined, undefined, old.projectId);
  };

  const deleteDocument = (id: string) => {
    if (!guard('documents', 'del')) return;
    const old = documents.find(d => d.id === id);
    setDocuments(prev => prev.filter(d => d.id !== id));
    logAudit('delete', 'expense', id, `Document: ${old?.title}`, `Removed attached document`, undefined, undefined, old?.projectId);
  };

  const openCameraForCapture = (target?: { title?: string; relatedType?: string; relatedId?: string; amount?: number }) => {
    setCameraTargetData(target || null);
    setCameraModalOpen(true);
  };

  const saveCameraPhotoAsDocument = (photoDataUrl: string, title: string, amount?: number) => {
    const newDoc: DocumentRecord = {
      id: 'doc-cam-' + Date.now(),
      projectId: currentProjectId,
      title: title || `عکس بل ${new Date().toLocaleDateString()}`,
      category: 'bill',
      fileUrl: photoDataUrl,
      fileName: `Camera_Receipt_${Date.now()}.jpg`,
      fileType: 'image/jpeg',
      fileSize: 'تصویر کمره',
      relatedType: cameraTargetData?.relatedType || 'expense',
      relatedId: cameraTargetData?.relatedId,
      amount: amount || cameraTargetData?.amount,
      date: new Date().toISOString().split('T')[0],
      notes: 'ثبت مستقیم با کمره از ساحه کار.',
      createdAt: new Date().toISOString(),
    };
    setDocuments(prev => [newDoc, ...prev]);
    setCameraModalOpen(false);
    setCameraTargetData(null);
    logAudit('create', 'expense', newDoc.id, newDoc.title, 'Photo of physical bill captured and saved to project', undefined, undefined, currentProjectId);
  };

  // Google Drive: Backup database to Google Drive
  const backupToGoogleDrive = async (): Promise<{ success: boolean; fileLink?: string; error?: string }> => {
    try {
      const token = await getAccessToken();
      if (!token) {
        const connected = await connectGoogleDrive();
        if (!connected) {
          return { success: false, error: tp('Please sign in with your Google account first.', 'لطفاً ابتدا با حساب گوگل خود وارد شوید.', 'لومړی له خپل ګوګل حساب سره ننوځئ.') };
        }
      }

      // 1. Create/Find parent folder "NIK SMART COUNT"
      const parentFolderId = await getOrCreateFolder('NIK SMART COUNT');
      // 2. Create/Find project subfolder
      const projFolderId = await getOrCreateFolder(currentProject?.name || 'Main Project', parentFolderId);

      // 3. Prepare JSON backup
      const backupData = {
        appName: 'NIK SMART COUNT Database',
        exportedAt: new Date().toISOString(),
        project: currentProject,
        projects,
        expenses,
        steelRecords,
        concreteRecords,
        contractors,
        suppliers,
        apartments,
        payments,
        documents,
        projectPartners,
        projectInvestments,
        appSettings,
      };

      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `${TEST_MODE ? 'TEST_' : ''}Backup_${(currentProject?.name || 'Project').replace(/\s+/g, '_')}_${dateStr}.json`;

      const uploaded = await uploadFileToGoogleDrive({
        fileName,
        mimeType: 'application/json',
        content: JSON.stringify(backupData, null, 2),
        folderId: projFolderId,
      });

      // Also record as a document in the app
      addDocument({
        projectId: currentProjectId,
        title: `Google Drive Backup - ${dateStr}`,
        category: 'backup',
        fileUrl: uploaded.webViewLink || '#',
        fileName,
        fileType: 'application/json',
        date: dateStr,
        googleDriveFileId: uploaded.id,
        googleDriveLink: uploaded.webViewLink,
        notes: `نسخه پشتیبان کامل دیتابیس در گوگل درایو ذخیره شد.`,
      });

      logAudit('create', 'project', uploaded.id, `Google Drive Backup: ${fileName}`, 'Full JSON database backed up to Google Drive', undefined, undefined, currentProjectId);
      return { success: true, fileLink: uploaded.webViewLink };
    } catch (err: any) {
      console.error('Backup to Google Drive error:', err);
      return { success: false, error: err.message || 'خطا در پشتیبان‌گیری در گوگل درایو' };
    }
  };

  // Google Drive: Upload specific document to Google Drive
  const uploadDocumentToGoogleDrive = async (docId: string): Promise<{ success: boolean; link?: string; error?: string }> => {
    try {
      const doc = documents.find(d => d.id === docId);
      if (!doc) return { success: false, error: 'سند یافت نشد' };

      const token = await getAccessToken();
      if (!token) {
        const connected = await connectGoogleDrive();
        if (!connected) return { success: false, error: tp('Please sign in with your Google account first.', 'لطفاً ابتدا با حساب گوگل خود وارد شوید.', 'لومړی له خپل ګوګل حساب سره ننوځئ.') };
      }

      const parentFolderId = await getOrCreateFolder('NIK SMART COUNT');
      const projFolderId = await getOrCreateFolder(currentProject?.name || 'Documents', parentFolderId);

      const uploaded = await uploadFileToGoogleDrive({
        fileName: doc.fileName || `${doc.title.replace(/\s+/g, '_')}.jpg`,
        mimeType: doc.fileType || 'image/jpeg',
        content: doc.fileUrl,
        folderId: projFolderId,
      });

      // Update document record with Google Drive link
      setDocuments(prev => prev.map(d => d.id === docId ? {
        ...d,
        googleDriveFileId: uploaded.id,
        googleDriveLink: uploaded.webViewLink,
      } : d));

      logAudit('update', 'expense', doc.id, doc.title, `Uploaded to Google Drive: ${uploaded.webViewLink}`, undefined, undefined, doc.projectId);
      return { success: true, link: uploaded.webViewLink };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در آپلود به گوگل درایو' };
    }
  };

  const getProjectFinancials = (projId: string): ProjectFinancialSummary => {
    const projExpenses = expenses.filter(e => e.projectId === projId);
    const projSteel = steelRecords.filter(s => s.projectId === projId);
    const projConcrete = concreteRecords.filter(c => c.projectId === projId);
    const projContractors = contractors.filter(c => c.projectId === projId);
    const projSuppliers = suppliers.filter(s => s.projectId === projId);
    const projApartments = apartments.filter(a => a.projectId === projId);
    const projPayments = payments.filter(p => p.projectId === projId);

    const steelTotal = projSteel.reduce((acc, s) => acc + s.totalAmount, 0);
    const steelPaid = projSteel.reduce((acc, s) => acc + s.paidAmount, 0);
    const steelRemaining = steelTotal - steelPaid;
    const steelUSD = projSteel.filter(s => (s.currency || 'USD') === 'USD').reduce((acc, s) => acc + s.totalAmount, 0);
    const steelAFN = projSteel.filter(s => s.currency === 'AFN').reduce((acc, s) => acc + s.totalAmount, 0);

    const concreteTotal = projConcrete.reduce((acc, c) => acc + c.totalAmount, 0);
    const concretePaid = projConcrete.reduce((acc, c) => acc + c.paidAmount, 0);
    const concreteRemaining = concreteTotal - concretePaid;
    const concreteUSD = projConcrete.filter(c => (c.currency || 'USD') === 'USD').reduce((acc, c) => acc + c.totalAmount, 0);
    const concreteAFN = projConcrete.filter(c => c.currency === 'AFN').reduce((acc, c) => acc + c.totalAmount, 0);

    const otherExpensesTotal = projExpenses.reduce((acc, e) => acc + e.amount, 0);
    const otherExpensesPaid = projExpenses.reduce((acc, e) => acc + (e.paidAmount || 0), 0);
    const otherExpUSD = projExpenses.filter(e => (e.currency || 'USD') === 'USD').reduce((acc, e) => acc + e.amount, 0);
    const otherExpAFN = projExpenses.filter(e => e.currency === 'AFN').reduce((acc, e) => acc + e.amount, 0);

    const contractorTotal = projContractors.reduce((acc, c) => acc + c.contractAmount, 0);
    const contractorPayments = projPayments.filter(p => p.relatedType === 'contractor');
    const contractorPaid = contractorPayments.reduce((acc, p) => acc + p.amount, 0);
    const contractorRemaining = Math.max(0, contractorTotal - contractorPaid);
    const contractorUSD = projContractors.filter(c => (c.currency || 'USD') === 'USD').reduce((acc, c) => acc + c.contractAmount, 0);
    const contractorAFN = projContractors.filter(c => c.currency === 'AFN').reduce((acc, c) => acc + c.contractAmount, 0);

    const supplierPurchases = steelTotal + concreteTotal + projExpenses.filter(e => e.partyType === 'supplier').reduce((acc, e) => acc + e.amount, 0);
    const supplierPayments = projPayments.filter(p => p.relatedType === 'supplier' || p.relatedType === 'material_steel' || p.relatedType === 'material_concrete');
    const supplierPaid = supplierPayments.reduce((acc, p) => acc + p.amount, 0);
    const supplierRemaining = Math.max(0, supplierPurchases - supplierPaid);
    const supplierUSD = projSuppliers.filter(s => (s.currency || 'USD') === 'USD').reduce((acc, s) => acc + (s.totalPurchases || 0), 0);
    const supplierAFN = projSuppliers.filter(s => s.currency === 'AFN').reduce((acc, s) => acc + (s.totalPurchases || 0), 0);

    const expensesUSD = steelUSD + concreteUSD + otherExpUSD;
    const expensesAFN = steelAFN + concreteAFN + otherExpAFN;
    const totalExpenses = steelTotal + concreteTotal + otherExpensesTotal;

    const outflowPayments = projPayments.filter(p => p.relatedType !== 'apartment_sale');
    const paymentsUSD = outflowPayments.filter(p => (p.currency || 'USD') === 'USD').reduce((acc, p) => acc + p.amount, 0);
    const paymentsAFN = outflowPayments.filter(p => p.currency === 'AFN').reduce((acc, p) => acc + p.amount, 0);
    const totalPayments = outflowPayments.reduce((acc, p) => acc + p.amount, 0);

    const outstandingUSD = Math.max(0, expensesUSD - paymentsUSD);
    const outstandingAFN = Math.max(0, expensesAFN - paymentsAFN);
    const totalOutstanding = Math.max(0, totalExpenses - totalPayments);

    const soldApartments = projApartments.filter(a => a.status === 'sold' || a.status === 'reserved');
    const totalSales = soldApartments.reduce((acc, a) => acc + (a.salePrice || 0), 0);
    const salesUSD = soldApartments.filter(a => (a.currency || 'USD') === 'USD').reduce((acc, a) => acc + (a.salePrice || a.totalPrice || 0), 0);
    const salesAFN = soldApartments.filter(a => a.currency === 'AFN').reduce((acc, a) => acc + (a.salePrice || a.totalPrice || 0), 0);
    
    const salesPayments = projPayments.filter(p => p.relatedType === 'apartment_sale');
    const salesReceivedUSD = salesPayments.filter(p => (p.currency || 'USD') === 'USD').reduce((acc, p) => acc + p.amount, 0);
    const salesReceivedAFN = salesPayments.filter(p => p.currency === 'AFN').reduce((acc, p) => acc + p.amount, 0);
    const totalSalesReceived = salesPayments.reduce((acc, p) => acc + p.amount, 0);
    
    const salesOutstanding = Math.max(0, totalSales - totalSalesReceived);
    const salesOutstandingUSD = Math.max(0, salesUSD - salesReceivedUSD);
    const salesOutstandingAFN = Math.max(0, salesAFN - salesReceivedAFN);

    const netPosition = totalSalesReceived - totalPayments;
    const netPositionUSD = salesReceivedUSD - paymentsUSD;
    const netPositionAFN = salesReceivedAFN - paymentsAFN;

    return {
      totalExpenses,
      totalPayments,
      totalOutstanding,
      totalSales,
      totalSalesReceived,
      salesOutstanding,
      netPosition,
      steelTotal,
      steelPaid,
      steelRemaining,
      concreteTotal,
      concretePaid,
      concreteRemaining,
      contractorTotal,
      contractorPaid,
      contractorRemaining,
      supplierTotal: supplierPurchases,
      supplierPaid,
      supplierRemaining,
      expensesUSD,
      expensesAFN,
      paymentsUSD,
      paymentsAFN,
      outstandingUSD,
      outstandingAFN,
      salesUSD,
      salesAFN,
      salesReceivedUSD,
      salesReceivedAFN,
      salesOutstandingUSD,
      salesOutstandingAFN,
      netPositionUSD,
      netPositionAFN,
      steelUSD,
      steelAFN,
      concreteUSD,
      concreteAFN,
      contractorUSD,
      contractorAFN,
      supplierUSD,
      supplierAFN,
    };
  };

  const currentFinancials = useMemo(() => {
    return getProjectFinancials(currentProjectId);
  }, [currentProjectId, expenses, steelRecords, concreteRecords, contractors, suppliers, apartments, payments]);

  /* ------------------------------------------------------------------ */
  /* Accounting layer: auto-derived double-entry journal                  */
  /* ------------------------------------------------------------------ */
  const journalEntries = useMemo<JournalEntry[]>(() => {
    return buildJournal({
      projects,
      expenses,
      steelRecords,
      concreteRecords,
      payments,
      apartments,
      projectInvestments,
    });
  }, [projects, expenses, steelRecords, concreteRecords, payments, apartments, projectInvestments]);

  const accountBalances = useMemo<AccountBalance[]>(() => {
    return computeAccountBalances(journalEntries);
  }, [journalEntries]);

  const getAccountBalance = (accountCode: string, projectId?: string): AccountBalance | undefined => {
    if (!projectId) return accountBalances.find(b => b.accountCode === accountCode);
    return computeAccountBalances(journalEntries, projectId).find(b => b.accountCode === accountCode);
  };

  const getTrialBalance = (projectId?: string) => buildTrialBalance(journalEntries, projectId);

  const getProjectJournal = (projectId: string): JournalEntry[] =>
    journalEntries.filter(e => e.projectId === projectId);

  const getAccountDisplayName = (code: string, lang?: Language): string =>
    getAccountName(code, lang || language);

  /* ------------------------------------------------------------------ */
  /* Project Budget (per project, per COA account)                      */
  /* ------------------------------------------------------------------ */
  const getProjectBudgets = (projectId: string): ProjectBudget[] =>
    projectBudgets.filter(b => b.projectId === projectId);

  const getBudgetReport = (projectId: string): BudgetLineReport[] =>
    computeBudgetReport({
      projectId,
      project: projects.find(p => p.id === projectId),
      budgets: projectBudgets,
      expenses,
      steelRecords,
      concreteRecords,
    });

  const budgetWithNorm = (
    data: { amount: number; currency: string; exchangeRate?: number; projectId: string }
  ) => {
    const proj = projects.find(p => p.id === data.projectId);
    const rate = data.exchangeRate || proj?.defaultExchangeRate || 70;
    const amountUSD = data.currency === 'USD' ? data.amount : (rate > 0 ? Number((data.amount / rate).toFixed(2)) : data.amount);
    const amountAFN = data.currency === 'AFN' ? Math.round(data.amount) : Math.round(data.amount * rate);
    return { exchangeRate: rate, amountUSD, amountAFN };
  };

  const addProjectBudget = (data: Omit<ProjectBudget, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!guard('budget', 'create')) return;
    // Standard: single budget line per (project, account). If one exists,
    // update it instead of creating a duplicate row. Custom lines always
    // create independent rows (Wave 16).
    const existing = findUpdatableBudgetLine(projectBudgets, data.projectId, data.accountCode, data.customLabel);
    if (existing) {
      updateProjectBudget(existing.id, data);
      return;
    }
    const norm = budgetWithNorm(data);
    const newBudget: ProjectBudget = {
      ...data,
      ...norm,
      id: 'bdg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Admin',
    };
    setProjectBudgets(prev => [...prev, newBudget]);
    logAudit('create', 'expense', newBudget.id, `Budget: ${newBudget.customLabel || getAccountName(newBudget.accountCode, 'fa')}`, `Set budget ${newBudget.amount.toLocaleString()} ${newBudget.currency} for account ${newBudget.accountCode}`, undefined, `${newBudget.amount} ${newBudget.currency}`, newBudget.projectId);
  };

  const updateProjectBudget = (id: string, updates: Partial<ProjectBudget>) => {
    if (!guard('budget', 'edit')) return;
    const old = projectBudgets.find(b => b.id === id);
    if (!old) return;
    const merged = { ...old, ...updates };
    const norm = budgetWithNorm({ amount: merged.amount, currency: merged.currency, exchangeRate: updates.exchangeRate, projectId: merged.projectId });
    setProjectBudgets(prev => prev.map(b => (b.id === id ? { ...merged, ...norm, updatedAt: new Date().toISOString() } : b)));
    logAudit('update', 'expense', id, `Budget: ${getAccountName(merged.accountCode, 'fa')}`, `Updated budget for account ${merged.accountCode}`, `${old.amount} ${old.currency}`, `${merged.amount} ${merged.currency}`, merged.projectId);
  };

  const deleteProjectBudget = (id: string) => {
    if (!guard('budget', 'del')) return;
    const old = projectBudgets.find(b => b.id === id);
    if (!old) return;
    setProjectBudgets(prev => prev.filter(b => b.id !== id));
    logAudit('delete', 'expense', id, `Budget: ${getAccountName(old.accountCode, 'fa')}`, `Removed budget of ${old.amount.toLocaleString()} ${old.currency} (account ${old.accountCode})`, `${old.amount} ${old.currency}`, undefined, old.projectId);
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        projects: [],
        contractors: [],
        suppliers: [],
        apartments: [],
        expenses: [],
        steel: [],
        concrete: [],
        payments: [],
      };
    }
    return {
      projects: projects.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.code.toLowerCase().includes(q) || 
        p.city.toLowerCase().includes(q) || 
        p.address.toLowerCase().includes(q)
      ),
      contractors: contractors.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.contractType.toLowerCase().includes(q) || 
        c.phone.toLowerCase().includes(q) || 
        (c.workDescription || '').toLowerCase().includes(q)
      ),
      suppliers: suppliers.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.materialsSupplied.toLowerCase().includes(q) || 
        (s.contact || '').toLowerCase().includes(q)
      ),
      apartments: apartments.filter(a => 
        a.unitNumber.toLowerCase().includes(q) || 
        (a.buyerName && a.buyerName.toLowerCase().includes(q)) || 
        (a.buyerPhone && a.buyerPhone.toLowerCase().includes(q))
      ),
      expenses: expenses.filter(e => 
        e.description.toLowerCase().includes(q) || 
        e.category.toLowerCase().includes(q) || 
        (e.partyName && e.partyName.toLowerCase().includes(q))
      ),
      steel: steelRecords.filter(s => 
        s.billNumber.toLowerCase().includes(q) || 
        s.supplierName.toLowerCase().includes(q)
      ),
      concrete: concreteRecords.filter(c => 
        c.billNumber.toLowerCase().includes(q) || 
        c.concreteGrade.toLowerCase().includes(q) || 
        c.supplierName.toLowerCase().includes(q)
      ),
      payments: payments.filter(p => 
        p.partyName.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) || 
        (p.receiptNumber && p.receiptNumber.toLowerCase().includes(q))
      ),
    };
  }, [searchQuery, projects, contractors, suppliers, apartments, expenses, steelRecords, concreteRecords, payments]);

  const clearSampleData = () => {
    setExpenses([]);
    setSteelRecords([]);
    setConcreteRecords([]);
    setApartments([]);
    setContractors([]);
    setSuppliers([]);
    setPayments([]);
    setDocuments([]);
    setProjectPartners([]);
    setProjectInvestments([]);
  };

  const exportJsonBackup = (): { success: boolean; error?: string } => {
    try {
      const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      appName: 'Nik Smart Count Database',
      projects,
      projectPartners,
      projectInvestments,
      expenses,
      steelRecords,
      concreteRecords,
      contractors,
      suppliers,
      apartments,
      payments,
      documents,
      appSettings,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
      a.download = `nik_smart_count_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err: any) {
      console.error('Backup export failed', err);
      return { success: false, error: err?.message || 'Export failed' };
    }
  };

  const restoreJsonBackup = (jsonContent: string) => {
    try {
      const data = JSON.parse(jsonContent);
      if (Array.isArray(data.projects)) setProjects(data.projects);
      if (Array.isArray(data.projectPartners)) setProjectPartners(data.projectPartners);
      if (Array.isArray(data.projectInvestments)) setProjectInvestments(data.projectInvestments);
      if (Array.isArray(data.expenses)) setExpenses(data.expenses);
      if (Array.isArray(data.steelRecords)) setSteelRecords(data.steelRecords);
      if (Array.isArray(data.concreteRecords)) setConcreteRecords(data.concreteRecords);
      if (Array.isArray(data.contractors)) setContractors(data.contractors);
      if (Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
      if (Array.isArray(data.apartments)) setApartments(data.apartments);
      if (Array.isArray(data.payments)) setPayments(data.payments);
      if (Array.isArray(data.documents)) setDocuments(data.documents);
      if (data.appSettings) setAppSettings(data.appSettings);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'فایل نامعتبر است' };
    }
  };

  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isMasterAdminOpen, setIsMasterAdminOpen] = useState(false);

  const formatCurrency = (amount: number | undefined, currency: string = 'USD'): string => {
    if (amount === undefined || isNaN(amount)) return '0 ' + currency;
    const formatted = Math.round(amount).toLocaleString('en-US');
    if (currency === 'USD') return `$${formatted}`;
    if (currency === 'AFN') return `${formatted} ؋`;
    return `${formatted} ${currency}`;
  };

  const formatNumber = (value: number | undefined, decimals: number = 0): string => {
    if (value === undefined || isNaN(value)) return '0';
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const clearAuditLogs = () => {
    if (!guard('audit_logs', 'del')) return;
    setAuditLogs([]);
    saveToStorage('auditLogs', []);
  };

  const exportBackupJSON = exportJsonBackup;
  const importBackupJSON = (json: any) => {
    restoreJsonBackup(typeof json === 'string' ? json : JSON.stringify(json));
  };

  const uploadDocumentToDrive = async (doc: DocumentRecord) => {
    return await uploadDocumentToGoogleDrive(doc.id);
  };

  // ---- Notification center (Wave 12) ----
  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };
  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, dismissed: true } : n)));
  };
  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  const clearReadNotifications = () => {
    setNotifications(prev => prev.filter(n => !n.read && !n.dismissed));
  };
  // Wave 34: AI governance setters — master-only (defense in depth; UI is Office7-only too).
  const setAiGlobal = (patch: Partial<AiGlobalPolicy>): void => {
    if (!currentUser?.isMasterSuperAdmin) { denyAccess('ai_governance', 'edit'); return; }
    setAiGlobalState(prev => {
      const next = sanitizeGlobal({ ...prev, ...patch });
      try { localStorage.setItem(AI_GLOBAL_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    logAudit('update', 'settings', 'ai_global', 'AI global policy updated', JSON.stringify(patch).slice(0, 200));
  };
  const getUserAiLimits = (userId: string): AiUserLimits => aiLimitsMap[userId] || {};
  const setUserAiLimits = (userId: string, limits: AiUserLimits | null): void => {
    if (!currentUser?.isMasterSuperAdmin) { denyAccess('ai_governance', 'edit'); return; }
    setAiLimitsMap(prev => {
      const next = { ...prev };
      if (!limits || (limits.dailyMax === undefined && limits.monthlyMax === undefined)) delete next[userId];
      else next[userId] = sanitizeUserLimits(limits);
      try { localStorage.setItem(AI_LIMITS_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    logAudit('update', 'user', userId, 'AI limits updated', limits ? JSON.stringify(limits) : 'reset to global');
  };
  const getUserAiUsage = (userId: string): { today: number; month: number; total: number } =>
    countUsage(loadUsageLog(), userId);
  const aiAccess = (): AiAccessResult =>
    checkAiAccess(currentUser, aiGlobal, currentUser ? aiLimitsMap[currentUser.id] : undefined, loadUsageLog());
  const recordAiUse = (): AiAccessResult => {
    if (!currentUser) return aiAccess();
    recordUsage(currentUser.id);
    trackFeature('ai_assistant');
    setAiUsageTick(t => t + 1);
    return aiAccess();
  };

  // Wave 32: publish a builder layout (sanitized) + clear its draft.
  const publishPageLayout = (pageKey: string, layout: PageLayout): void => {
    const clean = sanitizeLayout(layout);
    savePublishedLayout(pageKey, clean);
    clearDraftLayout(pageKey);
    setBuilderRev(r => r + 1);
    logAudit('update', 'builder', pageKey, `Builder layout published for ${pageKey}`, `Blocks: ${clean.blocks.length}`);
  };

  const setNotificationPrefs = (patch: Partial<NotificationPrefs>) => {
    setNotificationPrefsState(prev => ({
      ...prev,
      ...patch,
      categories: { ...prev.categories, ...(patch.categories || {}) },
    }));
  };
  const unreadNotificationCount = useMemo(
    () => notifications.filter(n => !n.read && !n.dismissed).length,
    [notifications],
  );

  const regenNotifications = () => {
    if (!notificationPrefs.enabled) return;
    const enabledTypes = (Object.keys(notificationPrefs.categories) as Array<keyof typeof notificationPrefs.categories>)
      .filter(k => notificationPrefs.categories[k]);
    const lang: ReminderLang = language === 'fa' || language === 'ps' ? language : 'en';
    setNotifications(prev => {
      const fresh = generateSmartReminders({
        apartments,
        expenses,
        payments,
        contractors,
        suppliers,
        documents,
        projects,
        existingNotifications: prev,
        now: new Date(),
        formatCurrency,
        projectBudgets,
        steelRecords,
        concreteRecords,
        lang,
        dueSoonDays: Math.max(1, Math.min(30, notificationPrefs.dueSoonDays || 7)),
        inactivityDays: Math.max(1, Math.min(90, notificationPrefs.inactivityDays || 14)),
        enabledTypes,
      });
      return fresh.length > 0 ? pruneNotifications([...prev, ...fresh]) : prev;
    });
  };
  // Regenerate whenever any source data, language or prefs change…
  useEffect(() => {
    regenNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartments, expenses, payments, contractors, suppliers, documents, projects, projectBudgets, steelRecords, concreteRecords, language, notificationPrefs]);
  // …and every 10 minutes so day-rollover reminders appear without interaction.
  useEffect(() => {
    const t = setInterval(regenNotifications, 10 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartments, expenses, payments, contractors, suppliers, documents, projects, projectBudgets, steelRecords, concreteRecords, language, notificationPrefs]);

  // ---- Custom COA accounts — admin only (Wave 17) ----
  const isAccountAdmin = (): boolean =>
    currentUser?.role === 'admin' || !!currentUser?.isMasterSuperAdmin;
  const persistCustoms = (next: Account[]): void => {
    setRegistryAccounts(next);
    setCustomAccountsState(next);
  };
  const addCustomAccount = (input: { parentCode: string; nameFa: string; nameEn?: string; namePs?: string; isBudgetMinor?: boolean }): { success: boolean; error?: string; account?: Account } => {
    if (!isAccountAdmin()) return { success: false, error: 'forbidden' };
    const parent = getAccount(input.parentCode);
    if (!parent || parent.isHeader || parent.parentCode !== '5000' || parent.code === '5050' || !parent.code.startsWith('5')) {
      return { success: false, error: 'bad-parent' };
    }
    const nameFa = (input.nameFa || '').trim();
    if (!nameFa) return { success: false, error: 'bad-name' };
    const code = nextLeafCode(input.parentCode);
    if (!code) return { success: false, error: 'code-full' };
    const account: Account = {
      code,
      type: 'expense',
      normalBalance: 'debit',
      parentCode: input.parentCode,
      nameFa,
      nameEn: (input.nameEn || '').trim() || nameFa,
      namePs: (input.namePs || '').trim() || nameFa,
      system: false,
      activePhase: 1,
      ...(input.isBudgetMinor ? { isBudgetMinor: true } : {}),
    };
    persistCustoms([...customAccounts, account]);
    logAudit('create', 'account', code, nameFa, `Custom COA account created under ${input.parentCode}`, undefined, nameFa, undefined);
    return { success: true, account };
  };
  const updateCustomAccount = (code: string, updates: { nameFa?: string; nameEn?: string; namePs?: string; isBudgetMinor?: boolean }): { success: boolean; error?: string } => {
    if (!isAccountAdmin()) return { success: false, error: 'forbidden' };
    const existing = customAccounts.find(a => a.code === code);
    if (!existing) return { success: false, error: 'not-custom' };
    if (updates.nameFa !== undefined && !updates.nameFa.trim()) return { success: false, error: 'bad-name' };
    const next = customAccounts.map(a => (a.code === code
      ? {
          ...a,
          ...(updates.nameFa !== undefined ? { nameFa: updates.nameFa.trim() } : {}),
          ...(updates.nameEn !== undefined ? { nameEn: updates.nameEn.trim() || (updates.nameFa !== undefined ? updates.nameFa.trim() : a.nameFa) } : {}),
          ...(updates.namePs !== undefined ? { namePs: updates.namePs.trim() || (updates.nameFa !== undefined ? updates.nameFa.trim() : a.nameFa) } : {}),
          ...(updates.isBudgetMinor !== undefined ? (updates.isBudgetMinor ? { isBudgetMinor: true } : {}) : {}),
        }
      : a));
    // clear minor flag explicitly when set to false
    const fixed = next.map(a => {
      if (a.code !== code || updates.isBudgetMinor !== false) return a;
      const { isBudgetMinor: _drop, ...rest } = a;
      return rest as Account;
    });
    persistCustoms(fixed);
    logAudit('update', 'account', code, existing.nameFa, 'Custom COA account updated', existing.nameFa, updates.nameFa || existing.nameFa, undefined);
    return { success: true };
  };
  const deleteCustomAccount = (code: string): { success: boolean; error?: string } => {
    if (!isAccountAdmin()) return { success: false, error: 'forbidden' };
    const existing = customAccounts.find(a => a.code === code);
    if (!existing) return { success: false, error: 'not-custom' };
    const blocker = accountDeleteBlocker(
      code,
      projectBudgets.map(b => b.accountCode),
      accountBalances.map(b => b.accountCode),
    );
    if (blocker) return { success: false, error: blocker };
    persistCustoms(customAccounts.filter(a => a.code !== code));
    logAudit('delete', 'account', code, existing.nameFa, 'Custom COA account deleted', existing.nameFa, undefined, undefined);
    return { success: true };
  };

  const restoreFromGoogleDrive = async (fileId: string) => {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated with Google Drive.');
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to download backup from Google Drive');
    const content = await res.text();
    const result = restoreJsonBackup(content);
    if (!result.success) throw new Error(result.error || 'Failed to restore');
    return result;
  };

  return (
    <AppContext.Provider value={{
      language,
      setLanguage,
      tx,
      getCompanyDefaultLang,
      setCompanyDefaultLang,
      aiGlobal,
      setAiGlobal,
      getUserAiLimits,
      setUserAiLimits,
      getUserAiUsage,
      aiAccess,
      recordAiUse,
      aiUsageTick,
      t,
      tp,
      currentUser,
      login,
      logout,
      users,
      addUser,
      activityEvents,
      trackFeature,
      notifications,
      unreadNotificationCount,
      notificationPrefs,
      markNotificationRead,
      dismissNotification,
      markAllNotificationsRead,
      clearReadNotifications,
      setNotificationPrefs,
      builderRev,
      publishPageLayout,
      updateUser,
      toggleUserActive,
      createTenantCompanyOwnerBySuperAdmin,
      registerCompanyOwner,
      verifyOtpAndActivate,
      requestPasswordReset,
      completePasswordReset,
      changeOwnPassword,
      changeOwnUsername,
      bootstrapMasterAdmin,
      factoryReset,
      chargeUserSubscription,
      toggleLockUserBySuperAdmin,
      createEmployeeAccount,
      updateEmployeeAccount,
      deleteEmployeeAccount,
      toggleAiForUser,
      updateTenantByMasterAdmin,
      impersonateTenant,
      toggleDarkMode,
      setTheme,
      projects,
      currentProject,
      setCurrentProjectId,
      addProject,
      updateProject,
      deleteProject,
      transferProject,
      projectPartners,
      projectInvestments,
      addProjectPartner,
      updateProjectPartner,
      deleteProjectPartner,
      addProjectInvestment,
      updateProjectInvestment,
      deleteProjectInvestment,
      partnerEquityTransfers,
      transferPartnerEquity,
      interProjectTransfers,
      requestInterProjectTransfer,
      approveInterProjectTransfer,
      rejectInterProjectTransfer,
      getProjectPartners,
      getProjectInvestments,
      expenses,
      addExpense,
      updateExpense,
      deleteExpense,
      getExpensePayments,
      steelRecords,
      addSteelRecord,
      updateSteelRecord,
      deleteSteelRecord,
      concreteRecords,
      addConcreteRecord,
      updateConcreteRecord,
      deleteConcreteRecord,
      contractors,
      addContractor,
      updateContractor,
      deleteContractor,
      suppliers,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      laborRecords,
      addLaborRecord,
      deleteLaborRecord,
      assets,
      addAsset,
      updateAsset,
      deleteAsset,
      apartments,
      addApartment,
      updateApartment,
      deleteApartment,
      addInstallmentToApartment,
      addInstallmentPayment,
      updateInstallment,
      deleteInstallment,
      payments,
      addPayment,
      updatePayment,
      deletePayment,
      appSettings,
      updateAppSettings,
      debtorParties,
      documents,
      addDocument,
      updateDocument,
      deleteDocument,
      auditLogs,
      logAudit,
      currentFinancials,
      getProjectFinancials,
      chartOfAccounts: getFullChart(),
      customAccounts,
      addCustomAccount,
      updateCustomAccount,
      deleteCustomAccount,
      getAccountDisplayName,
      journalEntries,
      accountBalances,
      getAccountBalance,
      getTrialBalance,
      getProjectJournal,
      projectBudgets,
      getProjectBudgets,
      getBudgetReport,
      addProjectBudget,
      updateProjectBudget,
      deleteProjectBudget,
      searchQuery,
      setSearchQuery,
      searchResults,
      cameraModalOpen,
      setCameraModalOpen,
      cameraTargetData,
      openCameraForCapture,
      saveCameraPhotoAsDocument,
      isApartmentsUnlocked,
      unlockApartments,
      lockApartments,
      themeSchedule: appSettings.themeSchedule || 'auto',
      setThemeSchedule,
      setUiScale,
      cycleThemeSchedule,
      isTabAllowed,
      can,
      denyAccess,
      printIfAllowed,
      grantedProjects,
      accessNotice,
      clearAccessNotice,
  approveExpense,
  rejectExpense,
      postExpense,
      unpostExpense,
      reverseExpense,
      postPayment,
      unpostPayment,
      reversePayment,
      updateReportCustomization,
      uploadCustomReportTemplate,
      isSectionProtected,
      isSectionUnlocked,
      unlockSection,
      lockSection,
      setSectionPassword,
      clearSampleData,
      isTestMode: TEST_MODE,
      enterTestMode,
      exitTestMode,
      wipeTestData,
      exportJsonBackup,
      restoreJsonBackup,
      exportBackupJSON,
      importBackupJSON,
      storageError,
      clearStorageError,
      authNotice,
      serverSync,
      refreshServerSyncStatus,
      syncAllUsersToServer,
      clearAuthNotice,
      notifySessionExpired: () => setAuthNotice('session-expired'),
      clearAuditLogs,
      deleteUser,
      formatCurrency,
      formatNumber,
      isDarkMode: appSettings.darkMode ?? false,
      isGoogleDriveConnected,
      googleDriveUserEmail,
      googleUser: googleDriveUserEmail ? { displayName: googleDriveUserEmail.split('@')[0], email: googleDriveUserEmail } : null,
      connectGoogleDrive,
      disconnectGoogleDrive,
      backupToGoogleDrive,
      uploadDocumentToGoogleDrive,
      uploadDocumentToDrive,
      restoreFromGoogleDrive,
      isAiAssistantOpen,
      setIsAiAssistantOpen,
      isMasterAdminOpen,
      setIsMasterAdminOpen,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
