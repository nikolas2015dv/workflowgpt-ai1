const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { buildUsageQuota } = require('../config/planLimits');
const { VALID_ROLES, getOwnerTelegramId, resolveRole } = require('../lib/userRole');

const USERS_TABLE = 'users';
const USAGE_TABLE = 'user_usage';

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    telegram_id: Number(row.telegram_id),
    username: row.username ?? null,
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? null,
    photo_url: row.photo_url ?? null,
    role: resolveRole(row.telegram_id, row.role),
    monthly_runs: row.monthly_runs ?? 0,
    total_runs: row.total_runs ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at ?? null,
  };
}

function normalizeTelegramPayload(payload) {
  const telegramId = Number(payload?.telegram_id ?? payload?.id);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    throw new Error('telegram_id is required');
  }

  return {
    telegram_id: telegramId,
    username: payload?.username ? String(payload.username).trim() : null,
    first_name: payload?.first_name ? String(payload.first_name).trim() : 'User',
    last_name: payload?.last_name ? String(payload.last_name).trim() : null,
    photo_url: payload?.photo_url ? String(payload.photo_url).trim() : null,
  };
}

function getClientOrThrow() {
  const client = getSupabaseAdmin();
  if (!client) {
    const error = new Error('Supabase is not configured');
    error.code = 'not_configured';
    throw error;
  }
  return client;
}

async function getUserByTelegramId(telegramId) {
  const client = getSupabaseAdmin();
  if (!client) return null;

  const { data, error } = await client
    .from(USERS_TABLE)
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) throw error;
  return mapUserRow(data);
}

async function getUserById(userId) {
  const client = getSupabaseAdmin();
  if (!client) return null;

  const { data, error } = await client.from(USERS_TABLE).select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return mapUserRow(data);
}

async function createUser(payload) {
  const client = getClientOrThrow();
  const normalized = normalizeTelegramPayload(payload);
  const now = new Date().toISOString();
  const role = resolveRole(normalized.telegram_id, 'free');

  const row = {
    telegram_id: normalized.telegram_id,
    username: normalized.username,
    first_name: normalized.first_name,
    last_name: normalized.last_name,
    photo_url: normalized.photo_url,
    role,
    monthly_runs: 0,
    total_runs: 0,
    created_at: now,
    updated_at: now,
    last_login_at: now,
  };

  const { data, error } = await client.from(USERS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const user = mapUserRow(data);
  const { ensureDefaultSubscription } = require('./subscriptions');
  await ensureDefaultSubscription(user.id, user.role);
  return user;
}

async function upsertUser(payload) {
  const client = getClientOrThrow();
  const normalized = normalizeTelegramPayload(payload);
  const existing = await getUserByTelegramId(normalized.telegram_id);
  const now = new Date().toISOString();

  if (!existing) {
    return createUser(payload);
  }

  const { getSubscriptionRow, ensureDefaultSubscription, resolveEffectivePlan } = require('./subscriptions');
  let subscription = await getSubscriptionRow(existing.id);
  if (!subscription) {
    subscription = await ensureDefaultSubscription(existing.id, existing.role);
  }
  const role = resolveEffectivePlan(
    { telegram_id: normalized.telegram_id, role: existing.role },
    subscription
  );
  const updates = {
    username: normalized.username,
    first_name: normalized.first_name,
    last_name: normalized.last_name,
    photo_url: normalized.photo_url,
    role,
    updated_at: now,
    last_login_at: now,
  };

  const { data, error } = await client
    .from(USERS_TABLE)
    .update(updates)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) throw error;
  const user = mapUserRow(data);

  if (subscription && subscription.plan !== role) {
    await client
      .from('subscriptions')
      .update({ plan: role, updated_at: now })
      .eq('user_id', existing.id);
  }

  return user;
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

async function incrementUsage(userId, workflowType) {
  const client = getClientOrThrow();
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }

  const now = new Date();
  const updatedAt = user.updated_at ? new Date(user.updated_at) : now;
  const monthlyRuns = isSameMonth(now, updatedAt) ? user.monthly_runs + 1 : 1;
  const totalRuns = user.total_runs + 1;

  const { error: usageError } = await client.from(USAGE_TABLE).insert({
    user_id: userId,
    workflow_type: String(workflowType ?? 'workflow'),
    created_at: now.toISOString(),
  });
  if (usageError) throw usageError;

  const { data, error } = await client
    .from(USERS_TABLE)
    .update({
      monthly_runs: monthlyRuns,
      total_runs: totalRuns,
      updated_at: now.toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return mapUserRow(data);
}

async function getUsageStats(userId) {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }

  const client = getClientOrThrow();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count, error } = await client
    .from(USAGE_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString());

  if (error) throw error;

  const monthlyUsageEvents = count ?? 0;
  const { getSubscriptionRow, resolveEffectivePlan } = require('./subscriptions');
  const subscription = await getSubscriptionRow(userId);
  const effectiveRole = resolveEffectivePlan(user, subscription);
  const monthlyRuns = Math.max(user.monthly_runs ?? 0, monthlyUsageEvents);

  return {
    user: { ...user, role: effectiveRole },
    monthly_usage_events: monthlyUsageEvents,
    monthly_runs: monthlyRuns,
    ...buildUsageQuota({ ...user, role: effectiveRole, monthly_runs: monthlyRuns }),
  };
}

const { canUserRunWorkflow } = require('../config/planLimits');

module.exports = {
  USERS_TABLE,
  USAGE_TABLE,
  VALID_ROLES,
  getOwnerTelegramId,
  resolveRole,
  mapUserRow,
  getUserByTelegramId,
  getUserById,
  createUser,
  upsertUser,
  incrementUsage,
  getUsageStats,
  isSupabaseConfigured,
  canUserRunWorkflow,
  buildUsageQuota,
};
