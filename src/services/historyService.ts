import { RESULT_SECTIONS } from '../config/pipelineSteps';
import { WORKFLOW_IDS } from '../config/workflows';
import { buildHistoryTitle } from '../lib/historySubject';
import { getAuthUserId } from '../lib/authSession';
import {
  clearWorkflowHistoryDatabase,
  deleteWorkflowHistory,
  loadWorkflowHistory,
  saveWorkflowToDatabase,
} from '../lib/workflowDatabase';
import type { HistoryItem, SaveHistoryInput } from '../types/history';
import type { WorkflowRunResult } from '../types/workflowResult';
import {
  clearHistoryLocalStorage,
  MAX_HISTORY_ITEMS,
  readHistoryFromLocalStorage,
  writeHistoryToLocalStorage,
  HISTORY_STORAGE_KEY,
} from './historyLocalStorage';

export {
  saveWorkflowToDatabase,
  loadWorkflowHistory,
  deleteWorkflowHistory,
} from '../lib/workflowDatabase';

export { HISTORY_STORAGE_KEY, MAX_HISTORY_ITEMS };

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

function getScopedUserId(): string | null {
  return getAuthUserId();
}

export function getHistoryItems(): HistoryItem[] {
  return readHistoryFromLocalStorage(getScopedUserId());
}

export async function getHistoryItemsAsync(): Promise<HistoryItem[]> {
  const result = await loadWorkflowHistory();
  return result.items;
}

export function saveHistoryItem(input: SaveHistoryInput): HistoryItem {
  const workflowType = input.workflowType.trim();
  const subject = input.subject.trim() || 'WorkflowGPT';
  const title = buildHistoryTitle(workflowType, subject);
  const userId = getScopedUserId();

  const item: HistoryItem = {
    id: createHistoryId(),
    workflowType,
    title,
    subject,
    createdAt: Date.now(),
    result: input.result,
  };

  const items = readHistoryFromLocalStorage(userId);
  writeHistoryToLocalStorage([item, ...items], userId);

  void saveWorkflowToDatabase(item).catch(() => {
    /* database optional — localStorage is primary fallback */
  });

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
  const userId = getScopedUserId();
  const items = readHistoryFromLocalStorage(userId);
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;

  writeHistoryToLocalStorage(next, userId);
  void deleteWorkflowHistory(id).catch(() => {});
  console.log('[History] Deleted', { id });
  return true;
}

export function clearHistory(): void {
  const userId = getScopedUserId();
  clearHistoryLocalStorage(userId);
  void clearWorkflowHistoryDatabase().catch(() => {});
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
