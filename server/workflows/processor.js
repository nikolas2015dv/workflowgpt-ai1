const { WORKFLOW_IDS } = require('./config');
const { runWorkflowPipeline } = require('../services/workflowEngine');
const { validateTextInput, requireUploadSupport } = require('../utils/validators');
const {
  extractTextFromFile,
  ExtractTextError,
  isImageFile,
  getImageMimeType,
} = require('../fileProcessing/extract');
const { extractLegalDocumentText } = require('../services/openaiService');

function parseMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * @param {{ workflow: string; message?: string; metadata?: object | string }} params
 */
async function processTextRequest({ workflow, message = '', metadata }) {
  const meta = parseMetadata(metadata);
  const trimmed = typeof message === 'string' ? message.trim() : '';

  validateTextInput(workflow, { message: trimmed, metadata: meta });

  return runWorkflowPipeline(workflow, { message: trimmed, metadata: meta });
}

/**
 * @param {{ workflow: string; file: Express.Multer.File; note?: string; metadata?: object | string }} params
 */
async function processFileUpload({ workflow, file, note = '', metadata }) {
  requireUploadSupport(workflow);

  const meta = parseMetadata(metadata);
  const noteText = typeof note === 'string' ? note.trim() : '';

  if (workflow === WORKFLOW_IDS.CONTRACT) {
    if (isImageFile(file.originalname)) {
      return runWorkflowPipeline(workflow, {
        imageBuffer: file.buffer,
        mimeType: getImageMimeType(file.originalname),
        note: noteText,
        metadata: meta,
      });
    }

    const documentText = await extractTextFromFile(file.buffer, file.originalname, workflow);
    const payload = noteText
      ? `${documentText}\n\n---\n\nДополнительный контекст:\n${noteText}`
      : documentText;

    return runWorkflowPipeline(workflow, {
      documentText: payload,
      message: payload,
      note: noteText,
      metadata: meta,
    });
  }

  if (workflow === WORKFLOW_IDS.COMPETITORS) {
    let extracted;
    if (isImageFile(file.originalname)) {
      extracted = await extractLegalDocumentText(
        file.buffer,
        getImageMimeType(file.originalname),
        noteText
      );
    } else {
      extracted = await extractTextFromFile(file.buffer, file.originalname, workflow);
    }
    const payload = noteText
      ? `${extracted}\n\n---\n\nДополнительный контекст из файла:\n${noteText}`
      : extracted;

    return runWorkflowPipeline(workflow, {
      message: payload,
      metadata: meta,
    });
  }

  if (workflow === WORKFLOW_IDS.DATA) {
    const extracted = await extractTextFromFile(file.buffer, file.originalname, workflow);
    const payload = noteText
      ? `${extracted}\n\n---\n\nДополнительный контекст:\n${noteText}`
      : extracted;

    return runWorkflowPipeline(workflow, {
      documentText: payload,
      message: payload,
      note: noteText,
      metadata: meta,
    });
  }

  throw new ExtractTextError('UNSUPPORTED_FORMAT', `Загрузка файлов не поддерживается для "${workflow}"`);
}

module.exports = {
  processTextRequest,
  processFileUpload,
  parseMetadata,
  WORKFLOW_IDS,
};
