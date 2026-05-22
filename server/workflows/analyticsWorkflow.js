const { STEP_PROMPTS } = require('../utils/prompts');
const { createJsonCompletion, createMarkdownCompletion } = require('../services/openaiService');
const { buildFinalReport } = require('../utils/reportBuilder');
const { getWorkflowMetadata } = require('./metadata');
const { runWorkflowPipeline } = require('./workflowRunner');
const { WORKFLOW_IDS } = require('./config');
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

async function dataParsing(rawData) {
  const data = truncateData(rawData);
  if (!data.trim()) throw new Error('Нет данных для анализа');

  const { schema, system } = STEP_PROMPTS.analytics.parseData;
  const parsed = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: `Опиши структуру данных:\n\n${data}`,
    schemaHint: schema,
    fallback: { dataOverview: data.slice(0, 2000) },
  });
  const dataOverview = String(parsed.dataOverview ?? '').trim();
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([`Данные:\n${truncateData(data)}`, `Обзор:\n${dataOverview}`]),
  });
  return { dataOverview, stageMarkdown_parse: stageMarkdown };
}

async function patternDetection(rawData, overview, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.analytics.identifyPatterns;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Данные:\n${truncateData(rawData)}`,
      `Обзор:\n${overview}`,
      prevMarkdown,
      'Закономерности и тренды.',
    ]),
    schemaHint: schema,
    fallback: { patterns: [] },
  });
  const patterns = ensureStringArray(data.patterns);
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([`Паттерны:\n${patterns.map((p) => `• ${p}`).join('\n')}`]),
  });
  return { patterns, stageMarkdown_patterns: stageMarkdown };
}

async function insightsStage(rawData, patterns, prevMarkdown) {
  const { schema: anomalySchema, system: anomalySystem } = STEP_PROMPTS.analytics.detectAnomalies;
  const anomalyData = await createJsonCompletion({
    systemPrompt: anomalySystem,
    userPrompt: appendBlocks([
      `Данные:\n${truncateData(rawData)}`,
      `Паттерны:\n${patterns.map((p) => `• ${p}`).join('\n')}`,
      prevMarkdown,
      'Аномалии и проблемы.',
    ]),
    schemaHint: anomalySchema,
    fallback: { anomalies: [] },
  });
  const anomalies = ensureStringArray(anomalyData.anomalies);

  const { schema, system } = STEP_PROMPTS.analytics.generateInsights;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Паттерны:\n${patterns.map((p) => `• ${p}`).join('\n')}`,
      `Аномалии:\n${anomalies.map((a) => `• ${a}`).join('\n')}`,
      'Инсайты и выводы.',
    ]),
    schemaHint: schema,
    fallback: { insights: [] },
  });
  const insights = ensureStringArray(data.insights);
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Инсайты:\n${insights.map((i) => `• ${i}`).join('\n')}`,
      `Аномалии:\n${anomalies.map((a) => `• ${a}`).join('\n')}`,
    ]),
  });
  return { insights, anomalies, stageMarkdown_insights: stageMarkdown };
}

async function recommendationsStage(insights, anomalies, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.analytics.generateBusinessRecommendations;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Инсайты:\n${insights.map((i) => `• ${i}`).join('\n')}`,
      `Проблемы:\n${anomalies.map((a) => `• ${a}`).join('\n')}`,
      prevMarkdown,
      'Бизнес-рекомендации.',
    ]),
    schemaHint: schema,
    fallback: { recommendations: [] },
  });
  const recommendations = ensureStringArray(data.recommendations);
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([`Рекомендации:\n${recommendations.map((r) => `• ${r}`).join('\n')}`]),
  });
  return { recommendations, stageMarkdown_recommendations: stageMarkdown };
}

function buildStages(rawData) {
  let chain = '';

  return [
    {
      id: 'data_parsing',
      name: 'Data Parsing',
      label: 'Разбираем данные...',
      run: async () => {
        const out = await dataParsing(rawData);
        chain = out.stageMarkdown_parse ?? '';
        return out;
      },
    },
    {
      id: 'pattern_detection',
      name: 'Pattern Detection',
      label: 'Ищем закономерности...',
      run: async (ctx) => {
        const out = await patternDetection(rawData, ctx.state.dataOverview ?? '', chain);
        chain = out.stageMarkdown_patterns ?? chain;
        return out;
      },
    },
    {
      id: 'insights',
      name: 'Insights',
      label: 'Формируем инсайты...',
      run: async (ctx) => {
        const out = await insightsStage(rawData, ctx.state.patterns, chain);
        chain = out.stageMarkdown_insights ?? chain;
        return out;
      },
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      label: 'Готовим рекомендации...',
      run: async (ctx) => {
        const out = await recommendationsStage(ctx.state.insights, ctx.state.anomalies, chain);
        chain = out.stageMarkdown_recommendations ?? chain;
        return out;
      },
    },
    {
      id: 'final_report',
      name: 'Final Analytics Report',
      label: 'Собираем аналитический отчёт...',
      run: async (ctx) => {
        const report = await buildFinalReport('analytics', ctx.state);
        return { report, stageMarkdown_final: report };
      },
    },
  ];
}

const PIPELINE_STEPS = getWorkflowMetadata(WORKFLOW_IDS.DATA).stages.map((s) => ({
  id: s.id,
  label: s.label,
}));

/**
 * @param {object} input
 */
async function runAnalyticsWorkflow(input) {
  const rawData = buildRawData(input);
  const { result } = await runWorkflowPipeline(WORKFLOW_IDS.DATA, buildStages(rawData), input);
  result.workflow = 'analytics';
  return result;
}

module.exports = {
  runAnalyticsWorkflow,
  PIPELINE_STEPS,
};
