const MAX_DOC_CHARS = 28000;
const MAX_DATA_CHARS = 28000;

/**
 * @param {string} raw
 * @param {object} [fallback]
 */
function parseJsonFromAi(raw, fallback = {}) {
  if (!raw || typeof raw !== 'string') return { ...fallback };

  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;

  try {
    return { ...fallback, ...JSON.parse(candidate) };
  } catch {
    return { ...fallback, _raw: trimmed };
  }
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function ensureStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n+/)
      .map((s) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * @param {unknown} value
 */
function ensureSwot(value) {
  const empty = { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  if (!value || typeof value !== 'object') return empty;
  return {
    strengths: ensureStringArray(value.strengths),
    weaknesses: ensureStringArray(value.weaknesses),
    opportunities: ensureStringArray(value.opportunities),
    threats: ensureStringArray(value.threats),
  };
}

/**
 * @param {string} text
 * @param {number} [max]
 */
function truncateText(text, max = MAX_DOC_CHARS) {
  if (!text || text.length <= max) return text ?? '';
  return `${text.slice(0, max)}\n\n[... обрезано для анализа ...]`;
}

/**
 * @param {string} message
 * @param {object} [metadata]
 */
function buildCompetitorContext(message = '', metadata = {}) {
  const lines = ['Данные для конкурентного анализа:', ''];

  if (metadata.companyName) lines.push(`Название: ${metadata.companyName}`);
  if (metadata.website) lines.push(`Website: ${metadata.website}`);
  if (metadata.instagram) lines.push(`Instagram: ${metadata.instagram}`);
  if (metadata.telegram) lines.push(`Telegram: ${metadata.telegram}`);

  if (message?.trim()) {
    lines.push('', 'Контекст от пользователя:', message.trim());
  }

  return lines.join('\n');
}

function appendBlocks(parts) {
  return parts.filter(Boolean).join('\n\n---\n\n');
}

const fileExtract = require('../fileProcessing/extract');

module.exports = {
  parseJsonFromAi,
  ensureStringArray,
  ensureSwot,
  truncateText,
  truncateData: (t) => truncateText(t, MAX_DATA_CHARS),
  buildCompetitorContext,
  appendBlocks,
  MAX_DOC_CHARS,
  extractTextFromFile: fileExtract.extractTextFromFile,
  ExtractTextError: fileExtract.ExtractTextError,
  isImageFile: fileExtract.isImageFile,
  getImageMimeType: fileExtract.getImageMimeType,
};
