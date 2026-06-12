import type { PlanLimits, UsageQuota, UserRole } from '../types/user';

/** Единая конфигурация тарифов WorkflowGPT */
export const PLAN_LIMITS: Record<UserRole, PlanLimits> = {
  owner: { maxMonthlyRuns: null },
  pro: { maxMonthlyRuns: 500 },
  free: { maxMonthlyRuns: 5 },
};

export function getPlanLimits(role: UserRole): PlanLimits {
  return PLAN_LIMITS[role] ?? PLAN_LIMITS.free;
}

export function isUnlimitedRole(role: UserRole): boolean {
  return getPlanLimits(role).maxMonthlyRuns == null;
}

export function getTariffKey(role: UserRole): 'free' | 'pro' | 'unlimited' {
  if (role === 'owner') return 'unlimited';
  return role;
}

export function formatRoleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    owner: 'Owner',
    pro: 'Pro',
    free: 'Free',
  };
  return map[role] ?? role;
}

export function formatTariffLabel(role: UserRole): string {
  if (role === 'owner') return 'Unlimited';
  if (role === 'pro') return 'Pro';
  return 'Free';
}

export function formatLimitValue(role: UserRole): string {
  if (isUnlimitedRole(role)) return 'Unlimited';
  return String(getPlanLimits(role).maxMonthlyRuns);
}

export function formatPlanLimitLabel(role: UserRole): string {
  if (isUnlimitedRole(role)) return 'Unlimited';
  return `${getPlanLimits(role).maxMonthlyRuns} запусков в месяц`;
}

export interface RunCheckResult {
  allowed: boolean;
  unlimited: boolean;
  limit: number | null;
  remaining: number | null;
  message?: string;
}

export function canRunWorkflow(role: UserRole, monthlyRuns: number): RunCheckResult {
  const limits = getPlanLimits(role);

  if (limits.maxMonthlyRuns == null) {
    return { allowed: true, unlimited: true, limit: null, remaining: null };
  }

  const remaining = Math.max(0, limits.maxMonthlyRuns - monthlyRuns);

  if (monthlyRuns >= limits.maxMonthlyRuns) {
    return {
      allowed: false,
      unlimited: false,
      limit: limits.maxMonthlyRuns,
      remaining: 0,
      message:
        role === 'free'
          ? `Лимит Free исчерпан (${limits.maxMonthlyRuns} запусков в месяц).`
          : `Лимит Pro исчерпан (${limits.maxMonthlyRuns} запусков в месяц).`,
    };
  }

  return {
    allowed: true,
    unlimited: false,
    limit: limits.maxMonthlyRuns,
    remaining,
  };
}

export function getUsageQuota(role: UserRole, monthlyRuns: number, totalRuns = 0): UsageQuota {
  const check = canRunWorkflow(role, monthlyRuns);
  return {
    monthly_runs: monthlyRuns,
    total_runs: totalRuns,
    limit: check.limit,
    remaining: check.remaining,
    unlimited: check.unlimited,
    role,
    tariff: getTariffKey(role),
  };
}
