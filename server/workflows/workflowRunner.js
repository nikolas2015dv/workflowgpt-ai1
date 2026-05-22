const { WorkflowStepError } = require('../utils/validators');
const { getWorkflowMetadata } = require('./metadata');

/**
 * @typedef {{
 *   currentStage: number;
 *   totalStages: number;
 *   stageName: string;
 *   stageId: string;
 *   progress: number;
 * }} WorkflowProgressState
 */

/**
 * @param {WorkflowProgressState} progress
 */
function logProgress(progress) {
  console.log(
    `[Workflow Stage] ${progress.stageId} (${progress.currentStage}/${progress.totalStages}) — ${progress.stageName} — ${progress.progress}%`
  );
}

/**
 * @param {string} workflowTitle
 * @param {Array<{ id: string; name: string; label: string; run: (ctx: object) => Promise<object> }>} stages
 * @param {object} input
 * @param {(progress: WorkflowProgressState) => void} [onProgress]
 */
async function runWorkflowPipeline(workflowTitle, stages, input, onProgress) {
  const meta = getWorkflowMetadata(workflowTitle);
  const totalStages = stages.length;

  console.log(`[Workflow Engine] Start: ${meta?.id ?? workflowTitle} (${totalStages} stages)`);

  const ctx = {
    input,
    state: {},
    stageOutputs: {},
    progressHistory: [],
  };

  let lastProgress = {
    currentStage: 0,
    totalStages,
    stageName: 'Initializing',
    stageId: 'init',
    progress: 0,
  };

  const emitProgress = (index, stage) => {
    const currentStage = index + 1;
    const progress = {
      currentStage,
      totalStages,
      stageName: stage.name,
      stageId: stage.id,
      progress: Math.min(99, Math.round((currentStage / totalStages) * 100)),
    };
    lastProgress = progress;
    ctx.progressHistory.push({ ...progress, label: stage.label });
    logProgress(progress);
    if (onProgress) onProgress(progress);
    return progress;
  };

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    emitProgress(i, stage);
    const started = Date.now();

    try {
      const output = await stage.run(ctx);
      if (output && typeof output === 'object') {
        Object.assign(ctx.state, output);
        ctx.stageOutputs[stage.id] = output;
      }
      console.log(`[Workflow Engine] ✔ ${stage.id} (${Date.now() - started}ms)`);
    } catch (error) {
      console.error(`[Workflow Engine] ✖ ${stage.id}`, error?.message ?? error);
      throw new WorkflowStepError(stage.id, error);
    }
  }

  const finalProgress = {
    currentStage: totalStages,
    totalStages,
    stageName: 'Complete',
    stageId: 'complete',
    progress: 100,
  };

  console.log(`[Workflow Complete] ${meta?.id ?? workflowTitle}`);
  if (onProgress) onProgress(finalProgress);

  return {
    result: ctx.state,
    stageOutputs: ctx.stageOutputs,
    progress: finalProgress,
    progressHistory: ctx.progressHistory,
    metadata: meta,
    lastProgress,
  };
}

/**
 * @param {string} stepId
 * @param {string} label
 * @param {() => Promise<unknown>} fn
 */
async function runLegacyStep(stepId, label, fn) {
  const started = Date.now();
  console.log(`[Workflow Stage] ${stepId} — ${label}`);
  try {
    const output = await fn();
    console.log(`[Workflow Engine] ✔ ${stepId} (${Date.now() - started}ms)`);
    return output;
  } catch (error) {
    console.error(`[Workflow Engine] ✖ ${stepId}`, error?.message ?? error);
    throw new WorkflowStepError(stepId, error);
  }
}

module.exports = {
  runWorkflowPipeline,
  runLegacyStep,
};
