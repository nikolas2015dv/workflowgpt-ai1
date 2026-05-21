const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const {
  getUploadExtensions,
  isImageExtension,
  WORKFLOW_IDS,
} = require('../workflows/config');

const MAX_EXTRACTED_CHARS = 80000;

class ExtractTextError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'ExtractTextError';
  }
}

function getExtension(filename) {
  return path.extname(filename).toLowerCase();
}

function truncateText(text) {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[...данные обрезаны для анализа...]`;
}

function extractCsv(buffer) {
  return buffer.toString('utf-8');
}

function extractXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return `## Лист: ${name}\n${csv}`;
  }).join('\n\n');
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} [workflow]
 */
async function extractTextFromFile(buffer, filename, workflow) {
  const ext = getExtension(filename);
  const allowed = workflow ? getUploadExtensions(workflow) : [
    '.txt', '.docx', '.pdf', '.csv', '.xlsx', '.xls',
  ];

  if (!allowed.includes(ext)) {
    throw new ExtractTextError(
      'UNSUPPORTED_FORMAT',
      `Неподдерживаемый формат для этого workflow: ${ext}`
    );
  }

  if (!buffer?.length) {
    throw new ExtractTextError('EMPTY_FILE', 'Файл пустой');
  }

  if (isImageExtension(ext)) {
    throw new ExtractTextError('IMAGE_FILE', 'Изображение обрабатывается через Vision API');
  }

  try {
    let text = '';

    if (ext === '.txt' || ext === '.csv') {
      text = ext === '.csv' ? extractCsv(buffer) : buffer.toString('utf-8');
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value ?? '';
    } else if (ext === '.pdf') {
      const result = await pdfParse(buffer);
      text = result.text ?? '';
    } else if (ext === '.xlsx' || ext === '.xls') {
      text = extractXlsx(buffer);
    }

    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      throw new ExtractTextError('EMPTY_FILE', 'Не удалось извлечь данные из файла');
    }

    return truncateText(normalized);
  } catch (error) {
    if (error instanceof ExtractTextError) throw error;
    throw new ExtractTextError('PARSE_FAILED', `Ошибка чтения файла: ${error.message ?? 'parse failed'}`);
  }
}

function isImageFile(filename) {
  return isImageExtension(getExtension(filename));
}

function getImageMimeType(filename) {
  const ext = getExtension(filename);
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/jpeg';
}

module.exports = {
  extractTextFromFile,
  ExtractTextError,
  isImageFile,
  getImageMimeType,
  getExtension,
  WORKFLOW_IDS,
};
