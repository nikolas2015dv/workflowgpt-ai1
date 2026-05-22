const { STEP_PROMPTS } = require('../utils/prompts');
const { createJsonCompletion, createMarkdownCompletion, extractLegalDocumentText } = require('../services/openaiService');
const { buildFinalReport } = require('../utils/reportBuilder');
const { getWorkflowMetadata } = require('./metadata');
const { runWorkflowPipeline } = require('./workflowRunner');
const { WORKFLOW_IDS } = require('./config');
const {
  appendBlocks,
  truncateText,
  ensureStringArray,
} = require('../services/parserService');

async function documentParsing(input) {
  if (input.imageBuffer && input.mimeType) {
    const text = await extractLegalDocumentText(input.imageBuffer, input.mimeType, input.note ?? '');
    return { documentText: text, summary: text.slice(0, 1500) };
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

  const documentText = String(data.structuredText ?? doc).trim();
  const { schema: sumSchema, system: sumSystem } = STEP_PROMPTS.legal.summarizeContract;
  const summaryData = await createJsonCompletion({
    systemPrompt: sumSystem,
    userPrompt: `Документ:\n${truncateText(documentText)}`,
    schemaHint: sumSchema,
    fallback: { summary: '' },
  });

  const summary = String(summaryData.summary ?? '').trim();
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: sumSystem,
    userPrompt: appendBlocks([`Документ (фрагмент):\n${truncateText(documentText, 6000)}`, `Резюме:\n${summary}`]),
  });

  return { documentText, summary, stageMarkdown_parse: stageMarkdown };
}

async function legalRiskDetection(documentText, summary, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.legal.identifyRisks;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Документ:\n${truncateText(documentText)}`,
      `Резюме:\n${summary}`,
      prevMarkdown,
      'Юридические риски и последствия.',
    ]),
    schemaHint: schema,
    fallback: { risks: [] },
  });
  const risks = ensureStringArray(data.risks);
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([`Риски:\n${risks.map((r) => `• ${r}`).join('\n')}`]),
  });
  return { risks, stageMarkdown_risks: stageMarkdown };
}

async function redFlagsStage(documentText, risks, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.legal.detectRedFlags;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Документ:\n${truncateText(documentText)}`,
      `Риски:\n${risks.map((r) => `• ${r}`).join('\n')}`,
      prevMarkdown,
      'Красные флаги.',
    ]),
    schemaHint: schema,
    fallback: { redFlags: [] },
  });
  const redFlags = ensureStringArray(data.redFlags);
  const stageMarkdown = await createMarkdownCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([`Красные флаги:\n${redFlags.map((r) => `• ${r}`).join('\n')}`]),
  });
  return { redFlags, stageMarkdown_redFlags: stageMarkdown };
}

async function recommendationsStage(summary, risks, redFlags, prevMarkdown) {
  const { schema, system } = STEP_PROMPTS.legal.generateRecommendations;
  const data = await createJsonCompletion({
    systemPrompt: system,
    userPrompt: appendBlocks([
      `Резюме:\n${summary}`,
      `Риски:\n${risks.map((r) => `• ${r}`).join('\n')}`,
      `Красные флаги:\n${redFlags.map((r) => `• ${r}`).join('\n')}`,
      prevMarkdown,
      'Рекомендации по договору.',
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

function buildStages(workflowInput) {
  let chain = '';

  return [
    {
      id: 'document_parsing',
      name: 'Document Parsing',
      label: 'Разбираем документ...',
      run: async () => {
        const out = await documentParsing(workflowInput);
        chain = out.stageMarkdown_parse ?? '';
        return out;
      },
    },
    {
      id: 'legal_risk_detection',
      name: 'Legal Risk Detection',
      label: 'Выявляем риски...',
      run: async (ctx) => {
        const out = await legalRiskDetection(ctx.state.documentText, ctx.state.summary, chain);
        chain = out.stageMarkdown_risks ?? chain;
        return out;
      },
    },
    {
      id: 'red_flags',
      name: 'Red Flags',
      label: 'Ищем красные флаги...',
      run: async (ctx) => {
        const out = await redFlagsStage(ctx.state.documentText, ctx.state.risks, chain);
        chain = out.stageMarkdown_redFlags ?? chain;
        return out;
      },
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      label: 'Формируем рекомендации...',
      run: async (ctx) => {
        const out = await recommendationsStage(
          ctx.state.summary,
          ctx.state.risks,
          ctx.state.redFlags,
          chain
        );
        chain = out.stageMarkdown_recommendations ?? chain;
        return out;
      },
    },
    {
      id: 'final_report',
      name: 'Final Legal Report',
      label: 'Собираем юридический отчёт...',
      run: async (ctx) => {
        const report = await buildFinalReport('legal', ctx.state);
        return { report, stageMarkdown_final: report };
      },
    },
  ];
}

const PIPELINE_STEPS = getWorkflowMetadata(WORKFLOW_IDS.CONTRACT).stages.map((s) => ({
  id: s.id,
  label: s.label,
}));

/**
 * @param {object} input
 */
async function runLegalWorkflow(input) {
  const note = input.note ?? '';
  const workflowInput = {
    documentText: input.documentText ?? input.message ?? '',
    imageBuffer: input.imageBuffer,
    mimeType: input.mimeType,
    note,
  };

  const { result } = await runWorkflowPipeline(
    WORKFLOW_IDS.CONTRACT,
    buildStages(workflowInput),
    input
  );
  result.workflow = 'legal';
  return result;
}

module.exports = {
  runLegalWorkflow,
  PIPELINE_STEPS,
};
