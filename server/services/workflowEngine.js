const { WORKFLOW_IDS } = require('../workflows/config');
const { WorkflowStepError } = require('../utils/validators');
const {
  getWorkflowSlug,
  getSectionsForSlug,
  formatWorkflowReply,
} = require('../utils/formatters');
const { runCompetitorWorkflow, PIPELINE_STEPS: COMPETITOR_STEPS } = require('../workflows/competitorWorkflow');
const { runLegalWorkflow, PIPELINE_STEPS: LEGAL_STEPS } = require('../workflows/legalWorkflow');
const { runAnalyticsWorkflow, PIPELINE_STEPS: ANALYTICS_STEPS } = require('../workflows/analyticsWorkflow');

const PIPELINE_BY_WORKFLOW = {
  [WORKFLOW_IDS.COMPETITORS]: { run: runCompetitorWorkflow, steps: COMPETITOR_STEPS },
  [WORKFLOW_IDS.CONTRACT]: { run: runLegalWorkflow, steps: LEGAL_STEPS },
  [WORKFLOW_IDS.DATA]: { run: runAnalyticsWorkflow, steps: ANALYTICS_STEPS },
};

/**
 * @param {string} stepId
 * @param {string} label
 * @param {() => Promise<unknown>} fn
 */
async function runStep(stepId, label, fn) {
  const started = Date.now();
  console.log(`[WorkflowEngine] ▶ ${stepId} — ${label}`);
  try {
    const output = await fn();
    console.log(`[WorkflowEngine] ✔ ${stepId} (${Date.now() - started}ms)`);
    return output;
  } catch (error) {
    console.error(`[WorkflowEngine] ✖ ${stepId}`, error?.message ?? error);
    throw new WorkflowStepError(stepId, error);
  }
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
  console.log(`[WorkflowEngine] Запуск pipeline: ${slug}`);

  const result = await pipeline.run(input, runStep);
  result.workflow = slug;

  return result;
}

/**
 * @param {string} workflowTitle
 * @param {object} input
 */
async function runWorkflowPipeline(workflowTitle, input) {
  const slug = getWorkflowSlug(workflowTitle);
  const result = await executeWorkflow(workflowTitle, input);
  const sections = getSectionsForSlug(slug);
  const stepDefs = PIPELINE_BY_WORKFLOW[workflowTitle]?.steps ?? [];

  return {
    workflow: workflowTitle,
    workflowSlug: slug,
    result,
    reply: formatWorkflowReply(workflowTitle, result),
    steps: stepDefs.map((s) => s.label),
    stepIds: stepDefs.map((s) => s.id),
    sections,
  };
}

function getPipelineSteps(workflowTitle) {
  return PIPELINE_BY_WORKFLOW[workflowTitle]?.steps ?? [];
}

module.exports = {
  runStep,
  executeWorkflow,
  runWorkflowPipeline,
  getPipelineSteps,
  PIPELINE_BY_WORKFLOW,
};
