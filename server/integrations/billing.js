const { getSupabaseAdmin } = require('./supabase');
const { getUserById } = require('./users');
const { changeSubscription, getSubscriptionForUser } = require('./subscriptions');
const { isOwnerUser } = require('./admin');
const {
  VALID_TRANSACTION_STATUSES,
  VALID_PROVIDERS,
  VALID_BILLABLE_PLANS,
  getPlanPricing,
} = require('../config/billingPlans');

const CUSTOMERS_TABLE = 'billing_customers';
const TRANSACTIONS_TABLE = 'billing_transactions';
const EVENTS_TABLE = 'billing_events';

function getClientOrThrow() {
  const client = getSupabaseAdmin();
  if (!client) {
    const error = new Error('Supabase is not configured');
    error.code = 'not_configured';
    throw error;
  }
  return client;
}

function mapCustomerRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    telegram_id: Number(row.telegram_id),
    customer_status: row.customer_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapTransactionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    provider: row.provider,
    provider_transaction_id: row.provider_transaction_id ?? null,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    plan: row.plan,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function logBillingEvent(userId, eventType, payload = {}) {
  const client = getClientOrThrow();
  const { error } = await client.from(EVENTS_TABLE).insert({
    user_id: userId ?? null,
    event_type: eventType,
    payload,
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[logBillingEvent]', eventType, error);
  }
}

async function ensureBillingCustomer(userId) {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }

  const client = getClientOrThrow();
  const { data: existing, error: fetchError } = await client
    .from(CUSTOMERS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return mapCustomerRow(existing);

  const now = new Date().toISOString();
  const { data, error } = await client
    .from(CUSTOMERS_TABLE)
    .insert({
      user_id: userId,
      telegram_id: user.telegram_id,
      customer_status: 'active',
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw error;

  await logBillingEvent(userId, 'customer.created', { customer_id: data.id });
  return mapCustomerRow(data);
}

async function getTransactionById(transactionId) {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from(TRANSACTIONS_TABLE)
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();

  if (error) throw error;
  return mapTransactionRow(data);
}

async function getPendingTransactionForPlan(userId, plan) {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from(TRANSACTIONS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('plan', plan)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return mapTransactionRow(data);
}

async function createTransaction(userId, { plan, provider = 'manual', amount, currency }) {
  const user = await getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'user_not_found';
    throw error;
  }

  if (isOwnerUser(user)) {
    const error = new Error('Owner plan does not require billing');
    error.code = 'forbidden';
    throw error;
  }

  const nextPlan = String(plan ?? '').trim();
  if (!VALID_BILLABLE_PLANS.has(nextPlan)) {
    const error = new Error('Plan is not available for purchase');
    error.code = 'invalid_plan';
    throw error;
  }

  const subscriptionInfo = await getSubscriptionForUser(userId);
  if (subscriptionInfo.effectivePlan === nextPlan) {
    const error = new Error('You are already on this plan');
    error.code = 'already_subscribed';
    throw error;
  }

  const existingPending = await getPendingTransactionForPlan(userId, nextPlan);
  if (existingPending) {
    return existingPending;
  }

  const pricing = getPlanPricing(nextPlan);
  const nextProvider = VALID_PROVIDERS.has(provider) ? provider : 'manual';
  const now = new Date().toISOString();
  const client = getClientOrThrow();

  await ensureBillingCustomer(userId);

  const row = {
    user_id: userId,
    provider: nextProvider,
    provider_transaction_id: null,
    amount: amount ?? pricing?.amount ?? 0,
    currency: currency ?? pricing?.currency ?? 'RUB',
    status: 'pending',
    plan: nextPlan,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client.from(TRANSACTIONS_TABLE).insert(row).select('*').single();
  console.log('[AUDIT][billing.createTransaction] insert result', {
    userId,
    plan: nextPlan,
    insertError: error?.message ?? null,
    insertCode: error?.code ?? null,
    transactionId: data?.id ?? null,
  });
  if (error) throw error;

  const transaction = mapTransactionRow(data);
  await logBillingEvent(userId, 'transaction.created', {
    transaction_id: transaction.id,
    plan: nextPlan,
    amount: transaction.amount,
    currency: transaction.currency,
    provider: nextProvider,
  });

  return transaction;
}

async function updateTransactionStatus(transactionId, status, extra = {}) {
  if (!VALID_TRANSACTION_STATUSES.has(status)) {
    const error = new Error(`Invalid transaction status: ${status}`);
    error.code = 'invalid_status';
    throw error;
  }

  const client = getClientOrThrow();
  const now = new Date().toISOString();
  const patch = { status, updated_at: now, ...extra };

  const { data, error } = await client
    .from(TRANSACTIONS_TABLE)
    .update(patch)
    .eq('id', transactionId)
    .select('*')
    .single();

  if (error) throw error;
  return mapTransactionRow(data);
}

async function markTransactionPaid(transactionId, providerTransactionId = null) {
  const transaction = await getTransactionById(transactionId);
  if (!transaction) {
    const error = new Error('Transaction not found');
    error.code = 'transaction_not_found';
    throw error;
  }

  if (transaction.status === 'paid') {
    return transaction;
  }

  if (transaction.status !== 'pending') {
    const error = new Error(`Cannot mark ${transaction.status} transaction as paid`);
    error.code = 'invalid_status';
    throw error;
  }

  const extra = {};
  if (providerTransactionId) {
    extra.provider_transaction_id = providerTransactionId;
  } else {
    extra.provider_transaction_id = `fake_${transactionId.slice(0, 8)}_${Date.now()}`;
  }

  const updated = await updateTransactionStatus(transactionId, 'paid', extra);

  const subscriptionResult = await changeSubscription(transaction.user_id, {
    plan: transaction.plan,
    status: 'active',
    provider: transaction.provider === 'fake' ? 'manual' : transaction.provider,
    source: 'billing',
  });

  await logBillingEvent(transaction.user_id, 'transaction.paid', {
    transaction_id: transactionId,
    plan: transaction.plan,
    provider_transaction_id: updated.provider_transaction_id,
  });

  return {
    transaction: updated,
    subscription: subscriptionResult,
  };
}

async function markTransactionFailed(transactionId, reason = null) {
  const transaction = await getTransactionById(transactionId);
  if (!transaction) {
    const error = new Error('Transaction not found');
    error.code = 'transaction_not_found';
    throw error;
  }

  if (transaction.status !== 'pending') {
    const error = new Error(`Cannot mark ${transaction.status} transaction as failed`);
    error.code = 'invalid_status';
    throw error;
  }

  const updated = await updateTransactionStatus(transactionId, 'failed');
  await logBillingEvent(transaction.user_id, 'transaction.failed', {
    transaction_id: transactionId,
    reason,
  });

  return updated;
}

async function cancelTransaction(transactionId) {
  const transaction = await getTransactionById(transactionId);
  if (!transaction) {
    const error = new Error('Transaction not found');
    error.code = 'transaction_not_found';
    throw error;
  }

  if (transaction.status !== 'pending') {
    const error = new Error('Only pending transactions can be cancelled');
    error.code = 'invalid_status';
    throw error;
  }

  const updated = await updateTransactionStatus(transactionId, 'cancelled');
  await logBillingEvent(transaction.user_id, 'transaction.cancelled', {
    transaction_id: transactionId,
    plan: transaction.plan,
  });

  return updated;
}

async function markTransactionRefunded(transactionId) {
  const transaction = await getTransactionById(transactionId);
  if (!transaction) {
    const error = new Error('Transaction not found');
    error.code = 'transaction_not_found';
    throw error;
  }

  if (transaction.status !== 'paid') {
    const error = new Error('Only paid transactions can be refunded');
    error.code = 'invalid_status';
    throw error;
  }

  const updated = await updateTransactionStatus(transactionId, 'refunded');

  await changeSubscription(transaction.user_id, {
    plan: 'free',
    status: 'active',
    provider: 'manual',
    source: 'admin',
  });

  await logBillingEvent(transaction.user_id, 'transaction.refunded', {
    transaction_id: transactionId,
    plan: transaction.plan,
  });

  return updated;
}

async function assertTransactionOwner(transactionId, userId, allowOwnerView = false) {
  const transaction = await getTransactionById(transactionId);
  if (!transaction) {
    const error = new Error('Transaction not found');
    error.code = 'transaction_not_found';
    throw error;
  }

  if (transaction.user_id === userId) {
    return transaction;
  }

  if (allowOwnerView) {
    const requester = await getUserById(userId);
    if (requester && isOwnerUser(requester)) {
      return transaction;
    }
  }

  const error = new Error('Access denied');
  error.code = 'forbidden';
  throw error;
}

async function processFakePayment(userId, transactionId) {
  await assertTransactionOwner(transactionId, userId, false);
  return markTransactionPaid(transactionId);
}

async function getUserTransactions(userId, { limit = 50 } = {}) {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from(TRANSACTIONS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapTransactionRow);
}

async function getUserBillingSummary(userId) {
  const subscriptionInfo = await getSubscriptionForUser(userId);
  const transactions = await getUserTransactions(userId, { limit: 100 });

  const paidTransactions = transactions.filter((t) => t.status === 'paid');
  const totalPaid = paidTransactions.reduce((sum, t) => sum + t.amount, 0);
  const pendingTransaction =
    transactions.find((t) => t.status === 'pending' && t.plan === 'pro') ?? null;

  return {
    total_paid: totalPaid,
    transactions_count: transactions.length,
    active_plan: subscriptionInfo.effectivePlan,
    pending_transaction: pendingTransaction,
    currency: paidTransactions[0]?.currency ?? 'RUB',
  };
}

async function getBillingStats() {
  const client = getClientOrThrow();

  const { data: transactions, error } = await client.from(TRANSACTIONS_TABLE).select('*');
  if (error) throw error;

  const rows = (transactions ?? []).map(mapTransactionRow);
  const paid = rows.filter((t) => t.status === 'paid');
  const pending = rows.filter((t) => t.status === 'pending');

  const totalRevenue = paid.reduce((sum, t) => sum + t.amount, 0);

  const { data: subscriptions, error: subError } = await client
    .from('subscriptions')
    .select('plan, status')
    .eq('plan', 'pro')
    .eq('status', 'active');
  if (subError) throw subError;

  return {
    total_revenue: totalRevenue,
    paid_transactions: paid.length,
    pending_transactions: pending.length,
    active_pro_users: (subscriptions ?? []).length,
    currency: paid[0]?.currency ?? 'RUB',
  };
}

async function listAllTransactions({ status, limit = 100 } = {}) {
  const client = getClientOrThrow();
  let query = client.from(TRANSACTIONS_TABLE).select('*').order('created_at', { ascending: false });

  if (status && VALID_TRANSACTION_STATUSES.has(status)) {
    query = query.eq('status', status);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapTransactionRow);
}

module.exports = {
  CUSTOMERS_TABLE,
  TRANSACTIONS_TABLE,
  EVENTS_TABLE,
  ensureBillingCustomer,
  createTransaction,
  getTransactionById,
  getPendingTransactionForPlan,
  markTransactionPaid,
  markTransactionFailed,
  markTransactionRefunded,
  cancelTransaction,
  processFakePayment,
  getUserTransactions,
  getUserBillingSummary,
  getBillingStats,
  listAllTransactions,
  assertTransactionOwner,
  logBillingEvent,
};
