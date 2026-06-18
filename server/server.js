const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const { ExtractTextError } = require('./fileProcessing/extract');
const { universalUpload, MAX_FILE_SIZE } = require('./upload');
const { resolveWorkflowForUpload, normalizeWorkflow, WORKFLOW_IDS } = require('./workflows/config');
const { processTextRequest, processFileUpload } = require('./workflows/processor');
const { WorkflowStepError, WorkflowValidationError, requireWorkflow } = require('./utils/validators');
const { buildExport } = require('./services/exportService');
const { createCorsOptions, parseAllowedOrigins } = require('./config/cors');
const { listWorkflowMetadata } = require('./workflows/metadata');
const { exportToNotion, NotionExportError } = require('./integrations/notion');
const { validateBitrixWebhook, exportToBitrix, createBitrixTasks, BitrixExportError } = require('./integrations/bitrix');
const {
  isSupabaseConfigured,
  checkSupabaseHealth,
  insertWorkflowHistory,
  listWorkflowHistory,
  deleteWorkflowHistoryById,
  clearWorkflowHistory,
} = require('./integrations/supabase');
const {
  upsertUser,
  getUserById,
  incrementUsage,
  getUsageStats,
  canUserRunWorkflow,
  isSupabaseConfigured: isUsersDbConfigured,
} = require('./integrations/users');
const { getSubscriptionForUser, changeSubscription } = require('./integrations/subscriptions');
const { assertOwnerAccess, listAdminUsers, getAdminStats, getUserAdminHistory, getUserAdminBilling, listProRequests } = require('./integrations/admin');
const {
  createTransaction,
  processFakePayment,
  getUserTransactions,
  getUserBillingSummary,
  getBillingStats,
  listAllTransactions,
  cancelTransaction,
} = require('./integrations/billing');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors(createCorsOptions()));
app.options('*', cors(createCorsOptions()));
app.use(express.json({ limit: '4mb' }));

// AUDIT-TEMP: log billing/subscription POST requests at route entry
app.use((req, res, next) => {
  if (
    req.method === 'POST' &&
    (req.path === '/api/billing/checkout' ||
      req.path === '/api/billing/pay' ||
      req.path === '/api/subscription/change')
  ) {
    console.log('[AUDIT][server] incoming request', {
      method: req.method,
      path: req.path,
      userId: req.header('X-User-Id') ?? null,
      body: req.body,
    });
  }
  next();
});

function jsonError(res, status, error, message, extra = {}) {
  return res.status(status).json({ ok: false, status: 'error', error, message, ...extra });
}

function jsonOk(res, payload) {
  return res.json({ ok: true, status: 'ok', ...payload });
}

function parseUserIdHeader(req) {
  const raw = req.header('X-User-Id');
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireUserId(req, res, next) {
  const userId = parseUserIdHeader(req);
  if (!userId) {
    return jsonError(res, 401, 'Unauthorized', 'X-User-Id header is required');
  }
  req.userId = userId;
  return next();
}

function requireOwner(req, res, next) {
  const userId = parseUserIdHeader(req);
  if (!userId) {
    return jsonError(res, 401, 'Unauthorized', 'X-User-Id header is required');
  }

  assertOwnerAccess(userId)
    .then((ownerUser) => {
      req.userId = userId;
      req.ownerUser = ownerUser;
      return next();
    })
    .catch((error) => {
      if (error.code === 'forbidden') {
        return jsonError(res, 403, 'forbidden', 'Admin access denied');
      }
      if (error.code === 'user_not_found') {
        return jsonError(res, 404, 'user_not_found', 'User not found');
      }
      if (error.code === 'not_configured') {
        return jsonError(res, 503, 'not_configured', error.message ?? 'Supabase is not configured');
      }
      console.error('[requireOwner]', error);
      return jsonError(res, 500, 'Internal Server Error', error.message ?? 'Owner check failed');
    });
}

function enforceRunLimit(req, res, next) {
  if (!isSupabaseConfigured()) {
    return next();
  }

  const userId = parseUserIdHeader(req);
  if (!userId) {
    return jsonError(res, 401, 'Unauthorized', 'X-User-Id header is required');
  }

  Promise.all([getUserById(userId), getSubscriptionForUser(userId).catch(() => null)])
    .then(([user, subscriptionInfo]) => {
      if (!user) {
        return jsonError(res, 404, 'user_not_found', 'User not found');
      }

      const effectiveUser = subscriptionInfo
        ? { ...user, role: subscriptionInfo.effectivePlan, monthly_runs: subscriptionInfo.quota.monthly_runs }
        : user;

      const check = canUserRunWorkflow(effectiveUser);
      if (!check.allowed) {
        return jsonError(res, 429, 'limit_exceeded', check.message ?? 'Monthly run limit reached', {
          code: 'limit_exceeded',
          limit: check.limit,
          remaining: check.remaining ?? 0,
          role: effectiveUser.role,
        });
      }

      req.userId = userId;
      req.authUser = effectiveUser;
      return next();
    })
    .catch((error) => {
      console.error('[enforceRunLimit]', error);
      return jsonError(res, 500, 'Internal Server Error', error.message ?? 'Run limit check failed');
    });
}

function handleOpenAiError(error, res) {
  if (error.message === 'OPENAI_API_KEY is not configured') {
    return jsonError(res, 500, 'Configuration Error', 'OPENAI_API_KEY is not set on the server');
  }

  const status = error.status ?? error.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return jsonError(res, status, 'OpenAI API Error', error.message ?? 'Upstream AI request failed');
  }

  return jsonError(res, 500, 'Internal Server Error', error.message ?? 'Failed to generate AI response');
}

function handleUploadMiddlewareError(error, res) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return jsonError(
        res,
        400,
        'Bad Request',
        `Файл слишком большой. Максимум ${MAX_FILE_SIZE / (1024 * 1024)} МБ`
      );
    }
    return jsonError(res, 400, 'Bad Request', error.message);
  }

  if (error.code === 'UNSUPPORTED_FORMAT') {
    return jsonError(res, 400, 'Unsupported Format', error.message);
  }

  return jsonError(res, 400, 'Bad Request', error.message ?? 'Upload failed');
}

function handleProcessorError(error, res) {
  if (error instanceof WorkflowValidationError) {
    return jsonError(res, 400, error.code, error.message);
  }
  if (error instanceof WorkflowStepError) {
    return jsonError(res, 500, 'Workflow Step Error', error.message, { stepId: error.stepId });
  }
  if (error instanceof ExtractTextError) {
    return jsonError(res, 400, error.code, error.message);
  }
  if (error.message?.includes('обязательно') || error.message?.includes('не поддерживает')) {
    return jsonError(res, 400, 'Bad Request', error.message);
  }
  if (error.message?.includes('timeout')) {
    return jsonError(res, 504, 'Timeout', error.message);
  }
  return handleOpenAiError(error, res);
}

app.get('/api/health', (_req, res) => {
  jsonOk(res, {
    service: 'workflowgpt-api',
    engine: 'AI Workflow Engine 2.0',
    environment: NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured: isSupabaseConfigured(),
    corsOrigins: parseAllowedOrigins(),
    workflows: Object.values(WORKFLOW_IDS),
  });
});

app.post('/api/auth/telegram', async (req, res) => {
  try {
    if (!isUsersDbConfigured()) {
      return jsonError(res, 503, 'not_configured', 'Supabase is not configured on the server');
    }

    const payload = req.body ?? {};
    const user = await upsertUser(payload);
    const subscriptionInfo = await getSubscriptionForUser(user.id);
    return jsonOk(res, {
      user: { ...user, role: subscriptionInfo.effectivePlan },
      subscription: subscriptionInfo.subscription,
      effectivePlan: subscriptionInfo.effectivePlan,
      usage: subscriptionInfo.quota,
    });
  } catch (error) {
    console.error('[POST /api/auth/telegram]', error);
    const status = error.code === 'not_configured' ? 503 : 400;
    return jsonError(res, status, error.code ?? 'auth_error', error.message ?? 'Telegram auth failed');
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = parseUserIdHeader(req);
    if (!userId) {
      return jsonError(res, 401, 'Unauthorized', 'X-User-Id header is required');
    }

    const stats = await getUsageStats(userId);
    const subscriptionInfo = await getSubscriptionForUser(userId);
    const { user, monthly_usage_events, ...quota } = stats;
    return jsonOk(res, {
      user,
      usage: { ...quota, monthly_usage_events },
      subscription: subscriptionInfo.subscription,
      effectivePlan: subscriptionInfo.effectivePlan,
    });
  } catch (error) {
    console.error('[GET /api/auth/me]', error);
    const status = error.code === 'user_not_found' ? 404 : error.code === 'not_configured' ? 503 : 500;
    return jsonError(res, status, error.code ?? 'auth_error', error.message ?? 'Failed to load user');
  }
});

app.get('/api/subscription', requireUserId, async (req, res) => {
  try {
    const result = await getSubscriptionForUser(req.userId);
    return jsonOk(res, result);
  } catch (error) {
    console.error('[GET /api/subscription]', error);
    const status = error.code === 'user_not_found' ? 404 : error.code === 'not_configured' ? 503 : 500;
    return jsonError(res, status, error.code ?? 'subscription_error', error.message ?? 'Failed to load subscription');
  }
});

app.post('/api/subscription/change', requireUserId, async (req, res) => {
  console.log(
    `[AUDIT]\nroute=/api/subscription/change\nuserId=${req.userId}\nbody=${JSON.stringify(req.body ?? {})}`
  );
  try {
    const { plan, status, provider } = req.body ?? {};
    if (!plan || typeof plan !== 'string') {
      return jsonError(res, 400, 'Bad Request', 'Field "plan" is required (free, pro, owner)');
    }

    const current = await getSubscriptionForUser(req.userId);
    if (current.effectivePlan === 'owner') {
      return jsonError(res, 403, 'forbidden', 'Owner plan cannot be changed');
    }
    if (plan === 'owner') {
      return jsonError(res, 403, 'forbidden', 'Cannot upgrade to owner plan');
    }

    // Self-service plan changes must go through billing (except downgrade to free via support/admin)
    if (plan === 'pro') {
      return jsonError(
        res,
        400,
        'billing_required',
        'Use POST /api/billing/checkout to upgrade. Payment is required before plan activation.'
      );
    }

    const result = await changeSubscription(req.userId, { plan, status, provider, source: 'direct' });
    return jsonOk(res, result);
  } catch (error) {
    console.error('[POST /api/subscription/change]', error);
    const status =
      error.code === 'user_not_found'
        ? 404
        : error.code === 'invalid_plan' || error.code === 'billing_required'
          ? 400
          : error.code === 'not_configured'
            ? 503
            : 500;
    return jsonError(res, status, error.code ?? 'subscription_error', error.message ?? 'Failed to change subscription');
  }
});

app.post('/api/billing/checkout', requireUserId, async (req, res) => {
  console.log(
    `[AUDIT]\nroute=/api/billing/checkout\nuserId=${req.userId}\nbody=${JSON.stringify(req.body ?? {})}`
  );
  try {
    const { plan, provider } = req.body ?? {};
    if (!plan || typeof plan !== 'string') {
      return jsonError(res, 400, 'Bad Request', 'Field "plan" is required');
    }

    const transaction = await createTransaction(req.userId, { plan, provider });
    console.info('[POST /api/billing/checkout] pending transaction', {
      userId: req.userId,
      transactionId: transaction.id,
      plan: transaction.plan,
      status: transaction.status,
    });
    return jsonOk(res, { transaction });
  } catch (error) {
    console.error('[POST /api/billing/checkout]', error);
    const status =
      error.code === 'user_not_found'
        ? 404
        : error.code === 'invalid_plan'
          ? 400
          : error.code === 'already_subscribed'
            ? 409
            : error.code === 'forbidden'
              ? 403
              : error.code === 'not_configured'
                ? 503
                : 500;
    return jsonError(res, status, error.code ?? 'billing_error', error.message ?? 'Failed to create transaction');
  }
});

app.post('/api/billing/pay', requireUserId, async (req, res) => {
  console.log(
    `[AUDIT]\nroute=/api/billing/pay\nuserId=${req.userId}\nbody=${JSON.stringify(req.body ?? {})}`
  );
  try {
    const { transactionId } = req.body ?? {};
    if (!transactionId || typeof transactionId !== 'string') {
      return jsonError(res, 400, 'Bad Request', 'Field "transactionId" is required');
    }

    const result = await processFakePayment(req.userId, transactionId);
    return jsonOk(res, {
      transaction: result.transaction,
      user: result.subscription.user,
      subscription: result.subscription.subscription,
      effectivePlan: result.subscription.effectivePlan,
      quota: result.subscription.quota,
    });
  } catch (error) {
    console.error('[POST /api/billing/pay]', error);
    const status =
      error.code === 'transaction_not_found'
        ? 404
        : error.code === 'forbidden'
          ? 403
          : error.code === 'invalid_status'
            ? 400
            : error.code === 'not_configured'
              ? 503
              : 500;
    return jsonError(res, status, error.code ?? 'billing_error', error.message ?? 'Payment failed');
  }
});

app.get('/api/billing/history', requireUserId, async (req, res) => {
  try {
    const transactions = await getUserTransactions(req.userId);
    return jsonOk(res, { transactions });
  } catch (error) {
    console.error('[GET /api/billing/history]', error);
    const status = error.code === 'not_configured' ? 503 : 500;
    return jsonError(res, status, error.code ?? 'billing_error', error.message ?? 'Failed to load billing history');
  }
});

app.get('/api/billing/summary', requireUserId, async (req, res) => {
  try {
    const summary = await getUserBillingSummary(req.userId);
    return jsonOk(res, summary);
  } catch (error) {
    console.error('[GET /api/billing/summary]', error);
    const status =
      error.code === 'user_not_found'
        ? 404
        : error.code === 'not_configured'
          ? 503
          : 500;
    return jsonError(res, status, error.code ?? 'billing_error', error.message ?? 'Failed to load billing summary');
  }
});

app.get('/api/admin/billing/stats', requireOwner, async (_req, res) => {
  try {
    const stats = await getBillingStats();
    return jsonOk(res, stats);
  } catch (error) {
    console.error('[GET /api/admin/billing/stats]', error);
    const status = error.code === 'not_configured' ? 503 : 500;
    return jsonError(res, status, error.code ?? 'billing_error', error.message ?? 'Failed to load billing stats');
  }
});

app.get('/api/admin/billing/transactions', requireOwner, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
    const transactions = await listAllTransactions({ status, limit: 200 });
    return jsonOk(res, { transactions });
  } catch (error) {
    console.error('[GET /api/admin/billing/transactions]', error);
    const status = error.code === 'not_configured' ? 503 : 500;
    return jsonError(res, status, error.code ?? 'billing_error', error.message ?? 'Failed to load transactions');
  }
});

app.get('/api/admin/users', requireOwner, async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const plan = typeof req.query.plan === 'string' ? req.query.plan : '';
    const users = await listAdminUsers({ query, plan });
    return jsonOk(res, { users });
  } catch (error) {
    console.error('[GET /api/admin/users]', error);
    const status = error.code === 'not_configured' ? 503 : 500;
    return jsonError(res, status, error.code ?? 'admin_error', error.message ?? 'Failed to load users');
  }
});

app.get('/api/admin/users/:userId/history', requireOwner, async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await getUserAdminHistory(userId, { limit: 20 });
    return jsonOk(res, { history });
  } catch (error) {
    console.error('[GET /api/admin/users/:userId/history]', error);
    const status =
      error.code === 'user_not_found'
        ? 404
        : error.code === 'not_configured'
          ? 503
          : 500;
    return jsonError(res, status, error.code ?? 'admin_error', error.message ?? 'Failed to load user history');
  }
});

app.get('/api/admin/users/:userId/billing', requireOwner, async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await getUserAdminBilling(userId, { limit: 20 });
    return jsonOk(res, { transactions });
  } catch (error) {
    console.error('[GET /api/admin/users/:userId/billing]', error);
    const status =
      error.code === 'user_not_found'
        ? 404
        : error.code === 'not_configured'
          ? 503
          : 500;
    return jsonError(res, status, error.code ?? 'admin_error', error.message ?? 'Failed to load user billing');
  }
});

app.get('/api/admin/pro-requests', requireOwner, async (_req, res) => {
  try {
    const requests = await listProRequests();
    return jsonOk(res, { requests });
  } catch (error) {
    console.error('[GET /api/admin/pro-requests]', error);
    const status = error.code === 'not_configured' ? 503 : 500;
    return jsonError(res, status, error.code ?? 'admin_error', error.message ?? 'Failed to load pro requests');
  }
});

app.post('/api/admin/billing/transactions/:transactionId/cancel', requireOwner, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await cancelTransaction(transactionId);
    return jsonOk(res, { transaction });
  } catch (error) {
    console.error('[POST /api/admin/billing/transactions/:transactionId/cancel]', error);
    const status =
      error.code === 'transaction_not_found'
        ? 404
        : error.code === 'invalid_status'
          ? 400
          : error.code === 'not_configured'
            ? 503
            : 500;
    return jsonError(res, status, error.code ?? 'billing_error', error.message ?? 'Failed to cancel transaction');
  }
});

app.get('/api/admin/stats', requireOwner, async (_req, res) => {
  try {
    const stats = await getAdminStats();
    return jsonOk(res, stats);
  } catch (error) {
    console.error('[GET /api/admin/stats]', error);
    const status = error.code === 'not_configured' ? 503 : 500;
    return jsonError(res, status, error.code ?? 'admin_error', error.message ?? 'Failed to load stats');
  }
});

app.post('/api/admin/subscription/change', requireOwner, async (req, res) => {
  try {
    const { userId, plan, status, provider } = req.body ?? {};
    if (!userId || typeof userId !== 'string') {
      return jsonError(res, 400, 'Bad Request', 'Field "userId" is required');
    }
    if (!plan || typeof plan !== 'string') {
      return jsonError(res, 400, 'Bad Request', 'Field "plan" is required (free, pro, owner)');
    }

    const result = await changeSubscription(userId, { plan, status, provider, source: 'admin' });
    return jsonOk(res, result);
  } catch (error) {
    console.error('[POST /api/admin/subscription/change]', error);
    const status =
      error.code === 'user_not_found'
        ? 404
        : error.code === 'invalid_plan'
          ? 400
          : error.code === 'not_configured'
            ? 503
            : 500;
    return jsonError(res, status, error.code ?? 'admin_error', error.message ?? 'Failed to change subscription');
  }
});

app.get('/api/database/health', async (_req, res) => {
  try {
    const health = await checkSupabaseHealth();
    if (health.ok) {
      return res.json({ status: 'ok' });
    }
    return res.status(503).json({
      status: 'unavailable',
      message: health.reason ?? 'Supabase unreachable',
    });
  } catch (error) {
    console.error('[GET /api/database/health]', error);
    return res.status(503).json({
      status: 'unavailable',
      message: error.message ?? 'Database health check failed',
    });
  }
});

app.get('/api/history', requireUserId, async (req, res) => {
  try {
    const result = await listWorkflowHistory(req.userId);
    if (result.skipped) {
      return jsonOk(res, { items: [], skipped: true, message: result.reason });
    }
    if (!result.ok) {
      return jsonError(res, 503, 'Database Error', result.error ?? 'Failed to load history', {
        items: [],
      });
    }
    return jsonOk(res, { items: result.items });
  } catch (error) {
    console.error('[GET /api/history]', error);
    return jsonError(res, 500, 'Database Error', error.message ?? 'Failed to load history', { items: [] });
  }
});

app.post('/api/history', requireUserId, async (req, res) => {
  try {
    const item = req.body?.item;
    if (!item || typeof item.id !== 'string' || typeof item.workflowType !== 'string') {
      return jsonError(res, 400, 'Bad Request', 'Field "item" with id and workflowType is required');
    }

    const user = await getUserById(req.userId);
    if (!user) {
      return jsonError(res, 404, 'user_not_found', 'User not found');
    }

    const result = await insertWorkflowHistory(item, req.userId);
    if (result.skipped) {
      return jsonOk(res, { saved: false, skipped: true, message: result.reason });
    }
    if (!result.ok) {
      return jsonError(res, 503, 'Database Error', result.error ?? 'Failed to save history');
    }

    let updatedUser = user;
    try {
      updatedUser = await incrementUsage(req.userId, item.workflowType);
    } catch (usageError) {
      console.error('[POST /api/history] usage increment failed', usageError);
    }

    return jsonOk(res, { saved: true, id: result.id, user: updatedUser });
  } catch (error) {
    console.error('[POST /api/history]', error);
    return jsonError(res, 500, 'Database Error', error.message ?? 'Failed to save history');
  }
});

app.delete('/api/history/:id', requireUserId, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return jsonError(res, 400, 'Bad Request', 'History id is required');
    }

    const result = await deleteWorkflowHistoryById(id, req.userId);
    if (result.skipped) {
      return jsonOk(res, { deleted: false, skipped: true, message: result.reason });
    }
    if (!result.ok) {
      return jsonError(res, 503, 'Database Error', result.error ?? 'Failed to delete history item');
    }
    return jsonOk(res, { deleted: result.deleted });
  } catch (error) {
    console.error('[DELETE /api/history/:id]', error);
    return jsonError(res, 500, 'Database Error', error.message ?? 'Failed to delete history item');
  }
});

app.delete('/api/history', requireUserId, async (req, res) => {
  try {
    const result = await clearWorkflowHistory(req.userId);
    if (result.skipped) {
      return jsonOk(res, { cleared: false, skipped: true, message: result.reason });
    }
    if (!result.ok) {
      return jsonError(res, 503, 'Database Error', result.error ?? 'Failed to clear history');
    }
    return jsonOk(res, { cleared: true });
  } catch (error) {
    console.error('[DELETE /api/history]', error);
    return jsonError(res, 500, 'Database Error', error.message ?? 'Failed to clear history');
  }
});

app.get('/api/workflows', (_req, res) => {
  jsonOk(res, { workflows: listWorkflowMetadata(), engineVersion: '2.0' });
});

app.get('/', (_req, res) => {
  jsonOk(res, {
    service: 'workflowgpt-api',
    health: '/api/health',
    docs: 'POST /api/test-ai, POST /api/workflow/upload',
  });
});

app.post('/api/test-ai', enforceRunLimit, async (req, res) => {
  try {
    const { message, workflow, metadata } = req.body ?? {};

    if (!workflow || typeof workflow !== 'string') {
      return jsonError(res, 400, 'Bad Request', 'Field "workflow" is required');
    }

    let normalized;
    try {
      normalized = requireWorkflow(workflow);
    } catch (e) {
      return handleProcessorError(e, res);
    }

    const pipeline = await processTextRequest({
      workflow: normalized,
      message: typeof message === 'string' ? message : '',
      metadata,
    });

    return jsonOk(res, {
      reply: pipeline.reply,
      report: pipeline.report,
      result: pipeline.result,
      workflow: pipeline.workflow,
      workflowSlug: pipeline.workflowSlug,
      steps: pipeline.steps,
      stepIds: pipeline.stepIds,
      sections: pipeline.sections,
      progress: pipeline.progress,
      metadata: pipeline.metadata,
      engineVersion: pipeline.engineVersion,
    });
  } catch (error) {
    console.error('[POST /api/test-ai]', error);
    return handleProcessorError(error, res);
  }
});

app.post('/api/export/notion', async (req, res) => {
  try {
    const {
      notionApiKey,
      databaseId,
      title,
      report,
      workflowType,
      workflow,
      subject,
      createdAt,
      result,
    } = req.body ?? {};

    if (!report || typeof report !== 'string' || !report.trim()) {
      return jsonError(res, 400, 'Bad Request', 'Field "report" is required');
    }

    const page = await exportToNotion({
      notionApiKey,
      databaseId,
      title: title ?? `WorkflowGPT — ${workflow ?? workflowType ?? 'Report'}`,
      report,
      workflowType: workflowType ?? workflow ?? 'workflow',
      subject,
      createdAt,
      result,
    });

    return jsonOk(res, {
      pageId: page.pageId,
      url: page.url,
      message: 'Exported successfully',
    });
  } catch (error) {
    if (error instanceof NotionExportError) {
      const status =
        error.status ??
        (error.code === 'invalid_token' ? 401 : error.code === 'invalid_database' ? 404 : 500);
      return jsonError(res, status, error.code, error.message, { code: error.code });
    }
    console.error('[POST /api/export/notion]', error);
    return jsonError(res, 500, 'Notion Export Error', error.message ?? 'Export failed');
  }
});

app.post('/api/export/bitrix/validate', async (req, res) => {
  try {
    const { domain, webhookUrl } = req.body ?? {};
    const result = await validateBitrixWebhook({ domain, webhookUrl });
    return jsonOk(res, {
      message: 'Bitrix24 connection successful',
      domain: result.domain,
      userName: result.userName,
    });
  } catch (error) {
    if (error instanceof BitrixExportError) {
      const status =
        error.status ??
        (error.code === 'invalid_webhook' ? 401 : error.code === 'invalid_domain' ? 400 : 500);
      return jsonError(res, status, error.code, error.message, { code: error.code });
    }
    console.error('[POST /api/export/bitrix/validate]', error);
    return jsonError(res, 500, 'Bitrix Export Error', error.message ?? 'Validation failed');
  }
});

app.post('/api/export/bitrix', async (req, res) => {
  try {
    const {
      domain,
      webhookUrl,
      mode,
      title,
      description,
      workflowType,
      workflow,
      companyName,
      report,
      recommendations,
      createdAt,
    } = req.body ?? {};

    if (!report || typeof report !== 'string' || !report.trim()) {
      return jsonError(res, 400, 'Bad Request', 'Field "report" is required', { code: 'empty_report' });
    }

    const bodyDescription =
      typeof description === 'string' && description.trim()
        ? description.trim()
        : report.trim();

    const entity = await exportToBitrix({
      domain,
      webhookUrl,
      mode: mode === 'deal' ? 'deal' : 'lead',
      title: title ?? `WorkflowGPT — ${workflow ?? workflowType ?? 'Report'}`,
      description: bodyDescription,
    });

    return jsonOk(res, {
      entityId: entity.entityId,
      entityType: entity.entityType,
      url: entity.url,
      message: 'Exported successfully',
      workflowType,
      companyName,
      recommendations,
      createdAt,
    });
  } catch (error) {
    if (error instanceof BitrixExportError) {
      const status =
        error.status ??
        (error.code === 'invalid_webhook' ? 401 : error.code === 'invalid_domain' ? 400 : 500);
      return jsonError(res, status, error.code, error.message, { code: error.code });
    }
    console.error('[POST /api/export/bitrix]', error);
    return jsonError(res, 500, 'Bitrix Export Error', error.message ?? 'Export failed');
  }
});

app.post('/api/export/bitrix/tasks', async (req, res) => {
  try {
    const { domain, webhookUrl, recommendations, description } = req.body ?? {};

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return jsonError(res, 400, 'Bad Request', 'Field "recommendations" is required', {
        code: 'no_recommendations',
      });
    }

    const result = await createBitrixTasks({
      domain,
      webhookUrl,
      recommendations,
      description,
    });

    return jsonOk(res, {
      taskIds: result.taskIds,
      count: result.count,
      message: `${result.count} tasks successfully created in Bitrix24`,
    });
  } catch (error) {
    if (error instanceof BitrixExportError) {
      const status =
        error.status ??
        (error.code === 'invalid_webhook'
          ? 401
          : error.code === 'invalid_domain' || error.code === 'no_recommendations'
            ? 400
            : 500);
      return jsonError(res, status, error.code, error.message, { code: error.code });
    }
    console.error('[POST /api/export/bitrix/tasks]', error);
    return jsonError(res, 500, 'Bitrix Export Error', error.message ?? 'Task creation failed');
  }
});

app.post('/api/export/:format', async (req, res) => {
  try {
    const format = req.params.format?.toLowerCase();
    if (format === 'notion') {
      return jsonError(res, 400, 'Bad Request', 'Use POST /api/export/notion');
    }
    if (format === 'bitrix') {
      return jsonError(res, 400, 'Bad Request', 'Use POST /api/export/bitrix');
    }
    if (format !== 'pdf' && format !== 'docx') {
      return jsonError(res, 400, 'Bad Request', 'Use pdf or docx');
    }

    const { workflow, result, sections } = req.body ?? {};
    if (!workflow || !result) {
      return jsonError(res, 400, 'Bad Request', 'workflow and result required');
    }

    const buffer = await buildExport({ workflow, result, sections }, format);
    const filename = `workflowgpt-${Date.now()}.${format}`;
    const mime =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('[POST /api/export]', error);
    return jsonError(res, 500, 'Export Error', error.message);
  }
});

app.post('/api/workflow/upload', enforceRunLimit, (req, res) => {
  universalUpload.single('file')(req, res, async (uploadErr) => {
    if (NODE_ENV !== 'production') {
      console.log('[POST /api/workflow/upload] req.body:', req.body);
      console.log(
        '[POST /api/workflow/upload] req.file:',
        req.file
          ? { originalname: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype }
          : null
      );
    }

    if (uploadErr) {
      console.error('[POST /api/workflow/upload] multer:', uploadErr);
      return handleUploadMiddlewareError(uploadErr, res);
    }

    try {
      const rawWorkflow = req.body?.workflow;
      const workflow = resolveWorkflowForUpload(rawWorkflow);

      if (!workflow) {
        const hint = rawWorkflow
          ? `Invalid workflow for file upload: "${rawWorkflow}". Use: legal, competitors, analytics, or Russian workflow names.`
          : 'Field "workflow" is required in FormData (e.g. formData.append("workflow", selectedWorkflow)).';
        return jsonError(res, 400, 'Bad Request', hint);
      }

      if (!req.file) {
        return jsonError(res, 400, 'Bad Request', 'Файл не передан. Поле формы: file');
      }

      const note = typeof req.body?.message === 'string' ? req.body.message : req.body?.note ?? '';
      const metadata = req.body?.metadata;

      const pipeline = await processFileUpload({
        workflow,
        file: req.file,
        note,
        metadata,
      });

      return jsonOk(res, {
        reply: pipeline.reply,
        report: pipeline.report,
        result: pipeline.result,
        workflow: pipeline.workflow,
        workflowSlug: pipeline.workflowSlug,
        steps: pipeline.steps,
        stepIds: pipeline.stepIds,
        sections: pipeline.sections,
        progress: pipeline.progress,
        metadata: pipeline.metadata,
        engineVersion: pipeline.engineVersion,
        filename: req.file.originalname,
      });
    } catch (error) {
      console.error('[POST /api/workflow/upload]', error);
      return handleProcessorError(error, res);
    }
  });
});

app.post('/api/upload-contract', (req, res) => {
  universalUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return handleUploadMiddlewareError(uploadErr, res);

    try {
      const workflow =
        resolveWorkflowForUpload(req.body?.workflow) ||
        resolveWorkflowForUpload('legal') ||
        WORKFLOW_IDS.CONTRACT;

      if (!req.file) {
        return jsonError(res, 400, 'Bad Request', 'Файл не передан');
      }

      const note = typeof req.body?.note === 'string' ? req.body.note : req.body?.message ?? '';
      const pipeline = await processFileUpload({
        workflow,
        file: req.file,
        note,
      });

      return jsonOk(res, {
        reply: pipeline.reply,
        report: pipeline.report,
        result: pipeline.result,
        workflow: pipeline.workflow,
        workflowSlug: pipeline.workflowSlug,
        steps: pipeline.steps,
        stepIds: pipeline.stepIds,
        sections: pipeline.sections,
        progress: pipeline.progress,
        metadata: pipeline.metadata,
        engineVersion: pipeline.engineVersion,
        filename: req.file.originalname,
      });
    } catch (error) {
      console.error('[POST /api/upload-contract]', error);
      return handleProcessorError(error, res);
    }
  });
});

app.use((_req, res) => {
  jsonError(res, 404, 'Not Found', 'Route not found');
});

app.use((err, _req, res, _next) => {
  console.error('[Unhandled]', err);
  jsonError(res, 500, 'Internal Server Error', 'Unexpected server error');
});

app.listen(PORT, HOST, () => {
  console.log(`WorkflowGPT API listening on http://${HOST}:${PORT} (${NODE_ENV})`);
  console.log(`CORS origins: ${parseAllowedOrigins().join(', ')}`);
});
