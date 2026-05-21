import { WORKFLOW_IDS } from './workflows';
import type { ResultSectionConfig } from '../types/workflowResult';

export const PIPELINE_LOADING_STEPS: Record<string, string[]> = {
  [WORKFLOW_IDS.COMPETITORS]: [
    'Определяем нишу',
    'Делаем SWOT-анализ',
    'Ищем преимущества',
    'Формируем оффер',
    'Генерируем рекомендации',
  ],
  [WORKFLOW_IDS.CONTRACT]: [
    'Разбираем документ',
    'Составляем резюме',
    'Выявляем риски',
    'Ищем красные флаги',
    'Формируем рекомендации',
  ],
  contractFile: [
    'Загружаем файл',
    'Разбираем документ',
    'Выявляем риски',
    'Ищем красные флаги',
    'Формируем рекомендации',
  ],
  contractVision: [
    'Обрабатываем изображение',
    'Извлекаем текст',
    'Выявляем риски',
    'Ищем красные флаги',
    'Формируем рекомендации',
  ],
  [WORKFLOW_IDS.DATA]: [
    'Разбираем данные',
    'Ищем закономерности',
    'Проверяем аномалии',
    'Формируем инсайты',
    'Готовим рекомендации',
  ],
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
  if (workflow === WORKFLOW_IDS.CONTRACT && file) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
    return isImage ? PIPELINE_LOADING_STEPS.contractVision : PIPELINE_LOADING_STEPS.contractFile;
  }
  return PIPELINE_LOADING_STEPS[workflow] ?? ['Подготовка', 'Анализ', 'Формирование отчёта'];
}
