const { STEP_PROMPTS } = require('../utils/prompts');
const { createJsonCompletion } = require('../services/openaiService');
const {
  appendBlocks,
  truncateData,
  ensureStringArray,
} = require('../services/parserService');

function buildRawData(input) {
  return [input.documentText, input.message, input.note]
    .filter((s) => typeof s === 'string' && s.trim())
    .join('\n\n---\n\n');
}

/**
 * @param {string} rawData
 */
async function parseData(rawData) {
  const data = truncateData(rawData);
  if (!data.trim()) throw new Error('Нет данных для анализа');

  const { schema, system } = STEP_PROMPTS.analytics.parseData;
  const parsed = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: `Опиши структуру данных:\n\n${data}`,
    schemaHint: schema,
    fallback: { dataOverview: data.slice(0, 2000) },
  });
  return { dataOverview: String(parsed.dataOverview ?? '').trim() };
}

/**
 * @param {string} rawData
 * @param {string} overview
 */
async function identifyPatterns(rawData, overview) {
  const { schema, system } = STEP_PROMPTS.analytics.identifyPatterns;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Данные:\n${truncateData(rawData)}`,
      `Обзор:\n${overview}`,
      'Найди закономерности и тренды.',
    ]),
    schemaHint: schema,
    fallback: { patterns: [] },
  });
  return { patterns: ensureStringArray(data.patterns) };
}

/**
 * @param {string} rawData
 * @param {string[]} patterns
 */
async function detectAnomalies(rawData, patterns) {
  const { schema, system } = STEP_PROMPTS.analytics.detectAnomalies;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Данные:\n${truncateData(rawData)}`,
      `Паттерны:\n${patterns.map((p) => `• ${p}`).join('\n')}`,
      'Выяви аномалии и проблемы.',
    ]),
    schemaHint: schema,
    fallback: { anomalies: [] },
  });
  return { anomalies: ensureStringArray(data.anomalies) };
}

/**
 * @param {string[]} patterns
 * @param {string[]} anomalies
 */
async function generateInsights(patterns, anomalies) {
  const { schema, system } = STEP_PROMPTS.analytics.generateInsights;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Паттерны:\n${patterns.map((p) => `• ${p}`).join('\n')}`,
      `Аномалии:\n${anomalies.map((a) => `• ${a}`).join('\n')}`,
      'Сформулируй инсайты.',
    ]),
    schemaHint: schema,
    fallback: { insights: [] },
  });
  return { insights: ensureStringArray(data.insights) };
}

/**
 * @param {string[]} insights
 * @param {string[]} anomalies
 */
async function generateBusinessRecommendations(insights, anomalies) {
  const { schema, system } = STEP_PROMPTS.analytics.generateBusinessRecommendations;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Инсайты:\n${insights.map((i) => `• ${i}`).join('\n')}`,
      `Проблемы:\n${anomalies.map((a) => `• ${a}`).join('\n')}`,
      'Дай бизнес-рекомендации.',
    ]),
    schemaHint: schema,
    fallback: { recommendations: [] },
  });
  return { recommendations: ensureStringArray(data.recommendations) };
}

const PIPELINE_STEPS = [
  { id: 'parse_data', label: 'Разбираем данные...' },
  { id: 'identify_patterns', label: 'Ищем закономерности...' },
  { id: 'detect_anomalies', label: 'Проверяем аномалии...' },
  { id: 'generate_insights', label: 'Формируем инсайты...' },
  { id: 'generate_business_recommendations', label: 'Готовим рекомендации...' },
];

/**
 * @param {object} input
 * @param {Function} [runStep]
 */
async function runAnalyticsWorkflow(input, runStep) {
  const exec = runStep ?? (async (_id, _label, fn) => fn());
  const rawData = buildRawData(input);

  const { dataOverview } = await exec('parse_data', PIPELINE_STEPS[0].label, () => parseData(rawData));
  const { patterns } = await exec('identify_patterns', PIPELINE_STEPS[1].label, () =>
    identifyPatterns(rawData, dataOverview)
  );
  const { anomalies } = await exec('detect_anomalies', PIPELINE_STEPS[2].label, () =>
    detectAnomalies(rawData, patterns)
  );
  const { insights } = await exec('generate_insights', PIPELINE_STEPS[3].label, () =>
    generateInsights(patterns, anomalies)
  );
  const { recommendations } = await exec('generate_business_recommendations', PIPELINE_STEPS[4].label, () =>
    generateBusinessRecommendations(insights, anomalies)
  );

  return { patterns, anomalies, insights, recommendations };
}

module.exports = {
  runAnalyticsWorkflow,
  PIPELINE_STEPS,
  parseData,
  identifyPatterns,
  detectAnomalies,
  generateInsights,
  generateBusinessRecommendations,
};
