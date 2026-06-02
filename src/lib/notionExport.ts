import type { WorkflowRunResult } from '../types/workflowResult';
import { apiUrl, mapFetchError } from './api';
import { buildCopyText } from './formatResult';
import { buildHistoryTitle } from '../lib/historySubject';
import { formatWorkflowTypeLabel } from '../services/historyService';
import { logError, logMobile } from './mobileDebug';
import type { NotionCredentials } from './notionStorage';

export type NotionExportErrorCode =
  | 'invalid_token'
  | 'invalid_database'
  | 'network'
  | 'notion_api'
  | 'unknown'
  | 'config'
  | 'backend';

export class NotionExportError extends Error {
  constructor(
    message: string,
    public readonly code: NotionExportErrorCode = 'unknown',
    public readonly status?: number
  ) {
    super(message);
    this.name = 'NotionExportError';
  }
}

function mapNotionApiError(data: {
  message?: string;
  error?: string;
  code?: string;
}): NotionExportError {
  const code = (data.code ?? data.error ?? 'unknown') as NotionExportErrorCode;
  const message = data.message ?? 'Не удалось экспортировать в Notion';

  if (code === 'invalid_token') {
    return new NotionExportError('Неверный Notion Integration Token.', 'invalid_token', 401);
  }
  if (code === 'invalid_database') {
    return new NotionExportError(
      'Неверный Database ID или нет доступа. Добавьте интеграцию в Connections базы.',
      'invalid_database',
      404
    );
  }
  if (code === 'network') {
    return new NotionExportError('Сеть недоступна. Повторите позже.', 'network', 503);
  }

  return new NotionExportError(message, code);
}

export function buildNotionReport(run: WorkflowRunResult): string {
  const resultRecord = run.result as Record<string, unknown>;
  if (run.report?.trim()) return run.report.trim();
  if (run.reply?.trim()) return run.reply.trim();
  return buildCopyText(run.workflow, resultRecord, run.sections, '');
}

export function buildNotionPageTitle(run: WorkflowRunResult, subject?: string): string {
  const workflowType = run.workflowSlug ?? run.workflow;
  if (subject?.trim()) {
    return buildHistoryTitle(workflowType, subject);
  }
  const date = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${formatWorkflowTypeLabel(workflowType)} — ${date}`;
}

export interface NotionExportResult {
  pageId: string;
  url: string | null;
}

export interface NotionExportOptions {
  subject?: string;
  createdAt?: number;
}

export async function exportReportToNotion(
  run: WorkflowRunResult,
  credentials: NotionCredentials,
  options: NotionExportOptions = {}
): Promise<NotionExportResult> {
  const report = buildNotionReport(run);
  if (!report.trim()) {
    throw new NotionExportError('Нет данных отчёта для экспорта', 'unknown');
  }

  const workflowType = run.workflowSlug ?? run.workflow;
  const subject = options.subject?.trim() ?? '';
  const title = buildNotionPageTitle(run, subject || undefined);

  logMobile('notion export start', workflowType);

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/export/notion'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        notionApiKey: credentials.apiKey,
        databaseId: credentials.databaseId,
        title,
        report,
        workflowType,
        workflow: run.workflow,
        subject: subject || undefined,
        createdAt: options.createdAt ?? Date.now(),
        result: run.result,
      }),
    });
  } catch (e) {
    const mapped = mapFetchError(e);
    if (mapped.code === 'network' || mapped.code === 'config') {
      throw new NotionExportError(mapped.message, mapped.code, mapped.status);
    }
    logError('notion-fetch', e);
    throw new NotionExportError(mapped.message, 'network');
  }

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
    code?: string;
    pageId?: string;
    url?: string | null;
  };

  if (!response.ok) {
    throw mapNotionApiError(data);
  }

  if (!data.pageId) {
    throw new NotionExportError(data.message ?? 'Notion не вернул ID страницы', 'notion_api');
  }

  logMobile('notion export success', data.pageId);

  return {
    pageId: data.pageId,
    url: data.url ?? null,
  };
}
