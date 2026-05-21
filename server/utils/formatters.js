const { WORKFLOW_IDS } = require('../workflows/config');

const WORKFLOW_SLUGS = {
  [WORKFLOW_IDS.COMPETITORS]: 'competitors',
  [WORKFLOW_IDS.CONTRACT]: 'legal',
  [WORKFLOW_IDS.DATA]: 'analytics',
};

const RESULT_SECTIONS = {
  competitors: [
    { key: 'niche', title: 'Ниша и рынок', type: 'text' },
    { key: 'swot', title: 'SWOT-анализ', type: 'swot' },
    { key: 'advantages', title: 'Преимущества', type: 'list' },
    { key: 'offer', title: 'Оффер и УТП', type: 'text' },
    { key: 'recommendations', title: 'Рекомендации', type: 'list' },
  ],
  legal: [
    { key: 'summary', title: 'Резюме договора', type: 'text' },
    { key: 'risks', title: 'Риски', type: 'list' },
    { key: 'redFlags', title: 'Красные флаги', type: 'list' },
    { key: 'recommendations', title: 'Рекомендации', type: 'list' },
  ],
  analytics: [
    { key: 'patterns', title: 'Закономерности', type: 'list' },
    { key: 'anomalies', title: 'Аномалии', type: 'list' },
    { key: 'insights', title: 'Инсайты', type: 'list' },
    { key: 'recommendations', title: 'Бизнес-рекомендации', type: 'list' },
  ],
};

/**
 * @param {string} workflowTitle
 */
function getWorkflowSlug(workflowTitle) {
  return WORKFLOW_SLUGS[workflowTitle] ?? workflowTitle;
}

/**
 * @param {string} slug
 */
function getSectionsForSlug(slug) {
  return RESULT_SECTIONS[slug] ?? [];
}

/**
 * @param {object} swot
 */
function formatSwotText(swot) {
  if (!swot || typeof swot !== 'object') return '';
  const lines = [];
  const labels = [
    ['strengths', 'Сильные стороны'],
    ['weaknesses', 'Слабые стороны'],
    ['opportunities', 'Возможности'],
    ['threats', 'Угрозы'],
  ];
  for (const [key, label] of labels) {
    const items = swot[key];
    if (Array.isArray(items) && items.length) {
      lines.push(`${label}:`, ...items.map((i) => `• ${i}`), '');
    }
  }
  return lines.join('\n').trim();
}

/**
 * @param {unknown} value
 * @param {string} type
 */
function formatSectionValue(value, type) {
  if (type === 'swot') return formatSwotText(value);
  if (type === 'list') {
    if (Array.isArray(value)) return value.map((v) => `• ${v}`).join('\n');
    return String(value ?? '');
  }
  if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2);
  return String(value ?? '').trim();
}

/**
 * @param {string} workflowTitle
 * @param {object} result
 */
function formatWorkflowReply(workflowTitle, result) {
  const slug = getWorkflowSlug(workflowTitle);
  const sections = getSectionsForSlug(slug);
  const lines = [`# WorkflowGPT — ${workflowTitle}`, ''];

  for (const { key, title, type } of sections) {
    const value = result[key];
    const text = formatSectionValue(value, type);
    if (text) {
      lines.push(`## ${title}`, '', text, '');
    }
  }

  return lines.join('\n').trim();
}

/**
 * Flatten result for export copy
 * @param {string} workflowTitle
 * @param {object} result
 */
function flattenResultForExport(workflowTitle, result) {
  const slug = getWorkflowSlug(workflowTitle);
  const sections = getSectionsForSlug(slug);
  const blocks = [`WorkflowGPT — ${workflowTitle}`, ''];

  for (const { key, title, type } of sections) {
    const text = formatSectionValue(result[key], type);
    if (text) blocks.push(`${title}\n${text}`, '');
  }

  return blocks.join('\n').trim();
}

module.exports = {
  WORKFLOW_SLUGS,
  RESULT_SECTIONS,
  getWorkflowSlug,
  getSectionsForSlug,
  formatWorkflowReply,
  flattenResultForExport,
  formatSectionValue,
  formatSwotText,
};
