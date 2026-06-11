import type { PlanLimits, UserRole } from '../types/user';

export const PLAN_LIMITS: Record<UserRole, PlanLimits> = {
  owner: { maxMonthlyRuns: null },
  pro: { maxMonthlyRuns: null },
  free: { maxMonthlyRuns: 5 },
};

export function getPlanLimits(role: UserRole): PlanLimits {
  return PLAN_LIMITS[role] ?? PLAN_LIMITS.free;
}

export function formatPlanLimitLabel(role: UserRole): string {
  const limits = getPlanLimits(role);
  if (limits.maxMonthlyRuns == null) return 'Безлимит';
  return `${limits.maxMonthlyRuns} запусков в месяц`;
}

export function formatRoleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    owner: 'Owner',
    pro: 'Pro',
    free: 'Free',
  };
  return map[role] ?? role;
}
