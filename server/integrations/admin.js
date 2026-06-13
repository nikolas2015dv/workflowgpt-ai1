const { getSupabaseAdmin } = require('./supabase');
const { getUserById } = require('./users');
const { getOwnerTelegramId, resolveRole } = require('../lib/userRole');
const USERS_TABLE = 'users';
const USAGE_TABLE = 'user_usage';
const HISTORY_TABLE = 'workflow_history';
const SUBSCRIPTIONS_TABLE = 'subscriptions';

function getClientOrThrow() {
  const client = getSupabaseAdmin();
  if (!client) {
    const error = new Error('Supabase is not configured');
    error.code = 'not_configured';
    throw error;
  }
  return client;
}

function isOwnerUser(user) {
  if (!user || user.role !== 'owner') return false;
  const ownerTelegramId = getOwnerTelegramId();
  if (ownerTelegramId == null) return user.role === 'owner';
  return Number(user.telegram_id) === ownerTelegramId;
}

async function assertOwnerAccess(userId) {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }
  if (!isOwnerUser(user)) {
    const error = new Error('Admin access denied');
    error.code = 'forbidden';
    throw error;
  }
  return user;
}

async function listAdminUsers() {
  const client = getClientOrThrow();

  const { data: users, error } = await client
    .from(USERS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { data: subscriptions, error: subError } = await client.from(SUBSCRIPTIONS_TABLE).select('*');
  if (subError) throw subError;

  const subByUser = new Map((subscriptions ?? []).map((row) => [row.user_id, row]));

  return (users ?? []).map((row) => {
    const subscription = subByUser.get(row.id);
    const role = resolveRole(row.telegram_id, row.role);
    const plan = subscription?.plan ?? role;
    return {
      id: row.id,
      telegram_id: Number(row.telegram_id),
      username: row.username ?? null,
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? null,
      role,
      plan: resolveRole(row.telegram_id, plan),
      monthly_runs: row.monthly_runs ?? 0,
      total_runs: row.total_runs ?? 0,
      created_at: row.created_at,
      subscription_status: subscription?.status ?? 'active',
    };
  });
}

async function getAdminStats() {
  const client = getClientOrThrow();
  const users = await listAdminUsers();

  const freeUsers = users.filter((u) => u.plan === 'free').length;
  const proUsers = users.filter((u) => u.plan === 'pro').length;
  const ownerUsers = users.filter((u) => u.plan === 'owner').length;

  const { count: historyCount, error: historyError } = await client
    .from(HISTORY_TABLE)
    .select('id', { count: 'exact', head: true });
  if (historyError) throw historyError;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: workflowsThisMonth, error: usageError } = await client
    .from(USAGE_TABLE)
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart.toISOString());
  if (usageError) throw usageError;

  const totalWorkflows = users.reduce((sum, u) => sum + (u.total_runs ?? 0), 0);

  return {
    total_users: users.length,
    free_users: freeUsers,
    pro_users: proUsers,
    owner_users: ownerUsers,
    total_workflows: totalWorkflows,
    total_history_records: historyCount ?? 0,
    workflows_this_month: workflowsThisMonth ?? 0,
  };
}

module.exports = {
  isOwnerUser,
  assertOwnerAccess,
  listAdminUsers,
  getAdminStats,
};
