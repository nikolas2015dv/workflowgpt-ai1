const { createClient } = require('@supabase/supabase-js');

const TABLE = 'workflow_history';
const MAX_HISTORY_ITEMS = 100;

let adminClient = null;

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function extractRecommendations(result) {
  const structured = result?.result ?? result;
  const rec = structured?.recommendations;
  if (!Array.isArray(rec)) return null;
  const items = rec.map((item) => String(item).trim()).filter(Boolean);
  return items.length > 0 ? JSON.stringify(items) : null;
}

function buildReportText(result) {
  if (typeof result?.report === 'string' && result.report.trim()) return result.report.trim();
  if (typeof result?.reply === 'string' && result.reply.trim()) return result.reply.trim();
  return null;
}

function buildSummary(report) {
  if (!report) return null;
  const line = report.split(/\r?\n/).find((l) => l.trim())?.trim() ?? report.trim();
  if (line.length <= 280) return line;
  return `${line.slice(0, 277)}…`;
}

function isWorkflowRunResult(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.workflow === 'string' &&
    typeof value.reply === 'string' &&
    Array.isArray(value.sections)
  );
}

function rowToHistoryItem(row) {
  const raw = row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {};
  const result = isWorkflowRunResult(raw.result)
    ? raw.result
    : isWorkflowRunResult(raw)
      ? raw
      : {
          workflow: row.workflow_type,
          workflowSlug: row.workflow_type,
          result: {},
          reply: row.report ?? '',
          report: row.report ?? undefined,
          sections: [],
        };

  return {
    id: row.id,
    workflowType: row.workflow_type,
    title: row.title,
    subject: row.subject ?? '',
    createdAt: new Date(row.created_at).getTime(),
    result,
    report: row.report ?? undefined,
  };
}

function historyItemToRow(item, userId) {
  const report = buildReportText(item.result);
  const row = {
    id: item.id,
    created_at: new Date(item.createdAt).toISOString(),
    workflow_type: item.workflowType,
    subject: item.subject ?? '',
    title: item.title,
    report,
    summary: buildSummary(report),
    recommendations: extractRecommendations(item.result),
    raw_data: { result: item.result },
  };
  if (userId) {
    row.user_id = userId;
  }
  return row;
}

async function checkSupabaseHealth() {
  const client = getSupabaseAdmin();
  if (!client) {
    return { ok: false, reason: 'not_configured' };
  }

  const { error } = await client.from(TABLE).select('id', { head: true, count: 'exact' });
  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

async function insertWorkflowHistory(item, userId) {
  const client = getSupabaseAdmin();
  if (!client) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  const row = historyItemToRow(item, userId);
  const { data, error } = await client.from(TABLE).upsert(row, { onConflict: 'id' }).select('id').single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id ?? row.id };
}

async function listWorkflowHistory(userId, limit = MAX_HISTORY_ITEMS) {
  const client = getSupabaseAdmin();
  if (!client) {
    return { ok: false, skipped: true, items: [], reason: 'not_configured' };
  }

  if (!userId) {
    return { ok: false, skipped: true, items: [], reason: 'user_required' };
  }

  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, items: [], error: error.message };
  }

  return {
    ok: true,
    items: (data ?? []).map(rowToHistoryItem),
  };
}

async function deleteWorkflowHistoryById(id, userId) {
  const client = getSupabaseAdmin();
  if (!client) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  if (!userId) {
    return { ok: false, skipped: true, reason: 'user_required' };
  }

  const { error, count } = await client
    .from(TABLE)
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, deleted: (count ?? 0) > 0 };
}

async function clearWorkflowHistory(userId) {
  const client = getSupabaseAdmin();
  if (!client) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  if (!userId) {
    return { ok: false, skipped: true, reason: 'user_required' };
  }

  const { error } = await client.from(TABLE).delete().eq('user_id', userId);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

module.exports = {
  TABLE,
  isSupabaseConfigured,
  getSupabaseAdmin,
  checkSupabaseHealth,
  insertWorkflowHistory,
  listWorkflowHistory,
  deleteWorkflowHistoryById,
  clearWorkflowHistory,
  rowToHistoryItem,
  historyItemToRow,
};
