const WORKFLOW_IDS = {
  COMPETITORS: 'Анализ конкурентов',
  CONTRACT: 'Анализ договора',
  DATA: 'Анализ данных',
};

const { PROFILE_PROMPTS } = require('../utils/prompts');

/** @type {Record<string, 'marketing' | 'legal' | 'analyst' | 'default'>} */
const WORKFLOW_PROFILE_MAP = {
  [WORKFLOW_IDS.COMPETITORS]: 'marketing',
  [WORKFLOW_IDS.CONTRACT]: 'legal',
  [WORKFLOW_IDS.DATA]: 'analyst',
};

const LEGAL_DOC_EXTENSIONS = ['.txt', '.docx', '.pdf'];
const LEGAL_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const ANALYTICS_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.txt', '.docx', '.pdf'];

/** @type {Record<string, { profile: string; uploadExtensions?: string[]; imageExtensions?: string[]; maxTokens: number }>} */
const COMPETITOR_UPLOAD_EXTENSIONS = [
  '.txt',
  '.docx',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.xlsx',
  '.csv',
];

const WORKFLOW_RULES = {
  [WORKFLOW_IDS.COMPETITORS]: {
    profile: 'marketing',
    uploadExtensions: COMPETITOR_UPLOAD_EXTENSIONS,
    maxTokens: 4096,
  },
  [WORKFLOW_IDS.CONTRACT]: {
    profile: 'legal',
    uploadExtensions: [...LEGAL_DOC_EXTENSIONS, ...LEGAL_IMAGE_EXTENSIONS],
    imageExtensions: LEGAL_IMAGE_EXTENSIONS,
    maxTokens: 4096,
  },
  [WORKFLOW_IDS.DATA]: {
    profile: 'analyst',
    uploadExtensions: ANALYTICS_EXTENSIONS,
    maxTokens: 4096,
  },
};

function getWorkflowRules(workflow) {
  return WORKFLOW_RULES[workflow] ?? { profile: 'default', maxTokens: 1024 };
}

function getProfile(workflow) {
  return WORKFLOW_PROFILE_MAP[workflow] ?? 'default';
}

function supportsUpload(workflow) {
  const rules = WORKFLOW_RULES[workflow];
  return Boolean(rules?.uploadExtensions?.length);
}

function getUploadExtensions(workflow) {
  return WORKFLOW_RULES[workflow]?.uploadExtensions ?? [];
}

function isImageExtension(ext) {
  return LEGAL_IMAGE_EXTENSIONS.includes(ext);
}

/** Short aliases from API / clients */
const WORKFLOW_ALIASES = {
  legal: WORKFLOW_IDS.CONTRACT,
  competitors: WORKFLOW_IDS.COMPETITORS,
  analytics: WORKFLOW_IDS.DATA,
};

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeWorkflow(raw) {
  if (!raw || typeof raw !== 'string') return '';

  const trimmed = raw.trim();
  const alias = WORKFLOW_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  if (WORKFLOW_RULES[trimmed]) return trimmed;

  return '';
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function resolveWorkflowForUpload(raw) {
  const workflow = normalizeWorkflow(raw);
  if (!workflow) return null;
  if (!supportsUpload(workflow)) return null;
  return workflow;
}

function getAllUploadExtensions() {
  const set = new Set();
  Object.values(WORKFLOW_RULES).forEach((rules) => {
    rules.uploadExtensions?.forEach((ext) => set.add(ext));
  });
  return set;
}

module.exports = {
  WORKFLOW_IDS,
  WORKFLOW_RULES,
  PROFILE_PROMPTS,
  WORKFLOW_ALIASES,
  getWorkflowRules,
  getProfile,
  supportsUpload,
  getUploadExtensions,
  normalizeWorkflow,
  resolveWorkflowForUpload,
  getAllUploadExtensions,
  isImageExtension,
  LEGAL_IMAGE_EXTENSIONS,
};
