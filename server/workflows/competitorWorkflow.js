const { STEP_PROMPTS } = require('../utils/prompts');
const { createJsonCompletion } = require('../services/openaiService');
const {
  buildCompetitorContext,
  appendBlocks,
  ensureStringArray,
  ensureSwot,
} = require('../services/parserService');

/**
 * @param {string} context
 */
async function detectNiche(context) {
  const { schema, system } = STEP_PROMPTS.competitors.detectNiche;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: `${context}\n\nОпредели нишу бизнеса по названию, описанию, ссылкам и username.`,
    schemaHint: schema,
    fallback: { niche: '' },
  });
  return { niche: String(data.niche ?? data._raw ?? '').trim() };
}

/**
 * @param {string} context
 * @param {string} niche
 */
async function generateSWOT(context, niche) {
  const { schema, system } = STEP_PROMPTS.competitors.generateSWOT;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([context, `Ниша:\n${niche}`, 'Построй SWOT-анализ конкурента.']),
    schemaHint: schema,
    fallback: { swot: ensureSwot(null) },
  });
  return { swot: ensureSwot(data.swot) };
}

/**
 * @param {string} context
 * @param {string} niche
 * @param {object} swot
 */
async function identifyAdvantages(context, niche, swot) {
  const { schema, system } = STEP_PROMPTS.competitors.identifyAdvantages;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      context,
      `Ниша:\n${niche}`,
      `SWOT:\n${JSON.stringify(swot, null, 2)}`,
      'Определи преимущества, слабые места и точки дифференциации.',
    ]),
    schemaHint: schema,
    fallback: { advantages: [] },
  });
  return { advantages: ensureStringArray(data.advantages) };
}

/**
 * @param {string} context
 * @param {string} niche
 * @param {string[]} advantages
 */
async function generateOffer(context, niche, advantages) {
  const { schema, system } = STEP_PROMPTS.competitors.generateOffer;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      context,
      `Ниша:\n${niche}`,
      `Преимущества:\n${advantages.map((a) => `• ${a}`).join('\n')}`,
      'Сформируй оффер, позиционирование и УТП.',
    ]),
    schemaHint: schema,
    fallback: { offer: '' },
  });
  return { offer: String(data.offer ?? '').trim() };
}

/**
 * @param {string} context
 * @param {string} offer
 */
async function generateRecommendations(context, offer) {
  const { schema, system } = STEP_PROMPTS.competitors.generateRecommendations;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      context,
      `Оффер:\n${offer}`,
      'Дай рекомендации, growth ideas и улучшения маркетинга.',
    ]),
    schemaHint: schema,
    fallback: { recommendations: [] },
  });
  return { recommendations: ensureStringArray(data.recommendations) };
}

const PIPELINE_STEPS = [
  { id: 'detect_niche', label: 'Определяем нишу...' },
  { id: 'generate_swot', label: 'Делаем SWOT-анализ...' },
  { id: 'identify_advantages', label: 'Ищем преимущества...' },
  { id: 'generate_offer', label: 'Формируем оффер...' },
  { id: 'generate_recommendations', label: 'Готовим рекомендации...' },
];

/**
 * @param {{ message?: string; metadata?: object }} input
 * @param {typeof import('../services/workflowEngine').runStep} [runStep]
 */
async function runCompetitorWorkflow(input, runStep) {
  const exec = runStep ?? (async (_id, _label, fn) => fn());
  const context = buildCompetitorContext(input.message ?? '', input.metadata ?? {});

  const { niche } = await exec('detect_niche', PIPELINE_STEPS[0].label, () => detectNiche(context));
  const { swot } = await exec('generate_swot', PIPELINE_STEPS[1].label, () => generateSWOT(context, niche));
  const { advantages } = await exec('identify_advantages', PIPELINE_STEPS[2].label, () =>
    identifyAdvantages(context, niche, swot)
  );
  const { offer } = await exec('generate_offer', PIPELINE_STEPS[3].label, () =>
    generateOffer(context, niche, advantages)
  );
  const { recommendations } = await exec('generate_recommendations', PIPELINE_STEPS[4].label, () =>
    generateRecommendations(context, offer)
  );

  return { niche, swot, advantages, offer, recommendations };
}

module.exports = {
  runCompetitorWorkflow,
  PIPELINE_STEPS,
  detectNiche,
  generateSWOT,
  identifyAdvantages,
  generateOffer,
  generateRecommendations,
};
