/**
 * NSC Backend API Service
 * Secure REST client connecting React with the Shahhost MySQL/PHP Backend
 * Fully compatible with Offline-First caching and Office 7 Master Gate
 */

import {
  createIndexedDbAdapter,
  createLocalStorageAdapter,
  createMemoryAdapter,
  createOutbox,
  syncOutbox,
  type Outbox,
  type QueuedMutation,
  type SyncResult,
} from './offlineQueue';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Default persistent outbox: IndexedDB → localStorage → memory. */
let defaultOutbox: Outbox | null = null;
function outbox(): Outbox {
  if (!defaultOutbox) {
    const hasIdb = typeof indexedDB !== 'undefined';
    let hasLs = false;
    try { hasLs = typeof localStorage !== 'undefined'; } catch { hasLs = false; }
    defaultOutbox = createOutbox(
      hasIdb ? createIndexedDbAdapter() : hasLs ? createLocalStorageAdapter() : createMemoryAdapter(),
    );
  }
  return defaultOutbox;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  /** HTTP status code (0 = network failure) */
  status?: number;
  /** True when the mutation was queued offline and NOT yet sent to the server */
  queued?: boolean;
  /** True when the device was offline at call time */
  offline?: boolean;
}

class BackendApiService {
  private token: string | null = null;
  private office7GateKey: string | null = null;

  constructor() {
    this.token = localStorage.getItem('nsc_auth_token') || null;
    this.office7GateKey = localStorage.getItem('nsc_office7_key') || null;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('nsc_auth_token', token);
    } else {
      localStorage.removeItem('nsc_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public setOffice7GateKey(key: string | null) {
    this.office7GateKey = key;
    if (key) {
      localStorage.setItem('nsc_office7_key', key);
    } else {
      localStorage.removeItem('nsc_office7_key');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.office7GateKey) {
      headers['X-Office7-Gate-Key'] = this.office7GateKey;
    }

    const method = (options.method || 'GET').toUpperCase();

    // Wave 11: device is offline — queue mutations instead of failing.
    if (typeof navigator !== 'undefined' && navigator.onLine === false && this.isQueueable(endpoint, method)) {
      return this.enqueueOffline(endpoint, method, options);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        ...options,
        headers,
      });

      const raw = await response.json().catch(() => ({
        success: false,
        error: `پاسخ نامعتبر از سرور (کد وضعیت: ${response.status})`,
      }));
      const json: ApiResponse<T> = (raw && typeof raw === 'object')
        ? { ...raw, status: response.status }
        : { success: false, error: `پاسخ نامعتبر از سرور (کد وضعیت: ${response.status})`, status: response.status };

      // نشست مرده (توکن منقضی/باطل‌شده یا حساب قفل): توکن را دور بینداز و همه را خبر کن.
      // (ورود ناموفق مستثنی است — آن خطای اعتبارنامه است نه مرگ نشست)
      // Wave 41: a failed USER-SYNC must never log the owner out — drop the
      // dead token silently so the next login restores it.
      const isUserSync = endpoint.includes('action=sync_user') || endpoint.includes('action=delete_user');
      if ((response.status === 401 || response.status === 403) && this.token && !endpoint.startsWith('auth.php?action=login') && !isUserSync) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('nsc:session-expired'));
      } else if ((response.status === 401 || response.status === 403) && this.token && isUserSync) {
        this.setToken(null);
      }

      return json;
    } catch (err: any) {
      // Wave 11: network failure mid-flight — queue mutations for later replay.
      if (this.isQueueable(endpoint, method)) {
        return this.enqueueOffline(endpoint, method, options, err);
      }
      return {
        success: false,
        error: err.message || 'خطا در برقراری ارتباط با سرور هاست',
        status: 0,
      };
    }
  }

  // --- صف آفلاین / Offline outbox (Wave 11) ---

  /** Reads are never queued; auth must always be live (never queue credentials). */
  private isQueueable(endpoint: string, method: string): boolean {
    if (method === 'GET' || method === 'HEAD') return false;
    if (endpoint.startsWith('auth.php')) {
      // Wave 40: user-sync payloads carry only sha256$ hashes (never plaintext
      // passwords), so they are safe to queue and replay when back online.
      return endpoint.includes('action=sync_user') || endpoint.includes('action=delete_user');
    }
    return true;
  }

  private async enqueueOffline<T>(
    endpoint: string,
    method: string,
    options: RequestInit,
    originalError?: any,
  ): Promise<ApiResponse<T>> {
    try {
      await outbox().enqueue({
        endpoint,
        method,
        body: typeof options.body === 'string' ? options.body : undefined,
      });
      // success:true = saved locally (AppContext already updated local state);
      // queued:true = NOT yet on the server. Callers must check `queued`.
      return { success: true, queued: true, offline: true, status: 0 };
    } catch {
      return {
        success: false,
        error: originalError?.message || 'خطا در برقراری ارتباط با سرور هاست',
        status: 0,
      };
    }
  }

  /** Replay one queued mutation with FRESH headers (current token + gate key). */
  private async replaySend(m: QueuedMutation): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
      if (this.office7GateKey) headers['X-Office7-Gate-Key'] = this.office7GateKey;
      const res = await fetch(`${API_BASE_URL}/${m.endpoint}`, {
        method: m.method,
        headers,
        body: m.body,
      });
      // Wave 41: queued user-syncs replaying without a token must not nuke
      // the local session either — keep them queued for after next login.
      const replayIsUserSync = m.endpoint.includes('action=sync_user') || m.endpoint.includes('action=delete_user');
      if ((res.status === 401 || res.status === 403) && this.token && !replayIsUserSync) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('nsc:session-expired'));
        return false; // keep queued — will replay after next login
      }
      if ((res.status === 401 || res.status === 403) && replayIsUserSync) {
        if (this.token) this.setToken(null);
        return false; // keep queued — will replay after next login
      }
      return res.ok;
    } catch {
      return false;
    }
  }

  public getOfflinePendingCount(): Promise<number> {
    return outbox().count().catch(() => 0);
  }

  public onOfflineQueueChange(listener: (count: number) => void): () => void {
    return outbox().subscribe(listener);
  }

  public async syncOfflineQueue(): Promise<SyncResult> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { sent: 0, failed: 0, remaining: await this.getOfflinePendingCount() };
    }
    return syncOutbox(outbox(), m => this.replaySend(m));
  }

  // --- احراز هویت (Auth) ---
  public async login(username: string, password: string) {
    const res = await this.request<{ token: string; user: any }>('auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  public async getCurrentUser() {
    return this.request<{ user: any }>('auth.php');
  }

  /** ابطال تمام نشست‌های فعال کاربر در همه دستگاه‌ها (§2.2) */
  public async logoutAll() {
    return this.request('auth.php?action=logout_all', { method: 'POST' });
  }

  // --- Wave 40/41: multi-device user sync (users work on every device) ---
  /** Wave 41: capability probe — tells outdated server files apart from offline. */
  public async pingServer(): Promise<{ ok: boolean; wave: number; status: number }> {
    try {
      const res = await this.request<{ wave: number }>('auth.php?action=ping', { method: 'GET' });
      const wave = (res.data as any)?.wave ?? 0;
      return { ok: res.success === true && wave >= 40, wave, status: res.status ?? 0 };
    } catch {
      return { ok: false, wave: 0, status: 0 };
    }
  }

  /** Wave 41: park a user-sync in the outbox until a server token exists. */
  public async queueUserSync(action: 'sync_user' | 'delete_user', payload: any): Promise<void> {
    await outbox().enqueue({
      endpoint: `auth.php?action=${action}`,
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Push a created/updated user to the server (hash-only, queueable offline). */
  public async syncUser(user: any) {
    return this.request('auth.php?action=sync_user', {
      method: 'POST',
      body: JSON.stringify({ user }),
    });
  }

  /** Delete a user on the server (queueable offline). */
  public async deleteServerUser(payload: { id?: string; username?: string }) {
    return this.request('auth.php?action=delete_user', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- دفتر هفت (Office 7 Master Control) ---
  public async getOffice7Tenants() {
    return this.request<{ users: any[] }>('office7.php?action=tenants');
  }

  public async updateTenantByOffice7(payload: any) {
    return this.request('office7.php?action=update_tenant', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async toggleUserLock(userId: string, isLocked: boolean) {
    return this.request('office7.php?action=toggle_lock', {
      method: 'POST',
      body: JSON.stringify({ userId, isLocked }),
    });
  }

  public async changeOffice7GateKey(newKey: string) {
    return this.request('office7.php?action=change_gate_key', {
      method: 'POST',
      body: JSON.stringify({ newKey }),
    });
  }

  public async getAuditLogs(limit = 100) {
    return this.request<{ logs: any[] }>(`office7.php?action=audit_logs&limit=${limit}`);
  }

  // --- پروژه‌ها و بودجه (Projects & Budgets) ---
  public async getProjects() {
    return this.request<{ projects: any[] }>('projects.php');
  }

  public async getProjectDetails(id: string) {
    return this.request<{ project: any; budgets: any[]; actualCosts: any[]; totalRevenue: number }>(`projects.php?id=${id}`);
  }

  public async saveProject(project: any) {
    return this.request('projects.php?action=save_project', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  public async saveBudget(budget: any) {
    return this.request('projects.php?action=save_budget', {
      method: 'POST',
      body: JSON.stringify(budget),
    });
  }

  // --- عملیات مالی (Finance & Treasury) ---
  public async getTreasuryAccounts() {
    return this.request<{ accounts: any[] }>('finance.php?section=treasury_accounts');
  }

  public async getIncomes(projectId?: string) {
    const q = projectId ? `&projectId=${projectId}` : '';
    return this.request<{ incomes: any[] }>(`finance.php?section=incomes${q}`);
  }

  public async createIncome(payload: any) {
    return this.request('finance.php?action=create_income', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getPayments(projectId?: string) {
    const q = projectId ? `&projectId=${projectId}` : '';
    return this.request<{ payments: any[] }>(`finance.php?section=payments${q}`);
  }

  public async createPayment(payload: any) {
    return this.request('finance.php?action=create_payment', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async interProjectTransfer(payload: any) {
    return this.request('finance.php?action=inter_project_transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- تدارکات مواد (Materials) ---
  public async getMaterials(projectId?: string) {
    const q = projectId ? `?projectId=${projectId}` : '';
    return this.request<{ materials: any[] }>(`materials.php${q}`);
  }

  public async createMaterialProcurement(payload: any) {
    return this.request('materials.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- معاشات و کارکرد کارگران (Labor & Wages) ---
  public async getLaborPayroll(projectId?: string) {
    const q = projectId ? `?projectId=${projectId}` : '';
    return this.request<{ payroll: any[] }>(`payroll.php${q}`);
  }

  public async createLaborPayroll(payload: any) {
    return this.request('payroll.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- راپورها مدیریتی و P&L (Reports) ---
  public async getDashboardMetrics() {
    return this.request<any>('reports.php?type=dashboard');
  }

  // --- مقاطعه‌کاران (Subcontractors) ---
  public async getSubcontractors(projectId?: string) {
    const q = projectId ? `?projectId=${projectId}` : '';
    return this.request<{ subcontractors: any[] }>(`subcontractors.php${q}`);
  }

  public async saveSubcontractor(payload: any) {
    return this.request('subcontractors.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- عرضه‌کنندگان (Suppliers) ---
  public async getSuppliers() {
    return this.request<{ suppliers: any[] }>('suppliers.php');
  }

  public async saveSupplier(payload: any) {
    return this.request('suppliers.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- پلاک‌ها و اپارتمان‌ها (Apartments) ---
  public async getApartmentUnits(projectId?: string) {
    const q = projectId ? `?projectId=${projectId}` : '';
    return this.request<{ units: any[] }>(`apartments.php${q}`);
  }

  public async saveApartmentUnit(payload: any) {
    return this.request('apartments.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- اسناد روزنامچه و حسابداری دوطرفه (Journal & Chart of Accounts) ---
  public async getChartOfAccounts() {
    return this.request<{ accounts: any[] }>('journal.php?action=chart_of_accounts');
  }

  public async getJournalEntries() {
    return this.request<{ entries: any[] }>('journal.php?action=entries');
  }

  public async createJournalEntry(payload: any) {
    return this.request('journal.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- ماشین‌آلات و دارایی‌ها (Assets & Equipment) ---
  public async getAssets(projectId?: string) {
    const q = projectId ? `?projectId=${projectId}` : '';
    return this.request<{ assets: any[] }>(`assets.php${q}`);
  }

  public async saveAsset(payload: any) {
    return this.request('assets.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async recordAsset(payload: any) {
    return this.saveAsset(payload);
  }

  public async getProjectPnl() {
    return this.request<{ pnl: any[] }>('reports.php?type=project_pnl');
  }

  public async getBudgetVsActual(projectId: string) {
    return this.request<{ comparison: any[] }>(`reports.php?type=budget_vs_actual&projectId=${projectId}`);
  }

  public async getMonthlyTimeline(year?: number) {
    const y = year || new Date().getFullYear();
    return this.request<{ year: number; months: any[] }>(`reports.php?type=monthly_timeline&year=${y}`);
  }
}

export const backendApi = new BackendApiService();
