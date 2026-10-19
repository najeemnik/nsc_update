/**
 * Office7 config snapshots — Wave 31.
 *
 * Per-tenant backup/restore of design + system settings:
 * logo, bill design, custom buttons, enabled modules, permissions,
 * project grants, subscription, lock/active flags, theme.
 *
 * Pure helpers + a tiny localStorage store. Restore path ALWAYS goes
 * through sanitizeSnapshotData (whitelist, caps, size limits) so a
 * tampered file can never inject scripts or oversized blobs.
 */
import type {
  AppTheme,
  CustomActionButton,
  CustomBillDesign,
  User,
  UserPermissions,
} from '../types';
import { sanitizeDesign } from './docDesign';

export const SNAPSHOT_STORE_KEY = 'nsc_cfg_snapshots_v1';
export const SNAPSHOT_MAX_BYTES = 500 * 1024; // 500 KB per snapshot payload
export const SNAPSHOT_STORE_CAP = 60; // max snapshots kept in local store
export const SNAPSHOT_BUTTON_CAP = 30;

/** All themes the app can render (MorphismTheme + classic set). */
export const OFFICE7_THEME_OPTIONS: AppTheme[] = [
  'glassmorphism', 'neumorphism', 'skeuomorphism', 'squirclemorphism',
  'metalmorphism', 'ar_morphism', 'cosmic_orange', 'blue_titanium',
  'desert_titanium', 'slate', 'navy', 'emerald', 'dark_gold',
];

export const isOffice7Theme = (v: unknown): v is AppTheme =>
  typeof v === 'string' && (OFFICE7_THEME_OPTIONS as string[]).includes(v);

/** Whitelisted tenant-config payload inside a snapshot. */
export interface TenantConfigData {
  customLogoUrl?: string;
  customBillDesign?: CustomBillDesign;
  customButtonConfig?: CustomActionButton[];
  customEnabledModules?: User['customEnabledModules'];
  permissions?: UserPermissions;
  aiEnabled?: boolean;
  projectGrants?: User['projectGrants'];
  accessExpiresAt?: string;
  subscriptionPlan?: NonNullable<User['subscriptionPlan']>;
  subscriptionExpiresAt?: string;
  isLockedBySuperAdmin?: boolean;
  active?: boolean;
  customTheme?: AppTheme;
}

export interface ConfigSnapshot {
  id: string;
  userId: string;
  userLabel: string;
  createdAt: string; // ISO
  createdBy: string;
  byteSize: number;
  data: TenantConfigData;
}

const PERMISSION_KEYS: Array<keyof UserPermissions> = [
  'allowedTabs', 'canManageSales', 'canManageMaterials', 'canManageExpenses',
  'canManageReports', 'canManageProjects', 'canManagePayments',
  'canManageSettings', 'canManageTreasury', 'canManagePayroll',
  'canManageAssets', 'canManageTransfers', 'canManageJournal',
  'aiEnabled', 'allowedModules',
];

const MODULE_KEYS = [
  'steel', 'concrete', 'expenses', 'contractors', 'suppliers',
  'apartments', 'payments', 'budget', 'accounting', 'documents', 'reports',
] as const;

const PLAN_VALUES = ['trial', '6_months', '1_year', 'lifetime'] as const;

const asTrimmed = (v: unknown, maxLen: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
};

const asBool = (v: unknown): boolean | undefined =>
  typeof v === 'boolean' ? v : undefined;

const asIsoDate = (v: unknown): string | undefined => {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

const BUTTON_COLORS = ['blue', 'emerald', 'amber', 'rose', 'purple', 'slate', 'indigo', 'orange', 'primary', 'success', 'danger', 'warning', 'info'] as const;
const BUTTON_SHAPES = ['pill', 'rounded-xl', 'rounded-md', 'rounded', 'square'] as const;

const sanitizeButtons = (v: unknown): CustomActionButton[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out: CustomActionButton[] = [];
  for (const b of v.slice(0, SNAPSHOT_BUTTON_CAP)) {
    if (!b || typeof b !== 'object') continue;
    const r = b as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id.trim()) continue;
    if (typeof r.label !== 'string' || !r.label.trim()) continue;
    const color = typeof r.color === 'string' && (BUTTON_COLORS as readonly string[]).includes(r.color)
      ? r.color as CustomActionButton['color'] : 'slate';
    const shape = typeof r.shape === 'string' && (BUTTON_SHAPES as readonly string[]).includes(r.shape)
      ? r.shape as CustomActionButton['shape'] : 'rounded-xl';
    out.push({
      id: r.id.trim().slice(0, 64),
      label: r.label.trim().slice(0, 80),
      labelFa: typeof r.labelFa === 'string' ? r.labelFa.slice(0, 80) : undefined,
      labelEn: typeof r.labelEn === 'string' ? r.labelEn.slice(0, 80) : undefined,
      labelPs: typeof r.labelPs === 'string' ? r.labelPs.slice(0, 80) : undefined,
      actionKey: typeof r.actionKey === 'string' ? r.actionKey.slice(0, 64) : undefined,
      enabled: r.enabled !== false,
      isEnabled: r.isEnabled !== false,
      color,
      shape,
      order: typeof r.order === 'number' && Number.isFinite(r.order) ? Math.max(0, Math.min(999, Math.floor(r.order))) : out.length,
    });
  }
  return out;
};

const sanitizeModules = (v: unknown): User['customEnabledModules'] | undefined => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const k of MODULE_KEYS) {
    if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  }
  return Object.keys(out).length ? (out as User['customEnabledModules']) : undefined;
};

const sanitizePermissions = (v: unknown): UserPermissions | undefined => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of PERMISSION_KEYS) {
    if (k === 'allowedTabs' || k === 'allowedModules') {
      if (Array.isArray(r[k])) {
        out[k] = (r[k] as unknown[]).filter(t => typeof t === 'string').slice(0, 40);
      }
      continue;
    }
    if (typeof r[k] === 'boolean') out[k] = r[k];
  }
  return Object.keys(out).length ? (out as unknown as UserPermissions) : undefined;
};

const GRANT_FLAGS = ['view', 'create', 'edit', 'del', 'approve', 'print', 'export'] as const;

const sanitizeGrants = (v: unknown): User['projectGrants'] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out: NonNullable<User['projectGrants']> = [];
  for (const g of v.slice(0, 50)) {
    if (!g || typeof g !== 'object') continue;
    const r = g as Record<string, unknown>;
    if (typeof r.projectId !== 'string' || !r.projectId.trim()) continue;
    const sections: NonNullable<User['projectGrants']>[number]['sections'] = {};
    if (r.sections && typeof r.sections === 'object' && !Array.isArray(r.sections)) {
      const entries = Object.entries(r.sections as Record<string, unknown>).slice(0, 40);
      for (const [secKey, secVal] of entries) {
        if (typeof secKey !== 'string' || !secKey.trim() || !secVal || typeof secVal !== 'object') continue;
        const flags: Record<string, boolean> = {};
        for (const f of GRANT_FLAGS) {
          const fv = (secVal as Record<string, unknown>)[f];
          if (typeof fv === 'boolean') flags[f] = fv;
        }
        if (Object.keys(flags).length) sections[secKey.trim().slice(0, 64)] = flags;
      }
    }
    out.push({ projectId: r.projectId.trim().slice(0, 64), sections });
  }
  return out;
};

/** Deep-sanitize an unknown payload into a safe TenantConfigData. */
export const sanitizeSnapshotData = (input: unknown): TenantConfigData => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const r = input as Record<string, unknown>;
  const data: TenantConfigData = {};
  const logo = asTrimmed(r.customLogoUrl, 2000);
  if (logo) data.customLogoUrl = logo;
  if (r.customBillDesign && typeof r.customBillDesign === 'object') {
    try { data.customBillDesign = sanitizeDesign(r.customBillDesign); } catch { /* keep unset */ }
  }
  const buttons = sanitizeButtons(r.customButtonConfig);
  if (buttons) data.customButtonConfig = buttons;
  const modules = sanitizeModules(r.customEnabledModules);
  if (modules) data.customEnabledModules = modules;
  const perms = sanitizePermissions(r.permissions);
  if (perms) data.permissions = perms;
  const ai = asBool(r.aiEnabled);
  if (ai !== undefined) data.aiEnabled = ai;
  const grants = sanitizeGrants(r.projectGrants);
  if (grants) data.projectGrants = grants;
  const accessExp = asIsoDate(r.accessExpiresAt);
  if (accessExp) data.accessExpiresAt = accessExp;
  if (typeof r.subscriptionPlan === 'string' && (PLAN_VALUES as readonly string[]).includes(r.subscriptionPlan)) {
    data.subscriptionPlan = r.subscriptionPlan as TenantConfigData['subscriptionPlan'];
  }
  const subExp = asIsoDate(r.subscriptionExpiresAt);
  if (subExp) data.subscriptionExpiresAt = subExp;
  const locked = asBool(r.isLockedBySuperAdmin);
  if (locked !== undefined) data.isLockedBySuperAdmin = locked;
  const active = asBool(r.active);
  if (active !== undefined) data.active = active;
  if (isOffice7Theme(r.customTheme)) data.customTheme = r.customTheme;
  return data;
};

/** Extract the whitelisted, sanitized payload from a live tenant record. */
export const extractTenantConfig = (user: User): TenantConfigData =>
  sanitizeSnapshotData({
    customLogoUrl: user.customLogoUrl,
    customBillDesign: user.customBillDesign,
    customButtonConfig: user.customButtonConfig,
    customEnabledModules: user.customEnabledModules,
    permissions: user.permissions,
    projectGrants: user.projectGrants,
    accessExpiresAt: user.accessExpiresAt,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    isLockedBySuperAdmin: user.isLockedBySuperAdmin,
    active: user.active,
    customTheme: user.customTheme,
  });

export const makeSnapshotId = (): string =>
  `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const buildSnapshot = (user: User, createdBy: string): ConfigSnapshot => {
  const data = extractTenantConfig(user);
  const byteSize = new Blob([JSON.stringify(data)]).size;
  return {
    id: makeSnapshotId(),
    userId: user.id,
    userLabel: `${user.name || user.username} (${user.companyName || '—'})`,
    createdAt: new Date().toISOString(),
    createdBy,
    byteSize,
    data,
  };
};

/** Whole days remaining until expiry; null when no expiry set. Negative = overdue. */
export const remainingDays = (expiresAt: string | undefined, nowMs = Date.now()): number | null => {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - nowMs) / 86_400_000);
};

/** Parse + validate an uploaded snapshot file. Throws Error with user-safe message. */
export const parseSnapshotFile = (raw: string): ConfigSnapshot => {
  if (raw.length > SNAPSHOT_MAX_BYTES * 2) {
    throw new Error('فایل بیش از حد بزرگ است (حداکثر ~۱ مگابایت).');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('فایل معتبر نیست (JSON خراب است).');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ساختار فایل نامعتبر است.');
  }
  const r = parsed as Record<string, unknown>;
  if (typeof r.userId !== 'string' || !r.userId.trim()) {
    throw new Error('فایل فاقد شناسهٔ کاربر است.');
  }
  const data = sanitizeSnapshotData(r.data);
  return {
    id: typeof r.id === 'string' && r.id.trim() ? r.id.trim().slice(0, 64) : makeSnapshotId(),
    userId: r.userId.trim().slice(0, 64),
    userLabel: typeof r.userLabel === 'string' ? r.userLabel.slice(0, 160) : '',
    createdAt: asIsoDate(r.createdAt) || new Date().toISOString(),
    createdBy: typeof r.createdBy === 'string' ? r.createdBy.slice(0, 160) : '',
    byteSize: new Blob([JSON.stringify(data)]).size,
    data,
  };
};

const readStore = (): ConfigSnapshot[] => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(s => s && typeof s === 'object' && typeof (s as ConfigSnapshot).id === 'string');
  } catch {
    return [];
  }
};

const writeStore = (snaps: ConfigSnapshot[]): void => {
  try {
    localStorage.setItem(SNAPSHOT_STORE_KEY, JSON.stringify(snaps.slice(0, SNAPSHOT_STORE_CAP)));
  } catch {
    /* storage full/blocked — Office7 surfaces a notice */
  }
};

export const listSnapshots = (userId?: string): ConfigSnapshot[] => {
  const all = readStore().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return userId ? all.filter(s => s.userId === userId) : all;
};

/** Save a new snapshot for a tenant. Returns null when payload exceeds the cap. */
export const saveSnapshot = (user: User, createdBy: string): ConfigSnapshot | null => {
  const snap = buildSnapshot(user, createdBy);
  if (snap.byteSize > SNAPSHOT_MAX_BYTES) return null;
  const all = readStore();
  all.unshift(snap);
  writeStore(all);
  return snap;
};

export const deleteSnapshot = (id: string): void => {
  writeStore(readStore().filter(s => s.id !== id));
};

export const downloadSnapshot = (snap: ConfigSnapshot): void => {
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `office7-snapshot-${snap.userId}-${snap.createdAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
