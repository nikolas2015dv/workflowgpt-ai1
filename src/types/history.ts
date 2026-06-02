import type { WorkflowRunResult } from './workflowResult';

export interface HistoryItem {
  id: string;
  workflowType: string;
  title: string;
  subject: string;
  createdAt: number;
  result: WorkflowRunResult;
  /** @deprecated legacy entries — migrated on read */
  report?: string;
}

export interface SaveHistoryInput {
  workflowType: string;
  subject: string;
  result: WorkflowRunResult;
}
