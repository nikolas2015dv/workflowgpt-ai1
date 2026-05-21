const OpenAI = require('openai');
const { PROFILE_PROMPTS, VISION_EXTRACT_PROMPT } = require('../utils/prompts');
const { parseJsonFromAi } = require('./parserService');

const MODEL = 'gpt-4o-mini';
const VISION_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

let client;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error) {
  const status = error?.status ?? error?.statusCode;
  if (status === 429 || status === 500 || status === 502 || status === 503) return true;
  const code = error?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
}

/**
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES || !isRetryableError(error)) throw error;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}

/**
 * @param {Promise<T>} promise
 * @param {number} ms
 */
function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`OpenAI request timeout (${ms}ms)`)), ms);
    }),
  ]);
}

/**
 * @param {{
 *   systemPrompt: string;
 *   userPrompt: string;
 *   temperature?: number;
 *   maxTokens?: number;
 *   jsonMode?: boolean;
 * }} params
 */
async function createCompletion({
  systemPrompt,
  userPrompt,
  temperature = DEFAULT_TEMPERATURE,
  maxTokens = 1800,
  jsonMode = false,
}) {
  const openai = getClient();

  const request = () =>
    openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });

  const completion = await withRetry(() => withTimeout(request()));
  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI returned an empty response');
  return content;
}

/**
 * @param {{
 *   systemPrompt: string;
 *   userPrompt: string;
 *   schemaHint: string;
 *   fallback?: object;
 *   maxTokens?: number;
 * }} params
 */
async function createJsonCompletion({ systemPrompt, userPrompt, schemaHint, fallback = {}, maxTokens }) {
  const prompt = `${userPrompt}\n\nФормат ответа (JSON):\n${schemaHint}`;
  const raw = await createCompletion({
    systemPrompt,
    userPrompt: prompt,
    maxTokens: maxTokens ?? 2000,
    jsonMode: true,
    temperature: 0.5,
  });
  return parseJsonFromAi(raw, fallback);
}

/**
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {string} [note]
 */
async function extractLegalDocumentText(imageBuffer, mimeType, note = '') {
  const openai = getClient();
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const textPart = VISION_EXTRACT_PROMPT + (note ? `\n\nКонтекст:\n${note}` : '');

  const request = () =>
    openai.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: textPart },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

  const completion = await withRetry(() => withTimeout(request(), 180000));
  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) throw new Error('OpenAI Vision returned an empty response');
  return reply;
}

module.exports = {
  getClient,
  createCompletion,
  createJsonCompletion,
  extractLegalDocumentText,
  MODEL,
  VISION_MODEL,
  DEFAULT_TEMPERATURE,
};
