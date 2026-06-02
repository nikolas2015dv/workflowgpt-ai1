import { RESULT_SECTIONS } from '../config/pipelineSteps';
import { WORKFLOW_IDS } from '../config/workflows';
import { buildHistoryTitle } from '../lib/historySubject';
import type { HistoryItem, SaveHistoryInput } from '../types/history';
import type { WorkflowRunResult } from '../types/workflowResult';

export const HISTORY_STORAGE_KEY = 'workflowgpt_history';
export const MAX_HISTORY_ITEMS = 100;

function createHistoryId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function workflowTypeToTitle(workflowType: string): string {
  const map: Record<string, string> = {
    competitors: WORKFLOW_IDS.COMPETITORS,
    legal: WORKFLOW_IDS.CONTRACT,
    analytics: WORKFLOW_IDS.DATA,
    [WORKFLOW_IDS.COMPETITORS]: WORKFLOW_IDS.COMPETITORS,
    [WORKFLOW_IDS.CONTRACT]: WORKFLOW_IDS.CONTRACT,
    [WORKFLOW_IDS.DATA]: WORKFLOW_IDS.DATA,
  };
  return map[workflowType] ?? workflowType;
}

function getSectionsForWorkflowType(workflowType: string) {
  return RESULT_SECTIONS[workflowTypeToTitle(workflowType)] ?? [];
}

function isWorkflowRunResult(value: unknown): value is WorkflowRunResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WorkflowRunResult).workflow === 'string' &&
    typeof (value as WorkflowRunResult).reply === 'string' &&
    Array.isArray((value as WorkflowRunResult).sections)
  );
}

function normalizeLegacyItem(raw: Record<string, unknown>): HistoryItem | null {
  if (
    typeof raw.id !== 'string' ||
    typeof raw.workflowType !== 'string' ||
    typeof raw.createdAt !== 'number'
  ) {
    return null;
  }

  const legacyReport = typeof raw.report === 'string' ? raw.report : '';
  const title = typeof raw.title === 'string' ? raw.title : 'WorkflowGPT Report';
  const workflowTitle = workflowTypeToTitle(raw.workflowType);

  if (isWorkflowRunResult(raw.result)) {
    return {
      id: raw.id,
      workflowType: raw.workflowType,
      title:
        typeof raw.title === 'string'
          ? raw.title
          : buildHistoryTitle(raw.workflowType, (raw.subject as string) ?? title),
      subject: typeof raw.subject === 'string' ? raw.subject : title,
      createdAt: raw.createdAt,
      result: raw.result,
    };
  }

  if (!legacyReport.trim()) return null;

  const result: WorkflowRunResult = {
    workflow: workflowTitle,
    workflowSlug: raw.workflowType,
    result: {},
    reply: legacyReport,
    report: legacyReport,
    sections: getSectionsForWorkflowType(raw.workflowType),
  };

  return {
    id: raw.id,
    workflowType: raw.workflowType,
    title,
    subject: typeof raw.subject === 'string' ? raw.subject : title,
    createdAt: raw.createdAt,
    result,
    report: legacyReport,
  };
}

function readRawItems(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) =>
        typeof item === 'object' && item !== null ? normalizeLegacyItem(item as Record<string, unknown>) : null
      )
      .filter((item): item is HistoryItem => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeItems(items: HistoryItem[]): void {
  try {
    const payload = items.slice(0, MAX_HISTORY_ITEMS).map(({ report: _legacy, ...item }) => item);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

export function getHistoryItems(): HistoryItem[] {
  return readRawItems();
}

export function saveHistoryItem(input: SaveHistoryInput): HistoryItem {
  const workflowType = input.workflowType.trim();
  const subject = input.subject.trim() || 'WorkflowGPT';
  const title = buildHistoryTitle(workflowType, subject);

  const item: HistoryItem = {
    id: createHistoryId(),
    workflowType,
    title,
    subject,
    createdAt: Date.now(),
    result: input.result,
  };

  const items = readRawItems();
  writeItems([item, ...items]);

  console.log('[History] Saved', { id: item.id, workflowType: item.workflowType, subject: item.subject });
  return item;
}

export function historyItemToRunResult(item: HistoryItem): WorkflowRunResult {
  return {
    ...item.result,
    workflow: item.result.workflow || workflowTypeToTitle(item.workflowType),
    sections:
      item.result.sections?.length > 0
        ? item.result.sections
        : getSectionsForWorkflowType(item.workflowType),
  };
}

export function deleteHistoryItem(id: string): boolean {
  const items = readRawItems();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;

  writeItems(next);
  console.log('[History] Deleted', { id });
  return true;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  console.log('[History] Cleared');
}

export function logHistoryOpened(id: string): void {
  console.log('[History] Opened', { id });
}

export function formatHistoryDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatWorkflowTypeLabel(workflowType: string): string {
  const map: Record<string, string> = {
    competitors: 'Анализ конкурентов',
    legal: 'Анализ договора',
    analytics: 'Анализ данных',
    [WORKFLOW_IDS.COMPETITORS]: 'Анализ конкурентов',
    [WORKFLOW_IDS.CONTRACT]: 'Анализ договора',
    [WORKFLOW_IDS.DATA]: 'Анализ данных',
  };
  return map[workflowType] ?? workflowType;
}
