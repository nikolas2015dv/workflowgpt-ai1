const { STEP_PROMPTS } = require('../utils/prompts');
const { createJsonCompletion, extractLegalDocumentText } = require('../services/openaiService');
const {
  appendBlocks,
  truncateText,
  ensureStringArray,
} = require('../services/parserService');

/**
 * @param {{ documentText?: string; imageBuffer?: Buffer; mimeType?: string; note?: string }} input
 */
async function parseDocument(input) {
  if (input.imageBuffer && input.mimeType) {
    const text = await extractLegalDocumentText(input.imageBuffer, input.mimeType, input.note ?? '');
    return { documentText: text };
  }

  const doc = truncateText(input.documentText ?? '');
  if (!doc.trim()) throw new Error('Нет текста договора для анализа');

  const { schema, system } = STEP_PROMPTS.legal.parseDocument;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: `Структурируй договор:\n\n${doc}`,
    schemaHint: schema,
    fallback: { structuredText: doc },
  });

  return { documentText: String(data.structuredText ?? doc).trim() };
}

/**
 * @param {string} documentText
 */
async function summarizeContract(documentText) {
  const { schema, system } = STEP_PROMPTS.legal.summarizeContract;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: `Документ:\n${truncateText(documentText)}`,
    schemaHint: schema,
    fallback: { summary: '' },
  });
  return { summary: String(data.summary ?? '').trim() };
}

/**
 * @param {string} documentText
 * @param {string} summary
 */
async function identifyRisks(documentText, summary) {
  const { schema, system } = STEP_PROMPTS.legal.identifyRisks;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Документ:\n${truncateText(documentText)}`,
      `Резюме:\n${summary}`,
      'Перечисли юридические риски и последствия.',
    ]),
    schemaHint: schema,
    fallback: { risks: [] },
  });
  return { risks: ensureStringArray(data.risks) };
}

/**
 * @param {string} documentText
 * @param {string[]} risks
 */
async function detectRedFlags(documentText, risks) {
  const { schema, system } = STEP_PROMPTS.legal.detectRedFlags;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Документ:\n${truncateText(documentText)}`,
      `Риски:\n${risks.map((r) => `• ${r}`).join('\n')}`,
      'Выяви красные флаги.',
    ]),
    schemaHint: schema,
    fallback: { redFlags: [] },
  });
  return { redFlags: ensureStringArray(data.redFlags) };
}

/**
 * @param {string} summary
 * @param {string[]} risks
 * @param {string[]} redFlags
 */
async function generateRecommendations(summary, risks, redFlags) {
  const { schema, system } = STEP_PROMPTS.legal.generateRecommendations;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Резюме:\n${summary}`,
      `Риски:\n${risks.map((r) => `• ${r}`).join('\n')}`,
      `Красные флаги:\n${redFlags.map((r) => `• ${r}`).join('\n')}`,
      'Рекомендации по договору.',
    ]),
    schemaHint: schema,
    fallback: { recommendations: [] },
  });
  return { recommendations: ensureStringArray(data.recommendations) };
}

const PIPELINE_STEPS = [
  { id: 'parse_document', label: 'Разбираем документ...' },
  { id: 'summarize_contract', label: 'Составляем резюме...' },
  { id: 'identify_risks', label: 'Выявляем риски...' },
  { id: 'detect_red_flags', label: 'Ищем красные флаги...' },
  { id: 'generate_recommendations', label: 'Формируем рекомендации...' },
];

/**
 * @param {object} input
 * @param {Function} [runStep]
 */
async function runLegalWorkflow(input, runStep) {
  const exec = runStep ?? (async (_id, _label, fn) => fn());
  const note = input.note ?? '';

  const { documentText } = await exec('parse_document', PIPELINE_STEPS[0].label, () =>
    parseDocument({
      documentText: input.documentText ?? input.message ?? '',
      imageBuffer: input.imageBuffer,
      mimeType: input.mimeType,
      note,
    })
  );

  const { summary } = await exec('summarize_contract', PIPELINE_STEPS[1].label, () =>
    summarizeContract(documentText)
  );
  const { risks } = await exec('identify_risks', PIPELINE_STEPS[2].label, () =>
    identifyRisks(documentText, summary)
  );
  const { redFlags } = await exec('detect_red_flags', PIPELINE_STEPS[3].label, () =>
    detectRedFlags(documentText, risks)
  );
  const { recommendations } = await exec('generate_recommendations', PIPELINE_STEPS[4].label, () =>
    generateRecommendations(summary, risks, redFlags)
  );

  return { summary, risks, redFlags, recommendations };
}

module.exports = {
  runLegalWorkflow,
  PIPELINE_STEPS,
  parseDocument,
  summarizeContract,
  identifyRisks,
  detectRedFlags,
  generateRecommendations,
};
