import type { WorkflowRunResult } from './workflowResult';

/** Supabase `workflow_history` table row shape */
export interface WorkflowHistoryRow {
  id: string;
  created_at: string;
  workflow_type: string;
  subject: string;
  title: string;
  report: string | null;
  summary: string | null;
  recommendations: string | null;
  raw_data: WorkflowHistoryRawData;
}

export interface WorkflowHistoryRawData {
  result?: WorkflowRunResult;
  [key: string]: unknown;
}

export type WorkflowHistorySource = 'database' | 'local';

export interface LoadWorkflowHistoryResult {
  items: import('./history').HistoryItem[];
  source: WorkflowHistorySource;
  error?: string;
}

export interface DatabaseHealthResponse {
  status: 'ok' | 'unavailable';
  message?: string;
}
