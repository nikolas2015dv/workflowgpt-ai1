const { getSupabaseAdmin } = require('./supabase');
const { getUserById } = require('./users');
const { resolveRole, isOwnerUser } = require('../lib/userRole');
const { getUserTransactions } = require('./billing');

const USERS_TABLE = 'users';
const USAGE_TABLE = 'user_usage';
const HISTORY_TABLE = 'workflow_history';
const SUBSCRIPTIONS_TABLE = 'subscriptions';
const TRANSACTIONS_TABLE = 'billing_transactions';

function getClientOrThrow() {
  const client = getSupabaseAdmin();
  if (!client) {
    const error = new Error('Supabase is not configured');
    error.code = 'not_configured';
    throw error;
  }
  return client;
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

async function listAdminUsers({ query, plan } = {}) {
  const client = getClientOrThrow();

  const { data: users, error } = await client
    .from(USERS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { data: subscriptions, error: subError } = await client.from(SUBSCRIPTIONS_TABLE).select('*');
  if (subError) throw subError;

  const subByUser = new Map((subscriptions ?? []).map((row) => [row.user_id, row]));

  let rows = (users ?? []).map((row) => {
    const subscription = subByUser.get(row.id);
    const role = resolveRole(row.telegram_id, row.role);
    const resolvedPlan = resolveRole(row.telegram_id, subscription?.plan ?? role);
    return {
      id: row.id,
      telegram_id: Number(row.telegram_id),
      username: row.username ?? null,
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? null,
      role,
      plan: resolvedPlan,
      monthly_runs: row.monthly_runs ?? 0,
      total_runs: row.total_runs ?? 0,
      created_at: row.created_at,
      last_login_at: row.last_login_at ?? null,
      provider: subscription?.provider ?? 'manual',
      subscription_status: subscription?.status ?? 'active',
    };
  });

  const planFilter = String(plan ?? '').trim().toLowerCase();
  if (planFilter && planFilter !== 'all' && ['free', 'pro', 'owner'].includes(planFilter)) {
    rows = rows.filter((row) => row.plan === planFilter);
  }

  const search = String(query ?? '').trim().toLowerCase();
  if (search) {
    rows = rows.filter((row) => {
      const username = (row.username ?? '').toLowerCase();
      const firstName = (row.first_name ?? '').toLowerCase();
      const lastName = (row.last_name ?? '').toLowerCase();
      const telegramId = String(row.telegram_id);
      return (
        username.includes(search) ||
        firstName.includes(search) ||
        lastName.includes(search) ||
        telegramId.includes(search)
      );
    });
  }

  return rows;
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

async function getUserAdminHistory(userId, { limit = 20 } = {}) {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }

  const client = getClientOrThrow();
  const { data, error } = await client
    .from(HISTORY_TABLE)
    .select('id, created_at, workflow_type, subject, title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function getUserAdminBilling(userId, { limit = 20 } = {}) {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }

  return getUserTransactions(userId, { limit });
}

async function listProRequests() {
  const client = getClientOrThrow();
  const { data: transactions, error } = await client
    .from(TRANSACTIONS_TABLE)
    .select('*')
    .eq('status', 'pending')
    .eq('plan', 'pro')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const users = await listAdminUsers();
  const userById = new Map(users.map((row) => [row.id, row]));

  return (transactions ?? []).map((tx) => {
    const user = userById.get(tx.user_id);
    const meta = tx.request_meta && typeof tx.request_meta === 'object' ? tx.request_meta : {};
    return {
      id: tx.id,
      user_id: tx.user_id,
      telegram_id: user?.telegram_id ?? null,
      username: user?.username ?? null,
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? null,
      amount: Number(tx.amount),
      currency: tx.currency,
      status: tx.status,
      created_at: tx.created_at,
      request_name: String(meta.name ?? '').trim(),
      request_username: String(meta.username ?? '').trim(),
      contact: String(meta.contact ?? '').trim(),
      comment: String(meta.comment ?? '').trim(),
    };
  });
}

function daysAgoIso(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function isProRequestRow(row) {
  return Boolean(row.request_meta && typeof row.request_meta === 'object');
}

function countSince(rows, dateField, sinceIso) {
  const since = new Date(sinceIso).getTime();
  return rows.filter((row) => new Date(row[dateField]).getTime() >= since).length;
}

function buildPeriodStats({ users, proRequestRows, usageRows, sinceIso }) {
  return {
    newUsers: countSince(users, 'created_at', sinceIso),
    proRequests: countSince(proRequestRows, 'created_at', sinceIso),
    approvedRequests: proRequestRows.filter(
      (row) => row.status === 'paid_manual' && new Date(row.updated_at ?? row.created_at).getTime() >= new Date(sinceIso).getTime()
    ).length,
    workflowRuns: countSince(usageRows, 'created_at', sinceIso),
  };
}

function buildTopWorkflows(usageRows, sinceIso) {
  const since = new Date(sinceIso).getTime();
  const totals = new Map();

  for (const row of usageRows) {
    const type = String(row.workflow_type ?? 'unknown');
    const entry = totals.get(type) ?? { workflow_type: type, totalRuns: 0, runsLast30Days: 0 };
    entry.totalRuns += 1;
    if (new Date(row.created_at).getTime() >= since) {
      entry.runsLast30Days += 1;
    }
    totals.set(type, entry);
  }

  return Array.from(totals.values())
    .sort((a, b) => b.totalRuns - a.totalRuns || b.runsLast30Days - a.runsLast30Days)
    .slice(0, 10);
}

async function getAdminAnalytics() {
  const client = getClientOrThrow();
  const users = await listAdminUsers();

  const freeUsers = users.filter((u) => u.plan === 'free').length;
  const proUsers = users.filter((u) => u.plan === 'pro').length;
  const ownerUsers = users.filter((u) => u.plan === 'owner').length;

  const { data: proTransactions, error: proTxError } = await client
    .from(TRANSACTIONS_TABLE)
    .select('id, status, plan, created_at, updated_at, request_meta')
    .eq('plan', 'pro');
  if (proTxError) throw proTxError;

  const proRequestRows = (proTransactions ?? []).filter(isProRequestRow);
  const pendingRequests = proRequestRows.filter((row) => row.status === 'pending').length;
  const approvedRequests = proRequestRows.filter((row) => row.status === 'paid_manual').length;
  const rejectedRequests = proRequestRows.filter((row) => row.status === 'cancelled').length;

  const since7 = daysAgoIso(7);
  const since30 = daysAgoIso(30);

  const { data: usageRows, error: usageError } = await client
    .from(USAGE_TABLE)
    .select('workflow_type, created_at');
  if (usageError) throw usageError;

  const usage = usageRows ?? [];
  const totalRuns = usage.length;
  const runsLast7Days = countSince(usage, 'created_at', since7);
  const runsLast30Days = countSince(usage, 'created_at', since30);

  const convertibleBase = freeUsers + proUsers;
  const freeToProRate = convertibleBase > 0 ? Math.round((proUsers / convertibleBase) * 1000) / 10 : 0;

  return {
    users: {
      total: users.length,
      free: freeUsers,
      pro: proUsers,
      owner: ownerUsers,
    },
    proRequests: {
      total: proRequestRows.length,
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests,
      last7Days: countSince(proRequestRows, 'created_at', since7),
      last30Days: countSince(proRequestRows, 'created_at', since30),
    },
    conversion: {
      freeToProRate,
    },
    workflows: {
      totalRuns,
      runsLast7Days,
      runsLast30Days,
      topWorkflows: buildTopWorkflows(usage, since30),
    },
    periods: {
      last7Days: buildPeriodStats({
        users,
        proRequestRows,
        usageRows: usage,
        sinceIso: since7,
      }),
      last30Days: buildPeriodStats({
        users,
        proRequestRows,
        usageRows: usage,
        sinceIso: since30,
      }),
    },
  };
}

module.exports = {
  isOwnerUser,
  assertOwnerAccess,
  listAdminUsers,
  getAdminStats,
  getUserAdminHistory,
  getUserAdminBilling,
  listProRequests,
  getAdminAnalytics,
};
