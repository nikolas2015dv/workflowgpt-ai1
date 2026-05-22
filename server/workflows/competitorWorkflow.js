const { STEP_PROMPTS } = require('../utils/prompts');
const { createJsonCompletion, createMarkdownCompletion } = require('../services/openaiService');
const { buildFinalReport } = require('../utils/reportBuilder');
const { getWorkflowMetadata } = require('./metadata');
const { runWorkflowPipeline } = require('./workflowRunner');
const { WORKFLOW_IDS } = require('./config');
const {
  buildCompetitorContext,
  appendBlocks,
  ensureStringArray,
  ensureSwot,
} = require('../services/parserService');

async function marketResearch(context) {
  const { schema, system } = STEP_PROMPTS.competitors.detectNiche;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: `${context}\n\nИсследование рынка: определи нишу, сегмент и контекст.`,
    schemaHint: schema,
    fallback: { niche: '' },
  });
  const niche = String(data.niche ?? '').trim();
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: STEP_PROMPTS.competitors.detectNiche.system,
    userPrompt: appendBlocks([context, `Ниша: ${niche}`, 'Краткий markdown: рынок, сегмент, гипотезы.']),
  });
  return { niche, stageMarkdown_market: stageMarkdown };
}

async function swotAnalysis(context, niche, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.competitors.generateSWOT;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([context, `Ниша:\n${niche}`, prevMarkdown, 'SWOT-анализ.']),
    schemaHint: schema,
    fallback: { swot: ensureSwot(null) },
  });
  const swot = ensureSwot(data.swot);
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([`Ниша: ${niche}`, `SWOT JSON:\n${JSON.stringify(swot)}`, 'Markdown SWOT.']),
  });
  return { swot, stageMarkdown_swot: stageMarkdown };
}

async function competitorAdvantages(context, niche, swot, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.competitors.identifyAdvantages;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      context,
      `Ниша:\n${niche}`,
      `SWOT:\n${JSON.stringify(swot, null, 2)}`,
      prevMarkdown,
      'Преимущества и дифференциация.',
    ]),
    schemaHint: schema,
    fallback: { advantages: [] },
  });
  const advantages = ensureStringArray(data.advantages);
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([`Преимущества:\n${advantages.map((a) => `• ${a}`).join('\n')}`]),
  });
  return { advantages, stageMarkdown_advantages: stageMarkdown };
}

async function offerGeneration(context, niche, advantages, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.competitors.generateOffer;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      context,
      `Ниша:\n${niche}`,
      `Преимущества:\n${advantages.map((a) => `• ${a}`).join('\n')}`,
      prevMarkdown,
      'Оффер и УТП.',
    ]),
    schemaHint: schema,
    fallback: { offer: '' },
  });
  const offer = String(data.offer ?? '').trim();
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([`Оффер:\n${offer}`]),
  });
  return { offer, stageMarkdown_offer: stageMarkdown };
}

async function recommendationsStage(context, offer, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.competitors.generateRecommendations;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([context, `Оффер:\n${offer}`, prevMarkdown, 'Рекомендации и growth.']),
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

function buildStages(context) {
  let chain = '';

  return [
    {
      id: 'market_research',
      name: 'Market Research',
      label: 'Исследуем рынок...',
      run: async (ctx) => {
        const out = await marketResearch(context);
        chain = out.stageMarkdown_market ?? '';
        return out;
      },
    },
    {
      id: 'swot_analysis',
      name: 'SWOT Analysis',
      label: 'SWOT-анализ...',
      run: async (ctx) => {
        const out = await swotAnalysis(context, ctx.state.niche, chain);
        chain = out.stageMarkdown_swot ?? chain;
        return out;
      },
    },
    {
      id: 'competitor_advantages',
      name: 'Competitor Advantages',
      label: 'Анализируем конкурентов...',
      run: async (ctx) => {
        const out = await competitorAdvantages(context, ctx.state.niche, ctx.state.swot, chain);
        chain = out.stageMarkdown_advantages ?? chain;
        return out;
      },
    },
    {
      id: 'offer_generation',
      name: 'Offer Generation',
      label: 'Формируем оффер...',
      run: async (ctx) => {
        const out = await offerGeneration(context, ctx.state.niche, ctx.state.advantages, chain);
        chain = out.stageMarkdown_offer ?? chain;
        return out;
      },
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      label: 'Готовим рекомендации...',
      run: async (ctx) => {
        const out = await recommendationsStage(context, ctx.state.offer, chain);
        chain = out.stageMarkdown_recommendations ?? chain;
        return out;
      },
    },
    {
      id: 'final_report',
      name: 'Final Report',
      label: 'Формируем отчёт...',
      run: async (ctx) => {
        const report = await buildFinalReport('competitors', ctx.state);
        return { report, stageMarkdown_final: report };
      },
    },
  ];
}

const PIPELINE_STEPS = getWorkflowMetadata(WORKFLOW_IDS.COMPETITORS).stages.map((s) => ({
  id: s.id,
  label: s.label,
}));

/**
 * @param {{ message?: string; metadata?: object }} input
 */
async function runCompetitorWorkflow(input) {
  const context = buildCompetitorContext(input.message ?? '', input.metadata ?? {});
  const { result } = await runWorkflowPipeline(
    WORKFLOW_IDS.COMPETITORS,
    buildStages(context),
    input
  );
  result.workflow = 'competitors';
  return result;
}

module.exports = {
  runCompetitorWorkflow,
  PIPELINE_STEPS,
};
