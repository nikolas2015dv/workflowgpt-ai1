import type { WorkflowRunResult } from '../types/workflowResult';
import { apiUrl, mapFetchError } from './api';
import { buildCopyText } from './formatResult';
import { buildHistoryTitle } from './historySubject';
import { formatWorkflowTypeLabel } from '../services/historyService';
import { logError, logMobile } from './mobileDebug';
import type { BitrixCredentials } from './bitrixStorage';

export type BitrixExportMode = 'lead' | 'deal';

export type BitrixExportErrorCode =
  | 'invalid_webhook'
  | 'invalid_domain'
  | 'network'
  | 'bitrix_api'
  | 'unknown'
  | 'config'
  | 'backend'
  | 'empty_report'
  | 'no_recommendations';

export class BitrixExportError extends Error {
  constructor(
    message: string,
    public readonly code: BitrixExportErrorCode = 'unknown',
    public readonly status?: number
  ) {
    super(message);
    this.name = 'BitrixExportError';
  }
}

function mapBitrixApiError(data: {
  message?: string;
  error?: string;
  code?: string;
}): BitrixExportError {
  const code = (data.code ?? data.error ?? 'unknown') as BitrixExportErrorCode;
  const message = data.message ?? 'Не удалось выполнить операцию в Bitrix24';

  if (code === 'invalid_webhook') {
    return new BitrixExportError('Неверный Incoming Webhook URL или нет доступа к CRM.', 'invalid_webhook', 401);
  }
  if (code === 'invalid_domain') {
    return new BitrixExportError('Неверный домен Bitrix24.', 'invalid_domain', 400);
  }
  if (code === 'network') {
    return new BitrixExportError('Сеть недоступна. Повторите позже.', 'network', 503);
  }
  if (code === 'empty_report') {
    return new BitrixExportError('Нет данных отчёта для экспорта.', 'empty_report', 400);
  }
  if (code === 'no_recommendations') {
    return new BitrixExportError('В результатах нет рекомендаций для создания задач.', 'no_recommendations', 400);
  }

  return new BitrixExportError(message, code);
}

export function normalizeBitrixDomain(raw: string): string {
  let value = raw.trim();
  if (!value) return '';

  value = value.replace(/^https?:\/\//i, '');
  value = value.replace(/\/.*$/, '');
  return value.toLowerCase();
}

export function normalizeBitrixWebhookUrl(raw: string, domain?: string): string {
  let value = raw.trim();
  if (!value) return '';

  if (!/^https?:\/\//i.test(value)) {
    const host = normalizeBitrixDomain(domain ?? value);
    value = host ? `https://${host}/${value.replace(/^\//, '')}` : `https://${value}`;
  }

  if (!value.endsWith('/')) {
    value += '/';
  }

  return value;
}

export function buildBitrixReport(run: WorkflowRunResult): string {
  const resultRecord = run.result as Record<string, unknown>;
  if (run.report?.trim()) return run.report.trim();
  if (run.reply?.trim()) return run.reply.trim();
  return buildCopyText(run.workflow, resultRecord, run.sections, '');
}

function extractCompanyName(subject?: string): string {
  if (!subject?.trim()) return '—';
  return subject.replace(/^(Конкурент|Договор|Файл|Данные):\s*/, '').trim() || subject.trim();
}

export const BITRIX_TASK_DESCRIPTION =
  'Generated automatically by WorkflowGPT based on workflow analysis.';

function extractRecommendations(result: Record<string, unknown>): string[] {
  const rec = result.recommendations;
  if (Array.isArray(rec)) {
    return rec.map((item) => String(item)).filter((item) => item.trim().length > 0);
  }
  return [];
}

export function extractWorkflowRecommendations(run: WorkflowRunResult): string[] {
  return extractRecommendations(run.result as Record<string, unknown>);
}

export function buildBitrixEntityTitle(run: WorkflowRunResult, subject?: string): string {
  const workflowType = run.workflowSlug ?? run.workflow;
  const workflowTitle = subject?.trim()
    ? buildHistoryTitle(workflowType, subject)
    : formatWorkflowTypeLabel(workflowType);
  return `WorkflowGPT - ${workflowTitle}`;
}

export interface BitrixExportPayload {
  title: string;
  description: string;
  workflowType: string;
  workflow: string;
  companyName: string;
  report: string;
  recommendations: string[];
  createdAt: number;
}

export function buildBitrixExportPayload(
  run: WorkflowRunResult,
  options: { subject?: string; createdAt?: number } = {}
): BitrixExportPayload {
  const resultRecord = run.result as Record<string, unknown>;
  const report = buildBitrixReport(run);
  if (!report.trim()) {
    throw new BitrixExportError('Нет данных отчёта для экспорта', 'empty_report');
  }

  const workflowType = run.workflowSlug ?? run.workflow;
  const subject = options.subject?.trim() ?? '';
  const companyName = extractCompanyName(subject);
  const recommendations = extractRecommendations(resultRecord);
  const createdAt = options.createdAt ?? Date.now();

  const createdLabel = new Date(createdAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = [
    `Тип workflow: ${formatWorkflowTypeLabel(workflowType)}`,
    `Компания / объект: ${companyName}`,
    `Дата создания: ${createdLabel}`,
    '',
    '--- Рекомендации ---',
    recommendations.length > 0 ? recommendations.map((r) => `• ${r}`).join('\n') : '—',
    '',
    '--- Отчёт ---',
    report,
  ];

  return {
    title: buildBitrixEntityTitle(run, subject || undefined),
    description: lines.join('\n').trim(),
    workflowType,
    workflow: run.workflow,
    companyName,
    report,
    recommendations,
    createdAt,
  };
}

export interface BitrixValidationResult {
  ok: boolean;
  userName?: string;
  domain?: string;
}

export interface BitrixExportResult {
  entityId: number;
  entityType: BitrixExportMode;
  url: string | null;
}

export async function validateBitrixConnection(
  credentials: BitrixCredentials
): Promise<BitrixValidationResult> {
  const domain = normalizeBitrixDomain(credentials.domain);
  const webhookUrl = normalizeBitrixWebhookUrl(credentials.webhookUrl, domain);

  if (!domain) {
    throw new BitrixExportError('Укажите домен Bitrix24 (например, company.bitrix24.com).', 'invalid_domain');
  }
  if (!webhookUrl || !webhookUrl.includes('/rest/')) {
    throw new BitrixExportError(
      'Укажите полный Incoming Webhook URL (https://company.bitrix24.com/rest/1/.../).',
      'invalid_webhook'
    );
  }

  logMobile('bitrix validate start', domain);

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/export/bitrix/validate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ domain, webhookUrl }),
    });
  } catch (e) {
    const mapped = mapFetchError(e);
    if (mapped.code === 'network' || mapped.code === 'config') {
      throw new BitrixExportError(mapped.message, mapped.code, mapped.status);
    }
    logError('bitrix-validate-fetch', e);
    throw new BitrixExportError(mapped.message, 'network');
  }

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
    code?: string;
    userName?: string;
    domain?: string;
  };

  if (!response.ok) {
    throw mapBitrixApiError(data);
  }

  logMobile('bitrix validate success', domain);

  return {
    ok: true,
    userName: data.userName,
    domain: data.domain ?? domain,
  };
}

export interface BitrixExportOptions {
  subject?: string;
  createdAt?: number;
  mode: BitrixExportMode;
}

export async function exportReportToBitrix(
  run: WorkflowRunResult,
  credentials: BitrixCredentials,
  options: BitrixExportOptions
): Promise<BitrixExportResult> {
  const domain = normalizeBitrixDomain(credentials.domain);
  const webhookUrl = normalizeBitrixWebhookUrl(credentials.webhookUrl, domain);
  const payload = buildBitrixExportPayload(run, {
    subject: options.subject,
    createdAt: options.createdAt,
  });

  logMobile('bitrix export start', options.mode);

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/export/bitrix'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        domain,
        webhookUrl,
        mode: options.mode,
        title: payload.title,
        description: payload.description,
        workflowType: payload.workflowType,
        workflow: payload.workflow,
        companyName: payload.companyName,
        report: payload.report,
        recommendations: payload.recommendations,
        createdAt: payload.createdAt,
      }),
    });
  } catch (e) {
    const mapped = mapFetchError(e);
    if (mapped.code === 'network' || mapped.code === 'config') {
      throw new BitrixExportError(mapped.message, mapped.code, mapped.status);
    }
    logError('bitrix-export-fetch', e);
    throw new BitrixExportError(mapped.message, 'network');
  }

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
    code?: string;
    entityId?: number;
    entityType?: BitrixExportMode;
    url?: string | null;
  };

  if (!response.ok) {
    throw mapBitrixApiError(data);
  }

  if (typeof data.entityId !== 'number') {
    throw new BitrixExportError(data.message ?? 'Bitrix24 не вернул ID сущности', 'bitrix_api');
  }

  logMobile('bitrix export success', data.entityId);

  return {
    entityId: data.entityId,
    entityType: data.entityType ?? options.mode,
    url: data.url ?? null,
  };
}

export interface BitrixTasksResult {
  taskIds: number[];
  count: number;
}

export async function createBitrixTasksFromRecommendations(
  run: WorkflowRunResult,
  credentials: BitrixCredentials
): Promise<BitrixTasksResult> {
  const domain = normalizeBitrixDomain(credentials.domain);
  const webhookUrl = normalizeBitrixWebhookUrl(credentials.webhookUrl, domain);
  const recommendations = extractWorkflowRecommendations(run);

  if (recommendations.length === 0) {
    throw new BitrixExportError(
      'В результатах нет рекомендаций для создания задач.',
      'no_recommendations'
    );
  }

  logMobile('bitrix tasks start', recommendations.length);

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/export/bitrix/tasks'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        domain,
        webhookUrl,
        recommendations,
        description: BITRIX_TASK_DESCRIPTION,
      }),
    });
  } catch (e) {
    const mapped = mapFetchError(e);
    if (mapped.code === 'network' || mapped.code === 'config') {
      throw new BitrixExportError(mapped.message, mapped.code, mapped.status);
    }
    logError('bitrix-tasks-fetch', e);
    throw new BitrixExportError(mapped.message, 'network');
  }

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
    code?: string;
    taskIds?: number[];
    count?: number;
  };

  if (!response.ok) {
    throw mapBitrixApiError(data);
  }

  const count = typeof data.count === 'number' ? data.count : data.taskIds?.length ?? 0;
  if (count === 0) {
    throw new BitrixExportError(data.message ?? 'Bitrix24 не создал задачи', 'bitrix_api');
  }

  logMobile('bitrix tasks success', count);

  return {
    taskIds: data.taskIds ?? [],
    count,
  };
}
