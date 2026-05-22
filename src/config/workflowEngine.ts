import { WORKFLOW_IDS } from './workflows';

export interface WorkflowStageMeta {
  id: string;
  name: string;
  label: string;
  estimatedSeconds?: number;
}

export interface WorkflowEngineMeta {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  stages: WorkflowStageMeta[];
}

/** Client-side mirror of server/workflows/metadata.js */
export const WORKFLOW_ENGINE_META: Record<string, WorkflowEngineMeta> = {
  [WORKFLOW_IDS.COMPETITORS]: {
    id: 'competitors',
    title: 'Анализ конкурентов',
    description: 'Многошаговый маркетинговый анализ: ниша, SWOT, преимущества, оффер и рекомендации.',
    estimatedDuration: 120,
    stages: [
      { id: 'market_research', name: 'Market Research', label: 'Исследуем рынок...' },
      { id: 'swot_analysis', name: 'SWOT Analysis', label: 'SWOT-анализ...' },
      { id: 'competitor_advantages', name: 'Competitor Advantages', label: 'Анализируем конкурентов...' },
      { id: 'offer_generation', name: 'Offer Generation', label: 'Формируем оффер...' },
      { id: 'recommendations', name: 'Recommendations', label: 'Готовим рекомендации...' },
      { id: 'final_report', name: 'Final Report', label: 'Формируем отчёт...' },
    ],
  },
  [WORKFLOW_IDS.CONTRACT]: {
    id: 'legal',
    title: 'Анализ договора',
    description: 'Юридический pipeline: разбор документа, риски, красные флаги и рекомендации.',
    estimatedDuration: 100,
    stages: [
      { id: 'document_parsing', name: 'Document Parsing', label: 'Разбираем документ...' },
      { id: 'legal_risk_detection', name: 'Legal Risk Detection', label: 'Выявляем риски...' },
      { id: 'red_flags', name: 'Red Flags', label: 'Ищем красные флаги...' },
      { id: 'recommendations', name: 'Recommendations', label: 'Формируем рекомендации...' },
      { id: 'final_report', name: 'Final Legal Report', label: 'Собираем юридический отчёт...' },
    ],
  },
  [WORKFLOW_IDS.DATA]: {
    id: 'analytics',
    title: 'Анализ данных',
    description: 'Аналитический pipeline: данные, паттерны, инсайты и бизнес-рекомендации.',
    estimatedDuration: 90,
    stages: [
      { id: 'data_parsing', name: 'Data Parsing', label: 'Разбираем данные...' },
      { id: 'pattern_detection', name: 'Pattern Detection', label: 'Ищем закономерности...' },
      { id: 'insights', name: 'Insights', label: 'Формируем инсайты...' },
      { id: 'recommendations', name: 'Recommendations', label: 'Готовим рекомендации...' },
      { id: 'final_report', name: 'Final Analytics Report', label: 'Собираем аналитический отчёт...' },
    ],
  },
};

export function getEngineLoadingSteps(workflow: string, file: File | null): string[] {
  const meta = WORKFLOW_ENGINE_META[workflow];
  if (!meta) return ['Подготовка', 'Анализ', 'Формирование отчёта'];

  if (workflow === WORKFLOW_IDS.CONTRACT && file) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
    const prefix = isImage
      ? ['Обрабатываем изображение...', 'Извлекаем текст...']
      : ['Загружаем файл...'];
    return [...prefix, ...meta.stages.map((s) => s.label.replace(/\.\.\.$/, ''))];
  }

  return meta.stages.map((s) => s.label.replace(/\.\.\.$/, ''));
}

export function getEstimatedDurationMs(workflow: string): number {
  const meta = WORKFLOW_ENGINE_META[workflow];
  return (meta?.estimatedDuration ?? 90) * 1000;
}
