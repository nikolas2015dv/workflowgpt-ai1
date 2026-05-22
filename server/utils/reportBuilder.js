const { FINAL_REPORT_PROMPTS, FINAL_REPORT_TEMPLATE } = require('./prompts');
const { createMarkdownCompletion } = require('../services/openaiService');
const { appendBlocks } = require('../services/parserService');

/**
 * @param {'competitors' | 'legal' | 'analytics'} slug
 * @param {object} state
 */
async function buildFinalReport(slug, state) {
  const cfg = FINAL_REPORT_PROMPTS[slug];
  if (!cfg) return '';

  const contextJson = JSON.stringify(state, null, 2).slice(0, 12000);
  const userPrompt = appendBlocks([
    `Собери финальный отчёт на основе результатов всех этапов pipeline.`,
    `Обязательная структура:\n${FINAL_REPORT_TEMPLATE.replace('{title}', cfg.title)}`,
    `Данные этапов:\n${contextJson}`,
    'Заполни все секции: Summary, Analysis, Recommendations, Action Steps. Action Steps — нумерованный список из 5–8 пунктов.',
  ]);

  const report = await createMarkdownCompletion({
    systemPrompt: cfg.system,
    userPrompt,
    maxTokens: 2400,
  });

  return normalizeReportHeadings(report, cfg.title);
}

/**
 * @param {string} markdown
 * @param {string} title
 */
function normalizeReportHeadings(markdown, title) {
  let text = String(markdown ?? '').trim();
  if (!text.startsWith('#')) {
    text = `# ${title}\n\n${text}`;
  }
  const required = ['## Summary', '## Analysis', '## Recommendations', '## Action Steps'];
  for (const heading of required) {
    if (!text.includes(heading)) {
      text += `\n\n${heading}\n\n—`;
    }
  }
  return text.trim();
}

module.exports = {
  buildFinalReport,
  normalizeReportHeadings,
};
