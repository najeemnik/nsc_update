/**
 * AI governance engine — Wave 34.
 *
 * Office7 controls the assistant end-to-end WITHOUT code changes:
 *  - global on/off + global daily/monthly defaults + visibility
 *  - per-user on/off (stored on the user record) + per-user limit overrides
 *  - usage log (day-bucketed) with caps + pruning
 *  - access check (single choke point) + authorized project scope (req 9)
 *
 * Conventions: limits are integers; 0 = unlimited. Unknown/invalid input
 * always sanitizes to a SAFE value (fail closed for access, fail open for
 * legacy visibility).
 */
import type { Project, User } from '../types';
import { grantedProjectIds } from './permissions';

export type AiVisibility = 'everyone' | 'owners_only' | 'master_only';

export interface AiGlobalPolicy {
  /** master kill-switch for the whole system */
  enabled: boolean;
  /** who may even see the AI option */
  visibility: AiVisibility;
  /** 0 = unlimited */
  dailyMax: number;
  /** 0 = unlimited */
  monthlyMax: number;
}

export interface AiUserLimits {
  /** 0 = unlimited; undefined = fall back to global */
  dailyMax?: number;
  monthlyMax?: number;
}

export interface AiUsageEvent {
  userId: string;
  at: number;
  day: string; // YYYY-MM-DD (local)
  month: string; // YYYY-MM (local)
}

export const AI_GLOBAL_KEY = 'nsc_ai_global_v1';
export const AI_LIMITS_KEY = 'nsc_ai_limits_v1';
export const AI_USAGE_KEY = 'nsc_ai_usage_v1';
export const AI_USAGE_CAP = 5000;
export const AI_USAGE_RETENTION_DAYS = 90;
export const AI_LIMIT_ABS_MAX = 100000;

export const DEFAULT_AI_GLOBAL: AiGlobalPolicy = {
  enabled: true,
  visibility: 'everyone',
  dailyMax: 50,
  monthlyMax: 500,
};

export const dayKeyOf = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const monthKeyOf = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const sanitizeLimit = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(AI_LIMIT_ABS_MAX, Math.floor(v)));
};

export const sanitizeVisibility = (v: unknown): AiVisibility =>
  v === 'owners_only' || v === 'master_only' || v === 'everyone' ? v : 'everyone';

export const sanitizeGlobal = (input: unknown): AiGlobalPolicy => {
  const r = (input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {}) as Record<string, unknown>;
  return {
    enabled: r.enabled !== false,
    visibility: sanitizeVisibility(r.visibility),
    dailyMax: sanitizeLimit(r.dailyMax ?? DEFAULT_AI_GLOBAL.dailyMax),
    monthlyMax: sanitizeLimit(r.monthlyMax ?? DEFAULT_AI_GLOBAL.monthlyMax),
  };
};

export const sanitizeUserLimits = (input: unknown): AiUserLimits => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const r = input as Record<string, unknown>;
  const out: AiUserLimits = {};
  if (r.dailyMax !== undefined) out.dailyMax = sanitizeLimit(r.dailyMax);
  if (r.monthlyMax !== undefined) out.monthlyMax = sanitizeLimit(r.monthlyMax);
  return out;
};

const safeGet = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key: string, val: string): boolean => {
  try { localStorage.setItem(key, val); return true; } catch { return false; }
};

/** Effective limits for a user: per-user override wins, else global default. */
export const effectiveLimits = (global: AiGlobalPolicy, userLimits?: AiUserLimits): { dailyMax: number; monthlyMax: number } => ({
  dailyMax: userLimits?.dailyMax !== undefined ? sanitizeLimit(userLimits.dailyMax) : sanitizeLimit(global.dailyMax),
  monthlyMax: userLimits?.monthlyMax !== undefined ? sanitizeLimit(userLimits.monthlyMax) : sanitizeLimit(global.monthlyMax),
});

/** Load + prune the usage log (pure w.r.t. access logic; prunes old entries). */
export const loadUsageLog = (now = Date.now()): AiUsageEvent[] => {
  let arr: AiUsageEvent[] = [];
  try {
    const raw = safeGet(AI_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        arr = parsed.filter(e => e && typeof e === 'object'
          && typeof (e as AiUsageEvent).userId === 'string'
          && typeof (e as AiUsageEvent).day === 'string'
          && typeof (e as AiUsageEvent).month === 'string');
      }
    }
  } catch { arr = []; }
  const cutoff = now - AI_USAGE_RETENTION_DAYS * 86_400_000;
  const pruned = arr.filter(e => typeof e.at === 'number' && e.at >= cutoff);
  if (pruned.length !== arr.length) {
    safeSet(AI_USAGE_KEY, JSON.stringify(pruned.slice(-AI_USAGE_CAP)));
  }
  return pruned;
};

export const countUsage = (log: AiUsageEvent[], userId: string, day = dayKeyOf(), month = monthKeyOf()): { today: number; month: number; total: number } => {
  let today = 0;
  let monthCount = 0;
  let total = 0;
  for (const e of log) {
    if (e.userId !== userId) continue;
    total += 1;
    if (e.day === day) today += 1;
    if (e.month === month) monthCount += 1;
  }
  return { today, month: monthCount, total };
};

export const countUsageDayAll = (log: AiUsageEvent[], day = dayKeyOf()): number => {
  let n = 0;
  for (const e of log) if (e.day === day) n += 1;
  return n;
};

export const recordUsage = (userId: string, now = Date.now()): AiUsageEvent[] => {
  const d = new Date(now);
  const log = loadUsageLog(now);
  log.push({ userId, at: now, day: dayKeyOf(d), month: monthKeyOf(d) });
  const capped = log.slice(-AI_USAGE_CAP);
  safeSet(AI_USAGE_KEY, JSON.stringify(capped));
  return capped;
};

export type AiDenyReason =
  | 'global_off' | 'visibility' | 'user_off' | 'daily_limit' | 'monthly_limit';

export interface AiAccessResult {
  allowed: boolean;
  reason?: AiDenyReason;
  /** effective limits + current usage (for UI + remaining counters) */
  dailyMax: number;
  monthlyMax: number;
  usedToday: number;
  usedMonth: number;
}

/**
 * Single choke point: may this user SEE + USE the assistant right now?
 * Master bypasses limits but never the global kill-switch… actually master
 * bypasses the kill-switch too ONLY for viewing Office7 — the assistant
 * itself stays off for everyone when globally disabled (fail closed).
 */
export const checkAiAccess = (
  user: User | null,
  global: AiGlobalPolicy,
  userLimits?: AiUserLimits,
  log: AiUsageEvent[] = [],
  day = dayKeyOf(),
  month = monthKeyOf(),
): AiAccessResult => {
  const clean = sanitizeGlobal(global);
  const lim = effectiveLimits(clean, userLimits);
  const usage = user ? countUsage(log, user.id, day, month) : { today: 0, month: 0, total: 0 };
  const base = { dailyMax: lim.dailyMax, monthlyMax: lim.monthlyMax, usedToday: usage.today, usedMonth: usage.month };
  if (!user) return { ...base, allowed: false, reason: 'user_off' };
  if (!clean.enabled) return { ...base, allowed: false, reason: 'global_off' };
  const isOwner = user.role === 'admin' || !!user.isMasterSuperAdmin;
  if (clean.visibility === 'master_only' && !user.isMasterSuperAdmin) {
    return { ...base, allowed: false, reason: 'visibility' };
  }
  if (clean.visibility === 'owners_only' && !isOwner) {
    return { ...base, allowed: false, reason: 'visibility' };
  }
  if (user.permissions?.aiEnabled === false) return { ...base, allowed: false, reason: 'user_off' };
  if (user.isMasterSuperAdmin) return { ...base, allowed: true }; // master: unlimited, still logged
  if (lim.dailyMax > 0 && usage.today >= lim.dailyMax) return { ...base, allowed: false, reason: 'daily_limit' };
  if (lim.monthlyMax > 0 && usage.month >= lim.monthlyMax) return { ...base, allowed: false, reason: 'monthly_limit' };
  return { ...base, allowed: true };
};

// ---------- authorized project scope (req 9) ----------
const isLegacyProject = (p: Project): boolean => !p.companyName && !p.userId;

/**
 * Projects the assistant may read for this user:
 *  - master: everything
 *  - owner: legacy (unowned) + own-company + own-userId projects
 *    (owners without a company fall back to everything — legacy safety)
 *  - employee with grants: granted ids only
 *  - employee without grants: legacy + own-company (UI parity, never foreign-owned)
 */
export const authorizedProjects = (user: User | null, projects: Project[]): Project[] => {
  if (!user) return [];
  if (user.isMasterSuperAdmin) return projects;
  if (user.role === 'admin') {
    if (!user.companyName) return projects;
    return projects.filter(p =>
      isLegacyProject(p) || p.companyName === user.companyName || (p.userId !== undefined && p.userId === user.id),
    );
  }
  if (user.projectGrants && user.projectGrants.length > 0) {
    const granted = new Set(grantedProjectIds(user.projectGrants, projects.map(p => p.id)));
    return projects.filter(p => granted.has(p.id));
  }
  if (!user.companyName) return projects.filter(isLegacyProject);
  return projects.filter(p => isLegacyProject(p) || p.companyName === user.companyName);
};

/** Effective Q&A project: current one if authorized, else first authorized, else null. */
export const effectiveAiProject = (user: User | null, projects: Project[], currentId?: string): Project | null => {
  const scope = authorizedProjects(user, projects);
  if (!scope.length) return null;
  return scope.find(p => p.id === currentId) || scope[0];
};
