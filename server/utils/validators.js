const { WORKFLOW_IDS, normalizeWorkflow, supportsUpload } = require('../workflows/config');

class WorkflowValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'WorkflowValidationError';
    this.code = code;
  }
}

class WorkflowStepError extends Error {
  constructor(stepId, cause) {
    super(cause?.message ?? `Workflow step "${stepId}" failed`);
    this.name = 'WorkflowStepError';
    this.stepId = stepId;
    this.cause = cause;
  }
}

/**
 * @param {unknown} workflow
 */
function requireWorkflow(workflow) {
  const normalized = normalizeWorkflow(workflow);
  if (!normalized) {
    throw new WorkflowValidationError(`Unknown workflow: ${workflow}`, 'UNKNOWN_WORKFLOW');
  }
  return normalized;
}

/**
 * @param {string} workflow
 * @param {{ message?: string; metadata?: object }} input
 */
function validateTextInput(workflow, input) {
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const meta = input.metadata ?? {};

  if (workflow === WORKFLOW_IDS.COMPETITORS) {
    const hasMeta = meta.companyName || meta.website || meta.instagram || meta.telegram;
    if (!message && !hasMeta) {
      throw new WorkflowValidationError('Укажите данные компании или ссылки для анализа');
    }
    return;
  }

  if (!message) {
    throw new WorkflowValidationError('Поле message обязательно для этого workflow');
  }
}

/**
 * @param {string} workflow
 */
function requireUploadSupport(workflow) {
  if (!supportsUpload(workflow)) {
    throw new WorkflowValidationError(`Workflow "${workflow}" не поддерживает загрузку файлов`);
  }
}

module.exports = {
  WorkflowValidationError,
  WorkflowStepError,
  requireWorkflow,
  validateTextInput,
  requireUploadSupport,
};
