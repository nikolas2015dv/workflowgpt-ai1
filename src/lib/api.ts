import type { CompetitorMetadata } from '../config/workflows';
import { getUploadConfig } from '../config/workflows';
import { RESULT_SECTIONS } from '../config/pipelineSteps';
import type { ResultSectionConfig, WorkflowRunResult } from '../types/workflowResult';
import { buildCopyText } from './formatResult';
import { logError, logUpload, logWorkflow } from './mobileDebug';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 300000;

export interface WorkflowSectionDto extends ResultSectionConfig {}

interface WorkflowApiResponse {
  reply?: string;
  result?: Record<string, unknown>;
  workflow?: string;
  workflowSlug?: string;
  steps?: string[];
  stepIds?: string[];
  sections?: WorkflowSectionDto[];
  filename?: string;
  error?: string;
  message?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function parseResponse(response: Response): Promise<WorkflowApiResponse> {
  try {
    return (await response.json()) as WorkflowApiResponse;
  } catch {
    if (!response.ok) {
      throw new ApiRequestError(`Ошибка сервера (${response.status})`, response.status);
    }
    throw new ApiRequestError('Некорректный ответ сервера');
  }
}

function toWorkflowRunResult(data: WorkflowApiResponse, response: Response): WorkflowRunResult {
  if (!response.ok) {
    throw new ApiRequestError(
      data.message ?? data.error ?? `Ошибка сервера (${response.status})`,
      response.status
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
    throw new ApiRequestError('Сервер вернул пустой ответ');
  }

  const reply =
    typeof data.reply === 'string' && data.reply.trim()
      ? data.reply.trim()
      : buildCopyText(workflow, result as Record<string, unknown>, sections, '');

  return {
    workflow,
    workflowSlug: data.workflowSlug,
    result,
    reply,
    sections,
    steps: data.steps,
    stepIds: data.stepIds,
  };
}

export function validateFile(file: File, workflow: string): void {
  const config = getUploadConfig(workflow);
  if (!config) {
    throw new ApiRequestError('Этот workflow не поддерживает загрузку файлов');
  }

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!config.extensions.includes(ext)) {
    throw new ApiRequestError(`Неподдерживаемый формат. Разрешено: ${config.extensions.join(', ')}`);
  }
  if (file.size === 0) throw new ApiRequestError('Файл пустой');
  if (file.size > MAX_FILE_SIZE) throw new ApiRequestError('Файл слишком большой. Максимум 10 МБ');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    logWorkflow('fetch', url);
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    logError('fetch', e);
    if ((e as Error).name === 'AbortError') {
      throw new ApiRequestError('Превышено время ожидания анализа. Попробуйте снова.', 504);
    }
    throw new ApiRequestError(
      'Не удалось подключиться к серверу. Запустите backend: npm run server'
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAiReply(
  message: string,
  workflow: string,
  metadata?: CompetitorMetadata,
  signal?: AbortSignal
): Promise<WorkflowRunResult> {
  const response = await fetchWithTimeout(`${API_BASE}/api/test-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow, message, metadata }),
    signal,
  });

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
    `${API_BASE}/api/workflow/upload`,
    { method: 'POST', body: formData, signal: options.signal }
  );
  if (progress) progress(100);

  const data = await parseResponse(response);
  return toWorkflowRunResult(data, response);
}
