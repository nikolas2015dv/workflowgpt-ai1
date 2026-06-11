import { RESULT_SECTIONS } from '../config/pipelineSteps';
import { WORKFLOW_IDS } from '../config/workflows';
import { buildHistoryTitle } from '../lib/historySubject';
import type { HistoryItem } from '../types/history';
import type { WorkflowRunResult } from '../types/workflowResult';

export const HISTORY_STORAGE_KEY = 'workflowgpt_history';
export const MAX_HISTORY_ITEMS = 100;

export function getHistoryStorageKey(userId?: string | null): string {
  return userId ? `${HISTORY_STORAGE_KEY}_${userId}` : HISTORY_STORAGE_KEY;
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

export function readHistoryFromLocalStorage(userId?: string | null): HistoryItem[] {
  try {
    const raw = localStorage.getItem(getHistoryStorageKey(userId));
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

export function writeHistoryToLocalStorage(items: HistoryItem[], userId?: string | null): void {
  try {
    const payload = items.slice(0, MAX_HISTORY_ITEMS).map(({ report: _legacy, ...item }) => item);
    localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

export function clearHistoryLocalStorage(userId?: string | null): void {
  try {
    localStorage.removeItem(getHistoryStorageKey(userId));
  } catch {
    /* ignore */
  }
}
