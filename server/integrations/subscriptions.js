const { getSupabaseAdmin } = require('./supabase');
const { getUserById } = require('./users');
const { getOwnerTelegramId, resolveRole } = require('../lib/userRole');
const { buildUsageQuota } = require('../config/planLimits');

const TABLE = 'subscriptions';
const VALID_PLANS = new Set(['free', 'pro', 'owner']);
const VALID_STATUSES = new Set(['active', 'cancelled', 'expired', 'trialing']);
const VALID_PROVIDERS = new Set(['manual', 'telegram', 'stripe']);

function getClientOrThrow() {
  const client = getSupabaseAdmin();
  if (!client) {
    const error = new Error('Supabase is not configured');
    error.code = 'not_configured';
    throw error;
  }
  return client;
}

function mapSubscriptionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    plan: row.plan,
    status: row.status,
    provider: row.provider,
    started_at: row.started_at,
    expires_at: row.expires_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function resolveEffectivePlan(user, subscription) {
  const basePlan = subscription?.plan ?? user?.role ?? 'free';
  return resolveRole(user.telegram_id, basePlan);
}

async function getSubscriptionRow(userId) {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return mapSubscriptionRow(data);
}

async function ensureDefaultSubscription(userId, plan = 'free') {
  const existing = await getSubscriptionRow(userId);
  if (existing) return existing;

  const client = getClientOrThrow();
  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    plan: VALID_PLANS.has(plan) ? plan : 'free',
    status: 'active',
    provider: 'manual',
    started_at: now,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client.from(TABLE).insert(row).select('*').single();
  if (error) throw error;
  return mapSubscriptionRow(data);
}

async function getSubscriptionForUser(userId) {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }

  let subscription = await getSubscriptionRow(userId);
  if (!subscription) {
    subscription = await ensureDefaultSubscription(userId, user.role);
  }

  const effectivePlan = resolveEffectivePlan(user, subscription);
  const quota = buildUsageQuota({ ...user, role: effectivePlan });

  return {
    subscription,
    effectivePlan,
    quota,
  };
}

const PRO_ACTIVATION_SOURCES = new Set(['billing', 'admin']);

async function changeSubscription(userId, { plan, status, provider, source = 'direct' }) {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }

  const ownerId = getOwnerTelegramId();
  const isOwnerAccount = ownerId != null && Number(user.telegram_id) === ownerId;

  let nextPlan = String(plan ?? 'free').trim();
  if (!VALID_PLANS.has(nextPlan)) {
    const error = new Error('Invalid plan. Use free, pro, or owner.');
    error.code = 'invalid_plan';
    throw error;
  }

  if (isOwnerAccount) {
    nextPlan = 'owner';
  }

  if (nextPlan === 'pro' && !PRO_ACTIVATION_SOURCES.has(source)) {
    const error = new Error(
      'Pro plan requires billing payment. Use POST /api/billing/checkout then POST /api/billing/pay.'
    );
    error.code = 'billing_required';
    throw error;
  }

  const nextStatus = VALID_STATUSES.has(status) ? status : 'active';
  const nextProvider = VALID_PROVIDERS.has(provider) ? provider : 'manual';
  const now = new Date().toISOString();
  const client = getClientOrThrow();

  const existing = await getSubscriptionRow(userId);
  let subscription;

  if (existing) {
    const { data, error } = await client
      .from(TABLE)
      .update({
        plan: nextPlan,
        status: nextStatus,
        provider: nextProvider,
        updated_at: now,
        started_at: nextStatus === 'active' ? now : existing.started_at,
      })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    subscription = mapSubscriptionRow(data);
  } else {
    subscription = await ensureDefaultSubscription(userId, nextPlan);
    const { data, error } = await client
      .from(TABLE)
      .update({
        plan: nextPlan,
        status: nextStatus,
        provider: nextProvider,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    subscription = mapSubscriptionRow(data);
  }

  const effectiveRole = resolveEffectivePlan(user, subscription);
  const { error: userError } = await client
    .from('users')
    .update({ role: effectiveRole, updated_at: now })
    .eq('id', userId);
  if (userError) throw userError;

  const updatedUser = await getUserById(userId);
  return {
    subscription,
    user: updatedUser,
    effectivePlan: effectiveRole,
    quota: buildUsageQuota({ ...updatedUser, role: effectiveRole }),
  };
}

module.exports = {
  TABLE,
  VALID_PLANS,
  VALID_STATUSES,
  VALID_PROVIDERS,
  mapSubscriptionRow,
  resolveEffectivePlan,
  getSubscriptionRow,
  ensureDefaultSubscription,
  getSubscriptionForUser,
  changeSubscription,
};
