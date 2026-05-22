import { WORKFLOW_IDS } from './workflows';
import { getEngineLoadingSteps } from './workflowEngine';
import type { ResultSectionConfig } from '../types/workflowResult';

/** @deprecated use getEngineLoadingSteps from workflowEngine.ts */
export const PIPELINE_LOADING_STEPS: Record<string, string[]> = {
  [WORKFLOW_IDS.COMPETITORS]: getEngineLoadingSteps(WORKFLOW_IDS.COMPETITORS, null),
  [WORKFLOW_IDS.CONTRACT]: getEngineLoadingSteps(WORKFLOW_IDS.CONTRACT, null),
  contractFile: getEngineLoadingSteps(WORKFLOW_IDS.CONTRACT, { name: 'doc.pdf' } as File),
  contractVision: getEngineLoadingSteps(WORKFLOW_IDS.CONTRACT, { name: 'scan.jpg' } as File),
  [WORKFLOW_IDS.DATA]: getEngineLoadingSteps(WORKFLOW_IDS.DATA, null),
};

export const RESULT_SECTIONS: Record<string, ResultSectionConfig[]> = {
  [WORKFLOW_IDS.COMPETITORS]: [
    { key: 'niche', title: 'Ниша и рынок', type: 'text' },
    { key: 'swot', title: 'SWOT-анализ', type: 'swot' },
    { key: 'advantages', title: 'Преимущества', type: 'list' },
    { key: 'offer', title: 'Оффер и УТП', type: 'text' },
    { key: 'recommendations', title: 'Рекомендации', type: 'list' },
  ],
  [WORKFLOW_IDS.CONTRACT]: [
    { key: 'summary', title: 'Резюме договора', type: 'text' },
    { key: 'risks', title: 'Риски', type: 'list' },
    { key: 'redFlags', title: 'Красные флаги', type: 'list' },
    { key: 'recommendations', title: 'Рекомендации', type: 'list' },
  ],
  [WORKFLOW_IDS.DATA]: [
    { key: 'patterns', title: 'Закономерности', type: 'list' },
    { key: 'anomalies', title: 'Аномалии', type: 'list' },
    { key: 'insights', title: 'Инсайты', type: 'list' },
    { key: 'recommendations', title: 'Бизнес-рекомендации', type: 'list' },
  ],
};

export function getPipelineLoadingSteps(workflow: string, file: File | null): string[] {
  return getEngineLoadingSteps(workflow, file);
}
