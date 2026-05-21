const path = require('path');
const multer = require('multer');
const { getUploadExtensions, getAllUploadExtensions } = require('./workflows/config');

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Multer must run before req.body fields are available — accept all upload extensions.
 */
const universalUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = getAllUploadExtensions();

    if (allowed.has(ext)) {
      cb(null, true);
      return;
    }

    const error = new Error(
      `Неподдерживаемый формат (${ext}). Разрешено: ${[...allowed].join(', ')}`
    );
    error.code = 'UNSUPPORTED_FORMAT';
    cb(error);
  },
});

/**
 * @param {string} workflow
 */
function createWorkflowUpload(workflow) {
  const allowed = new Set(getUploadExtensions(workflow));

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.has(ext)) {
        cb(null, true);
        return;
      }
      const error = new Error(
        `Неподдерживаемый формат (${ext}). Разрешено: ${[...allowed].join(', ')}`
      );
      error.code = 'UNSUPPORTED_FORMAT';
      cb(error);
    },
  });
}

module.exports = { universalUpload, createWorkflowUpload, MAX_FILE_SIZE };
