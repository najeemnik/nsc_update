import type { GrantAction, ProjectGrant, User, UserRole } from '../types';

/**
 * Wave 19 — pure permission evaluator (no React, fully unit-testable).
 *
 * Model: default-deny. A user with explicit `projectGrants` can do exactly
 * what those grants allow — nothing more. Company-wide sections
 * (users / settings / audit_logs) are satisfied by ANY grant entry.
 * Project sections are satisfied by the grant for the current project
 * or by the wildcard '*' grant (covers current + future projects).
 * Non-view actions always imply the need for view on that section.
 *
 * Users WITHOUT explicit grants (legacy / seed users) fall back to the
 * old rule set: customEnabledModules flag, `allowedTabs`, then role
 * defaults (accountant = 12 tabs, viewer = 7 tabs, admin = all).
 * Legacy accountant = full data actions except `approve` (new power,
 * must be explicitly granted). Legacy viewer = view only.
 */

export const ALL_ACTIONS: GrantAction[] = [
  'view', 'create', 'edit', 'del', 'approve', 'print', 'export',
];

/** Sections that describe company-wide data, not one project. */
export const COMPANY_SECTIONS = new Set(['users', 'settings', 'audit_logs']);

/** Project-scoped sections (need the grant for the current project). Sidebar order. */
export const PROJECT_SECTIONS = [
  'dashboard', 'projects', 'steel', 'concrete', 'expenses', 'contractors',
  'labor', 'suppliers', 'assets', 'apartments', 'payments', 'budget',
  'documents', 'reports', 'accounting',
] as const;

/** All matrix sections in UI order (18 incl. company sections). */
export const ALL_GRANT_SECTIONS = [
  ...PROJECT_SECTIONS,
  'users', 'settings', 'audit_logs',
] as const;

export const emptyGrant = (): Record<GrantAction, boolean> => ({
  view: false, create: false, edit: false, del: false,
  approve: false, print: false, export: false,
});

export const fullGrant = (): Record<GrantAction, boolean> => ({
  view: true, create: true, edit: true, del: true,
  approve: true, print: true, export: true,
});

export const viewGrant = (): Record<GrantAction, boolean> => ({
  ...emptyGrant(), view: true,
});

export const entryGrant = (): Record<GrantAction, boolean> => ({
  ...emptyGrant(), view: true, create: true, edit: true,
});

const readGrant = (
  sections: ProjectGrant['sections'] | undefined,
  section: string,
  action: GrantAction,
): boolean => sections?.[section]?.[action] === true;

/**
 * Pure evaluation of an explicit grant list.
 * @param now epoch ms (injectable for tests)
 */
export const evaluateGrant = (
  grants: ProjectGrant[] | undefined,
  projectId: string,
  section: string,
  action: GrantAction,
): boolean => {
  if (!grants || grants.length === 0) return false;
  const relevant = COMPANY_SECTIONS.has(section)
    ? grants
    : grants.filter(g => g.projectId === '*' || g.projectId === projectId);
  if (relevant.length === 0) return false;
  const viewOk = relevant.some(g => readGrant(g.sections, section, 'view'));
  if (action === 'view') return viewOk;
  // Non-view actions require view on the same section (prevents blind writes).
  if (!viewOk) return false;
  return relevant.some(g => readGrant(g.sections, section, action));
};

/** Which project ids (of allIds) are visible with these explicit grants. */
export const grantedProjectIds = (
  grants: ProjectGrant[] | undefined,
  allIds: string[],
): string[] => {
  if (!grants || grants.length === 0) return [...allIds]; // legacy: all
  if (grants.some(g => g.projectId === '*')) return [...allIds];
  const wanted = new Set(grants.map(g => g.projectId));
  return allIds.filter(id => wanted.has(id));
};

// ---------- legacy fallback (pre-Wave-19 rule set, preserved) ----------

const LEGACY_ACCOUNTANT_TABS = [
  'dashboard', 'projects', 'steel', 'concrete', 'expenses', 'contractors',
  'suppliers', 'payments', 'budget', 'accounting', 'documents', 'reports',
];

const LEGACY_VIEWER_TABS = [
  'dashboard', 'projects', 'apartments', 'budget', 'accounting',
  'documents', 'reports',
];

const legacyView = (user: User, section: string): boolean => {
  const modules = user.customEnabledModules;
  if (modules && (modules as Record<string, unknown>)[section] === false) return false;
  if (user.role === 'admin') return true;
  if (section === 'settings' || section === 'users' || section === 'admin') return false;
  const allowed = user.permissions?.allowedTabs;
  if (Array.isArray(allowed) && allowed.length > 0) return allowed.includes(section);
  if (user.role === 'accountant') return LEGACY_ACCOUNTANT_TABS.includes(section);
  if (user.role === 'viewer') return LEGACY_VIEWER_TABS.includes(section);
  return true;
};

const legacyAction = (user: User, section: string, action: GrantAction): boolean => {
  if (!legacyView(user, section)) return false;
  if (user.role === 'admin') return true;
  if (action === 'view') return true;
  if (user.role === 'accountant') {
    // Legacy accountants keep every old power; `approve` is new → grant-only.
    return action !== 'approve';
  }
  // Legacy viewers: view only.
  return false;
};

/**
 * Full user-level check: account state + expiry + explicit grants + legacy.
 * @param user current user (null = deny)
 * @param now epoch ms (defaults to Date.now(), injectable for tests)
 */
export const canDo = (
  user: User | null,
  projectId: string,
  section: string,
  action: GrantAction,
  now: number = Date.now(),
): boolean => {
  if (!user) return false;
  if (user.isMasterSuperAdmin === true) return true;
  if (user.active === false) return false;
  if (user.isLockedBySuperAdmin === true) return false;
  if (user.role === 'admin') return true; // owner: full access over own company
  if (user.accessExpiresAt) {
    const exp = new Date(user.accessExpiresAt).getTime();
    if (!Number.isNaN(exp) && exp <= now) return false;
  }
  if (user.projectGrants && user.projectGrants.length > 0) {
    return evaluateGrant(user.projectGrants, projectId, section, action);
  }
  return legacyAction(user, section, action);
};

/** Role preset applied by the owner when creating/editing an employee. */
export const presetGrants = (
  preset: 'full' | 'entry' | 'view',
  projectIds: string[],
): ProjectGrant[] => {
  const mk = (): Record<GrantAction, boolean> =>
    preset === 'full' ? fullGrant() : preset === 'entry' ? entryGrant() : viewGrant();
  return projectIds.map(projectId => {
    const sections: ProjectGrant['sections'] = {};
    for (const s of ALL_GRANT_SECTIONS) {
      // Data-entry preset never touches company sections; view-only likewise.
      if (preset !== 'full' && COMPANY_SECTIONS.has(s)) continue;
      sections[s] = { ...mk() };
    }
    return { projectId, sections };
  });
};

export type { UserRole };
