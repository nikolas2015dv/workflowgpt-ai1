const { WORKFLOW_IDS } = require('../workflows/config');
const {
  getWorkflowSlug,
  getSectionsForSlug,
  formatWorkflowReply,
} = require('../utils/formatters');
const { getWorkflowMetadata, listWorkflowMetadata } = require('../workflows/metadata');
const { runCompetitorWorkflow, PIPELINE_STEPS: COMPETITOR_STEPS } = require('../workflows/competitorWorkflow');
const { runLegalWorkflow, PIPELINE_STEPS: LEGAL_STEPS } = require('../workflows/legalWorkflow');
const { runAnalyticsWorkflow, PIPELINE_STEPS: ANALYTICS_STEPS } = require('../workflows/analyticsWorkflow');

const PIPELINE_BY_WORKFLOW = {
  [WORKFLOW_IDS.COMPETITORS]: { run: runCompetitorWorkflow, steps: COMPETITOR_STEPS },
  [WORKFLOW_IDS.CONTRACT]: { run: runLegalWorkflow, steps: LEGAL_STEPS },
  [WORKFLOW_IDS.DATA]: { run: runAnalyticsWorkflow, steps: ANALYTICS_STEPS },
};

/**
 * @param {object} state
 */
function sanitizePipelineResult(state) {
  const result = { ...state };
  for (const key of Object.keys(result)) {
    if (key.startsWith('stageMarkdown_')) delete result[key];
  }
  return result;
}

/**
 * @param {string} workflowTitle
 * @param {object} input
 */
async function executeWorkflow(workflowTitle, input) {
  const pipeline = PIPELINE_BY_WORKFLOW[workflowTitle];
  if (!pipeline) {
    throw new Error(`Workflow "${workflowTitle}" не поддерживает pipeline`);
  }

  const slug = getWorkflowSlug(workflowTitle);
  console.log(`[Workflow Engine] Pipeline: ${slug}`);

  const raw = await pipeline.run(input);
  const result = sanitizePipelineResult(raw);
  if (!result.workflow) result.workflow = slug;

  return result;
}

/**
 * @param {string} workflowTitle
 * @param {object} input
 */
async function runWorkflowPipeline(workflowTitle, input) {
  const slug = getWorkflowSlug(workflowTitle);
  const meta = getWorkflowMetadata(workflowTitle);
  const result = await executeWorkflow(workflowTitle, input);
  const stepDefs = PIPELINE_BY_WORKFLOW[workflowTitle]?.steps ?? meta?.stages ?? [];
  const sections = getSectionsForSlug(slug);

  const report =
    typeof result.report === 'string' && result.report.trim()
      ? result.report.trim()
      : formatWorkflowReply(workflowTitle, result);

  const progress = {
    currentStage: stepDefs.length,
    totalStages: stepDefs.length,
    stageName: 'Complete',
    progress: 100,
  };

  return {
    workflow: workflowTitle,
    workflowSlug: slug,
    result,
    report,
    reply: report,
    steps: stepDefs.map((s) => s.label),
    stepIds: stepDefs.map((s) => s.id),
    sections,
    progress,
    metadata: meta
      ? {
          id: meta.id,
          title: meta.title,
          description: meta.description,
          estimatedDuration: meta.estimatedDuration,
          stages: meta.stages,
        }
      : undefined,
    engineVersion: '2.0',
  };
}

function getPipelineSteps(workflowTitle) {
  return PIPELINE_BY_WORKFLOW[workflowTitle]?.steps ?? getWorkflowMetadata(workflowTitle)?.stages ?? [];
}

module.exports = {
  executeWorkflow,
  runWorkflowPipeline,
  getPipelineSteps,
  listWorkflowMetadata,
  PIPELINE_BY_WORKFLOW,
};
