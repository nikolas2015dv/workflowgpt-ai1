export const WORKFLOW_IDS = {
  COMPETITORS: 'Анализ конкурентов',
  CONTRACT: 'Анализ договора',
  DATA: 'Анализ данных',
} as const;

export type WorkflowId = (typeof WORKFLOW_IDS)[keyof typeof WORKFLOW_IDS];

export interface WorkflowUploadConfig {
  accept: string;
  hint: string;
  extensions: string[];
}

const LEGAL_EXTENSIONS = ['.txt', '.docx', '.pdf', '.jpg', '.jpeg', '.png'];
const DATA_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.txt', '.docx', '.pdf'];
const COMPETITOR_EXTENSIONS = ['.txt', '.docx', '.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.csv'];

export const WORKFLOW_UPLOAD: Partial<Record<WorkflowId, WorkflowUploadConfig>> = {
  [WORKFLOW_IDS.CONTRACT]: {
    accept:
      '.txt,.docx,.pdf,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png',
    hint: 'PDF, DOCX, TXT, JPG, PNG — до 10 МБ',
    extensions: LEGAL_EXTENSIONS,
  },
  [WORKFLOW_IDS.COMPETITORS]: {
    accept:
      '.txt,.docx,.pdf,.jpg,.jpeg,.png,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
    hint: 'Документы, фото, таблицы — до 10 МБ',
    extensions: COMPETITOR_EXTENSIONS,
  },
  [WORKFLOW_IDS.DATA]: {
    accept:
      '.csv,.xlsx,.xls,.txt,.docx,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/pdf',
    hint: 'XLSX, CSV, PDF, DOCX — до 10 МБ',
    extensions: DATA_EXTENSIONS,
  },
};

export interface CompetitorMetadata {
  companyName?: string;
  website?: string;
  instagram?: string;
  telegram?: string;
}

export function supportsFileUpload(workflow: string): boolean {
  return workflow in WORKFLOW_UPLOAD;
}

export function getUploadConfig(workflow: string): WorkflowUploadConfig | undefined {
  return WORKFLOW_UPLOAD[workflow as WorkflowId];
}
