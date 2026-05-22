import type { CompetitorMetadata } from '../config/workflows';
import { getUploadConfig } from '../config/workflows';
import { ensureApiConfigured, getApiBaseUrl, API_REQUEST_TIMEOUT_MS } from '../config/api';
import { RESULT_SECTIONS } from '../config/pipelineSteps';
import type { ResultSectionConfig, WorkflowRunResult } from '../types/workflowResult';
import { buildCopyText } from './formatResult';
import { logError, logUpload, logMobile, logWorkflow } from './mobileDebug';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type ApiErrorCode = 'network' | 'timeout' | 'config' | 'backend' | 'unknown';

export interface WorkflowSectionDto extends ResultSectionConfig {}

interface WorkflowApiResponse {
  reply?: string;
  report?: string;
  result?: Record<string, unknown>;
  workflow?: string;
  workflowSlug?: string;
  steps?: string[];
  stepIds?: string[];
  sections?: WorkflowSectionDto[];
  progress?: {
    currentStage: number;
    totalStages: number;
    stageName: string;
    progress: number;
  };
  engineVersion?: string;
  filename?: string;
  error?: string;
  message?: string;
  status?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code: ApiErrorCode = 'unknown'
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function apiUrl(path: string): string {
  const base = ensureApiConfigured();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseResponse(response: Response): Promise<WorkflowApiResponse> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      throw new ApiRequestError(
        text?.slice(0, 200) || `Ошибка сервера (${response.status})`,
        response.status,
        'backend'
      );
    }
    throw new ApiRequestError('Сервер вернул не-JSON ответ', response.status, 'backend');
  }

  try {
    return (await response.json()) as WorkflowApiResponse;
  } catch {
    if (!response.ok) {
      throw new ApiRequestError(`Ошибка сервера (${response.status})`, response.status, 'backend');
    }
    throw new ApiRequestError('Некорректный JSON от сервера', undefined, 'backend');
  }
}

function toWorkflowRunResult(data: WorkflowApiResponse, response: Response): WorkflowRunResult {
  if (!response.ok) {
    throw new ApiRequestError(
      data.message ?? data.error ?? `Ошибка сервера (${response.status})`,
      response.status,
      'backend'
    );
  }

  const workflow = data.workflow ?? '';
  const result = (data.result ?? {}) as WorkflowRunResult['result'];
  const sections =
    data.sections && data.sections.length > 0
      ? data.sections
      : RESULT_SECTIONS[workflow] ?? [];

  const hasContent =
    typeof data.reply === 'string' && data.reply.trim().length > 0
      ? true
      : sections.some((s) => {
          const v = result[s.key as keyof typeof result];
          return v != null && (Array.isArray(v) ? v.length > 0 : String(v).length > 0);
        });

  if (!hasContent) {
    throw new ApiRequestError('Сервер вернул пустой ответ', response.status, 'backend');
  }

  const reportText =
    typeof data.report === 'string' && data.report.trim()
      ? data.report.trim()
      : typeof data.reply === 'string' && data.reply.trim()
        ? data.reply.trim()
        : '';

  const reply = reportText || buildCopyText(workflow, result as Record<string, unknown>, sections, '');

  return {
    workflow,
    workflowSlug: data.workflowSlug,
    result,
    reply,
    report: reportText || undefined,
    sections,
    steps: data.steps,
    stepIds: data.stepIds,
    progress: data.progress,
    engineVersion: data.engineVersion,
  };
}

export function mapFetchError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;

  if (error instanceof Error) {
    if (error.message.includes('VITE_API_URL')) {
      return new ApiRequestError(error.message, undefined, 'config');
    }

    if (error.name === 'AbortError') {
      return new ApiRequestError(
        'Превышено время ожидания. Анализ занимает несколько минут — попробуйте снова.',
        504,
        'timeout'
      );
    }

    const isNetwork =
      error.name === 'TypeError' ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Load failed');

    if (isNetwork) {
      const base = getApiBaseUrl() || '(not configured)';
      return new ApiRequestError(
        `Backend недоступен (${base}). Проверьте, что API на Render запущен и VITE_API_URL указан в Vercel.`,
        0,
        'network'
      );
    }
  }

  return new ApiRequestError(
    error instanceof Error ? error.message : 'Неизвестная ошибка сети',
    undefined,
    'unknown'
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = API_REQUEST_TIMEOUT_MS
): Promise<Response> {
  ensureApiConfigured();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    logWorkflow('fetch', url);
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new ApiRequestError(
        `Backend временно недоступен (${response.status}). Повторите через минуту.`,
        response.status,
        'backend'
      );
    }

    return response;
  } catch (e) {
    logError('fetch', e);
    throw mapFetchError(e);
  } finally {
    clearTimeout(timeout);
  }
}

/** Optional: ping backend health (e.g. on app load in Telegram). */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(apiUrl('/api/health'), { method: 'GET' }, 15_000);
    const data = await parseResponse(response);
    return response.ok && data.status === 'ok';
  } catch (e) {
    logError('health', e);
    return false;
  }
}

export function validateFile(file: File, workflow: string): void {
  const config = getUploadConfig(workflow);
  if (!config) {
    throw new ApiRequestError('Этот workflow не поддерживает загрузку файлов', undefined, 'config');
  }

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!config.extensions.includes(ext)) {
    throw new ApiRequestError(`Неподдерживаемый формат. Разрешено: ${config.extensions.join(', ')}`);
  }
  if (file.size === 0) throw new ApiRequestError('Файл пустой');
  if (file.size > MAX_FILE_SIZE) throw new ApiRequestError('Файл слишком большой. Максимум 10 МБ');
}

export async function requestAiReply(
  message: string,
  workflow: string,
  metadata?: CompetitorMetadata,
  signal?: AbortSignal
): Promise<WorkflowRunResult> {
  const response = await fetchWithTimeout(
    apiUrl('/api/test-ai'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ workflow, message, metadata }),
      signal,
    }
  );

  const data = await parseResponse(response);
  return toWorkflowRunResult(data, response);
}

export interface UploadWorkflowOptions {
  message?: string;
  metadata?: CompetitorMetadata;
  onUploadProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function uploadWorkflowFile(
  workflow: string,
  file: File,
  options: UploadWorkflowOptions = {}
): Promise<WorkflowRunResult> {
  validateFile(file, workflow);

  const formData = new FormData();
  formData.append('workflow', workflow);
  formData.append('file', file);

  if (options.message?.trim()) {
    formData.append('message', options.message.trim());
  }
  if (options.metadata && Object.keys(options.metadata).length > 0) {
    formData.append('metadata', JSON.stringify(options.metadata));
  }

  const progress = options.onUploadProgress;
  if (progress) progress(10);

  if (progress) progress(40);
  logUpload('POST /api/workflow/upload', { workflow, file: file.name });

  const response = await fetchWithTimeout(
    apiUrl('/api/workflow/upload'),
    {
      method: 'POST',
      body: formData,
      signal: options.signal,
    }
  );

  if (progress) progress(100);

  const data = await parseResponse(response);
  return toWorkflowRunResult(data, response);
}

/** @deprecated use uploadWorkflowFile */
export async function uploadContractFile(
  file: File,
  note?: string,
  signal?: AbortSignal
): Promise<WorkflowRunResult> {
  return uploadWorkflowFile('Анализ договора', file, { message: note, signal });
}
