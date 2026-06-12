/** @typedef {'owner' | 'pro' | 'free'} UserRole */

/** @type {Record<UserRole, { maxMonthlyRuns: number | null }>} */
const PLAN_LIMITS = {
  owner: { maxMonthlyRuns: null },
  pro: { maxMonthlyRuns: 500 },
  free: { maxMonthlyRuns: 5 },
};

const VALID_ROLES = new Set(['owner', 'pro', 'free']);

/**
 * @param {string} role
 * @returns {{ maxMonthlyRuns: number | null }}
 */
function getPlanLimits(role) {
  if (VALID_ROLES.has(role)) {
    return PLAN_LIMITS[/** @type {UserRole} */ (role)];
  }
  return PLAN_LIMITS.free;
}

/**
 * @param {string} role
 */
function isUnlimitedRole(role) {
  return getPlanLimits(role).maxMonthlyRuns == null;
}

/**
 * @param {string} role
 */
function getTariffLabel(role) {
  if (role === 'owner') return 'unlimited';
  return role;
}

/**
 * @param {{ role: string; monthly_runs?: number }} user
 */
function canUserRunWorkflow(user) {
  const role = user.role ?? 'free';
  const limits = getPlanLimits(role);

  if (limits.maxMonthlyRuns == null) {
    return {
      allowed: true,
      unlimited: true,
      limit: null,
      remaining: null,
      role,
    };
  }

  const used = user.monthly_runs ?? 0;
  const remaining = Math.max(0, limits.maxMonthlyRuns - used);

  if (used >= limits.maxMonthlyRuns) {
    return {
      allowed: false,
      unlimited: false,
      limit: limits.maxMonthlyRuns,
      remaining: 0,
      role,
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
    role,
  };
}

/**
 * @param {{ role: string; monthly_runs?: number; total_runs?: number }} user
 */
function buildUsageQuota(user) {
  const check = canUserRunWorkflow(user);
  return {
    monthly_runs: user.monthly_runs ?? 0,
    total_runs: user.total_runs ?? 0,
    limit: check.limit,
    remaining: check.remaining,
    unlimited: check.unlimited ?? false,
    role: user.role,
    tariff: getTariffLabel(user.role),
  };
}

module.exports = {
  PLAN_LIMITS,
  getPlanLimits,
  isUnlimitedRole,
  getTariffLabel,
  canUserRunWorkflow,
  buildUsageQuota,
};
