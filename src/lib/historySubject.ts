import { WORKFLOW_IDS, type CompetitorMetadata } from '../config/workflows';

export interface HistorySubjectContext {
  fileName?: string;
  text?: string;
  competitorMeta?: CompetitorMetadata;
}

function truncatePreview(text: string, max = 48): string {
  const line = text.split(/\r?\n/).find((l) => l.trim())?.trim() ?? text.trim();
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}

function pickCompetitorName(meta: CompetitorMetadata): string | null {
  if (meta.companyName?.trim()) return meta.companyName.trim();
  if (meta.website?.trim()) return meta.website.trim();
  if (meta.instagram?.trim()) return meta.instagram.trim();
  if (meta.telegram?.trim()) return meta.telegram.trim();
  return null;
}

function formatWorkflowTypeLabel(workflowType: string): string {
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

/** e.g. "Конкурент: Бритва", "Договор: Договор аренды", "Файл: Продажи.xlsx" */
export function buildWorkflowSubject(workflow: string, context: HistorySubjectContext): string {
  const { fileName, text, competitorMeta } = context;

  if (workflow === WORKFLOW_IDS.COMPETITORS) {
    const name = competitorMeta ? pickCompetitorName(competitorMeta) : null;
    if (name) return `Конкурент: ${name}`;
    if (fileName) return `Файл: ${fileName}`;
    if (text?.trim()) return `Конкурент: ${truncatePreview(text)}`;
    return 'Конкурент: без названия';
  }

  if (workflow === WORKFLOW_IDS.CONTRACT) {
    if (fileName) return `Договор: ${fileName}`;
    if (text?.trim()) return `Договор: ${truncatePreview(text)}`;
    return 'Договор: без названия';
  }

  if (workflow === WORKFLOW_IDS.DATA) {
    if (fileName) return `Файл: ${fileName}`;
    if (text?.trim()) return `Данные: ${truncatePreview(text)}`;
    return 'Данные: без названия';
  }

  if (fileName) return `Файл: ${fileName}`;
  if (text?.trim()) return truncatePreview(text);
  return 'WorkflowGPT';
}

/** e.g. "Анализ конкурентов — Бритва" */
export function buildHistoryTitle(workflowType: string, subject: string): string {
  const label = formatWorkflowTypeLabel(workflowType);
  const shortName = subject.replace(/^(Конкурент|Договор|Файл|Данные):\s*/, '').trim();
  return shortName ? `${label} — ${shortName}` : label;
}
