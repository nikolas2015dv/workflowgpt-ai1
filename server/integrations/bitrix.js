const BITRIX_FETCH_TIMEOUT_MS = 30_000;

class BitrixExportError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'BitrixExportError';
    this.code = code;
    this.status = status;
  }
}

function normalizeDomain(raw) {
  let value = String(raw ?? '').trim();
  if (!value) return '';

  value = value.replace(/^https?:\/\//i, '');
  value = value.replace(/\/.*$/, '');
  return value.toLowerCase();
}

function normalizeWebhookUrl(raw, domain) {
  let value = String(raw ?? '').trim();
  if (!value) return '';

  if (!/^https?:\/\//i.test(value)) {
    const host = normalizeDomain(domain ?? value);
    value = host ? `https://${host}/${value.replace(/^\//, '')}` : `https://${value}`;
  }

  if (!value.endsWith('/')) {
    value += '/';
  }

  return value;
}

function buildEntityUrl(domain, entityType, entityId) {
  const host = normalizeDomain(domain);
  if (!host || !entityId) return null;
  const path = entityType === 'deal' ? 'crm/deal/details' : 'crm/lead/details';
  return `https://${host}/${path}/${entityId}/`;
}

async function callBitrix(webhookUrl, method, params = {}) {
  const base = normalizeWebhookUrl(webhookUrl);
  if (!base || !base.includes('/rest/')) {
    throw new BitrixExportError('invalid_webhook', 'Invalid Bitrix24 webhook URL', 400);
  }

  const url = `${base}${method.replace(/^\//, '')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BITRIX_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new BitrixExportError(
        'bitrix_api',
        data.error_description ?? data.error ?? `Bitrix24 HTTP ${response.status}`,
        response.status
      );
    }

    if (data.error) {
      const message = data.error_description ?? data.error ?? 'Bitrix24 API error';
      const code =
        data.error === 'INVALID_CREDENTIALS' || data.error === 'ERROR_METHOD_NOT_FOUND'
          ? 'invalid_webhook'
          : 'bitrix_api';
      throw new BitrixExportError(code, message, 400);
    }

    return data.result;
  } catch (error) {
    if (error instanceof BitrixExportError) throw error;
    if (error?.name === 'AbortError') {
      throw new BitrixExportError('network', 'Bitrix24 request timed out', 504);
    }
    throw new BitrixExportError('network', error?.message ?? 'Failed to reach Bitrix24', 503);
  } finally {
    clearTimeout(timeout);
  }
}

function truncateDescription(text, max = 65000) {
  const value = String(text ?? '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 40)}\n\n[… отчёт обрезан из-за лимита Bitrix24]`;
}

function mapBitrixError(error) {
  if (error instanceof BitrixExportError) return error;
  return new BitrixExportError('unknown', error?.message ?? 'Bitrix export failed', 500);
}

/**
 * @param {{ domain: string; webhookUrl: string }} params
 */
async function validateBitrixWebhook({ domain, webhookUrl }) {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedWebhook = normalizeWebhookUrl(webhookUrl, normalizedDomain);

  if (!normalizedDomain) {
    throw new BitrixExportError('invalid_domain', 'Bitrix24 domain is required', 400);
  }
  if (!normalizedWebhook.includes('/rest/')) {
    throw new BitrixExportError(
      'invalid_webhook',
      'Webhook URL must look like https://company.bitrix24.com/rest/1/.../',
      400
    );
  }

  const profile = await callBitrix(normalizedWebhook, 'profile');
  const userName = [profile?.NAME, profile?.LAST_NAME].filter(Boolean).join(' ').trim();

  return {
    domain: normalizedDomain,
    userName: userName || profile?.LOGIN || undefined,
  };
}

/**
 * @param {{
 *   domain: string;
 *   webhookUrl: string;
 *   mode: 'lead' | 'deal';
 *   title: string;
 *   description: string;
 * }} params
 */
async function exportToBitrix({
  domain,
  webhookUrl,
  mode,
  title,
  description,
}) {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedWebhook = normalizeWebhookUrl(webhookUrl, normalizedDomain);
  const entityType = mode === 'deal' ? 'deal' : 'lead';
  const method = entityType === 'deal' ? 'crm.deal.add' : 'crm.lead.add';

  if (!title?.trim()) {
    throw new BitrixExportError('unknown', 'Title is required', 400);
  }
  if (!description?.trim()) {
    throw new BitrixExportError('empty_report', 'Report description is required', 400);
  }

  const fields = {
    TITLE: String(title).trim(),
    COMMENTS: truncateDescription(description),
    SOURCE_DESCRIPTION: 'WorkflowGPT',
  };

  const entityId = await callBitrix(normalizedWebhook, method, { fields });

  if (typeof entityId !== 'number') {
    throw new BitrixExportError('bitrix_api', 'Bitrix24 did not return entity ID', 500);
  }

  return {
    entityId,
    entityType,
    url: buildEntityUrl(normalizedDomain, entityType, entityId),
  };
}

const TASK_DESCRIPTION =
  'Generated automatically by WorkflowGPT based on workflow analysis.';

function truncateTitle(text, max = 255) {
  const value = String(text ?? '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function parseTaskId(result) {
  if (result == null) return null;
  if (typeof result === 'number') return result;
  if (typeof result === 'string' && /^\d+$/.test(result)) return Number(result);
  if (typeof result === 'object') {
    const nested = result.task?.id ?? result.id;
    if (nested != null) return parseTaskId(nested);
  }
  return null;
}

/**
 * @param {{
 *   domain: string;
 *   webhookUrl: string;
 *   recommendations: string[];
 *   description?: string;
 * }} params
 */
async function createBitrixTasks({
  domain,
  webhookUrl,
  recommendations,
  description = TASK_DESCRIPTION,
}) {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedWebhook = normalizeWebhookUrl(webhookUrl, normalizedDomain);
  const items = (Array.isArray(recommendations) ? recommendations : [])
    .map((item) => String(item).trim())
    .filter(Boolean);

  if (items.length === 0) {
    throw new BitrixExportError('no_recommendations', 'No recommendations to create tasks from', 400);
  }

  const taskIds = [];
  const taskDescription = String(description ?? TASK_DESCRIPTION).trim() || TASK_DESCRIPTION;

  for (const recommendation of items) {
    const result = await callBitrix(normalizedWebhook, 'tasks.task.add', {
      fields: {
        TITLE: truncateTitle(recommendation),
        DESCRIPTION: taskDescription,
      },
    });

    const taskId = parseTaskId(result);
    if (taskId == null) {
      throw new BitrixExportError('bitrix_api', 'Bitrix24 did not return task ID', 500);
    }
    taskIds.push(taskId);
  }

  return {
    taskIds,
    count: taskIds.length,
    domain: normalizedDomain,
  };
}

module.exports = {
  BitrixExportError,
  validateBitrixWebhook,
  exportToBitrix,
  createBitrixTasks,
  normalizeDomain,
  normalizeWebhookUrl,
  mapBitrixError,
  TASK_DESCRIPTION,
};
