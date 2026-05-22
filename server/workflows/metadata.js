const { WORKFLOW_IDS } = require('./config');

/** @typedef {{ id: string; name: string; label: string; estimatedSeconds?: number }} WorkflowStageMeta */
/** @typedef {{ id: string; title: string; description: string; workflowTitle: string; estimatedDuration: number; stages: WorkflowStageMeta[] }} WorkflowDefinitionMeta */

/** @type {Record<string, WorkflowDefinitionMeta>} */
const WORKFLOW_METADATA = {
  [WORKFLOW_IDS.COMPETITORS]: {
    id: 'competitors',
    title: 'Анализ конкурентов',
    workflowTitle: WORKFLOW_IDS.COMPETITORS,
    description: 'Многошаговый маркетинговый анализ: ниша, SWOT, преимущества, оффер и рекомендации.',
    estimatedDuration: 120,
    stages: [
      { id: 'market_research', name: 'Market Research', label: 'Исследуем рынок...', estimatedSeconds: 18 },
      { id: 'swot_analysis', name: 'SWOT Analysis', label: 'SWOT-анализ...', estimatedSeconds: 22 },
      { id: 'competitor_advantages', name: 'Competitor Advantages', label: 'Анализируем конкурентов...', estimatedSeconds: 18 },
      { id: 'offer_generation', name: 'Offer Generation', label: 'Формируем оффер...', estimatedSeconds: 18 },
      { id: 'recommendations', name: 'Recommendations', label: 'Готовим рекомендации...', estimatedSeconds: 18 },
      { id: 'final_report', name: 'Final Report', label: 'Формируем отчёт...', estimatedSeconds: 24 },
    ],
  },
  [WORKFLOW_IDS.CONTRACT]: {
    id: 'legal',
    title: 'Анализ договора',
    workflowTitle: WORKFLOW_IDS.CONTRACT,
    description: 'Юридический pipeline: разбор документа, риски, красные флаги и рекомендации.',
    estimatedDuration: 100,
    stages: [
      { id: 'document_parsing', name: 'Document Parsing', label: 'Разбираем документ...', estimatedSeconds: 20 },
      { id: 'legal_risk_detection', name: 'Legal Risk Detection', label: 'Выявляем риски...', estimatedSeconds: 22 },
      { id: 'red_flags', name: 'Red Flags', label: 'Ищем красные флаги...', estimatedSeconds: 18 },
      { id: 'recommendations', name: 'Recommendations', label: 'Формируем рекомендации...', estimatedSeconds: 18 },
      { id: 'final_report', name: 'Final Legal Report', label: 'Собираем юридический отчёт...', estimatedSeconds: 22 },
    ],
  },
  [WORKFLOW_IDS.DATA]: {
    id: 'analytics',
    title: 'Анализ данных',
    workflowTitle: WORKFLOW_IDS.DATA,
    description: 'Аналитический pipeline: данные, паттерны, инсайты и бизнес-рекомендации.',
    estimatedDuration: 90,
    stages: [
      { id: 'data_parsing', name: 'Data Parsing', label: 'Разбираем данные...', estimatedSeconds: 16 },
      { id: 'pattern_detection', name: 'Pattern Detection', label: 'Ищем закономерности...', estimatedSeconds: 20 },
      { id: 'insights', name: 'Insights', label: 'Формируем инсайты...', estimatedSeconds: 18 },
      { id: 'recommendations', name: 'Recommendations', label: 'Готовим рекомендации...', estimatedSeconds: 18 },
      { id: 'final_report', name: 'Final Analytics Report', label: 'Собираем аналитический отчёт...', estimatedSeconds: 20 },
    ],
  },
};

function getWorkflowMetadata(workflowTitle) {
  return WORKFLOW_METADATA[workflowTitle] ?? null;
}

function listWorkflowMetadata() {
  return Object.values(WORKFLOW_METADATA);
}

module.exports = {
  WORKFLOW_METADATA,
  getWorkflowMetadata,
  listWorkflowMetadata,
};
