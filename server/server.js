const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const { ExtractTextError } = require('./fileProcessing/extract');
const { universalUpload, MAX_FILE_SIZE } = require('./upload');
const { resolveWorkflowForUpload, normalizeWorkflow, WORKFLOW_IDS } = require('./workflows/config');
const { processTextRequest, processFileUpload } = require('./workflows/processor');
const { WorkflowStepError, WorkflowValidationError, requireWorkflow } = require('./utils/validators');
const { buildExport } = require('./services/exportService');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT) || 3001;
const app = express();

app.use(cors());
app.use(express.json({ limit: '4mb' }));

function handleOpenAiError(error, res) {
  if (error.message === 'OPENAI_API_KEY is not configured') {
    return res.status(500).json({
      error: 'Configuration Error',
      message: 'OPENAI_API_KEY is not set on the server',
    });
  }

  const status = error.status ?? error.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return res.status(status).json({
      error: 'OpenAI API Error',
      message: error.message ?? 'Upstream AI request failed',
    });
  }

  return res.status(500).json({
    error: 'Internal Server Error',
    message: error.message ?? 'Failed to generate AI response',
  });
}

function handleUploadMiddlewareError(error, res) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Файл слишком большой. Максимум ${MAX_FILE_SIZE / (1024 * 1024)} МБ`,
      });
    }
    return res.status(400).json({ error: 'Bad Request', message: error.message });
  }

  if (error.code === 'UNSUPPORTED_FORMAT') {
    return res.status(400).json({ error: 'Unsupported Format', message: error.message });
  }

  return res.status(400).json({
    error: 'Bad Request',
    message: error.message ?? 'Upload failed',
  });
}

function handleProcessorError(error, res) {
  if (error instanceof WorkflowValidationError) {
    return res.status(400).json({ error: error.code, message: error.message });
  }
  if (error instanceof WorkflowStepError) {
    return res.status(500).json({
      error: 'Workflow Step Error',
      message: error.message,
      stepId: error.stepId,
    });
  }
  if (error instanceof ExtractTextError) {
    return res.status(400).json({ error: error.code, message: error.message });
  }
  if (error.message?.includes('обязательно') || error.message?.includes('не поддерживает')) {
    return res.status(400).json({ error: 'Bad Request', message: error.message });
  }
  if (error.message?.includes('timeout')) {
    return res.status(504).json({ error: 'Timeout', message: error.message });
  }
  return handleOpenAiError(error, res);
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'workflowgpt-api',
    engine: 'AI Workflow Engine 2.0',
    workflows: Object.values(WORKFLOW_IDS),
  });
});

app.post('/api/test-ai', async (req, res) => {
  try {
    const { message, workflow, metadata } = req.body ?? {};

    if (!workflow || typeof workflow !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Field "workflow" is required',
      });
    }

    let normalized;
    try {
      normalized = requireWorkflow(workflow);
    } catch (e) {
      return handleProcessorError(e, res);
    }

    const pipeline = await processTextRequest({
      workflow: normalized,
      message: typeof message === 'string' ? message : '',
      metadata,
    });

    return res.json({
      reply: pipeline.reply,
      result: pipeline.result,
      workflow: pipeline.workflow,
      workflowSlug: pipeline.workflowSlug,
      steps: pipeline.steps,
      stepIds: pipeline.stepIds,
      sections: pipeline.sections,
    });
  } catch (error) {
    console.error('[POST /api/test-ai]', error);
    return handleProcessorError(error, res);
  }
});

app.post('/api/export/:format', async (req, res) => {
  try {
    const format = req.params.format?.toLowerCase();
    if (format !== 'pdf' && format !== 'docx') {
      return res.status(400).json({ error: 'Bad Request', message: 'Use pdf or docx' });
    }

    const { workflow, result, sections } = req.body ?? {};
    if (!workflow || !result) {
      return res.status(400).json({ error: 'Bad Request', message: 'workflow and result required' });
    }

    const buffer = await buildExport({ workflow, result, sections }, format);
    const filename = `workflowgpt-${Date.now()}.${format}`;
    const mime =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('[POST /api/export]', error);
    return res.status(500).json({ error: 'Export Error', message: error.message });
  }
});

app.post('/api/workflow/upload', (req, res) => {
  universalUpload.single('file')(req, res, async (uploadErr) => {
    console.log('[POST /api/workflow/upload] req.body:', req.body);
    console.log(
      '[POST /api/workflow/upload] req.file:',
      req.file
        ? { originalname: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype }
        : null
    );

    if (uploadErr) {
      console.error('[POST /api/workflow/upload] multer:', uploadErr);
      return handleUploadMiddlewareError(uploadErr, res);
    }

    try {
      const rawWorkflow = req.body?.workflow;
      const workflow = resolveWorkflowForUpload(rawWorkflow);

      if (!workflow) {
        const hint = rawWorkflow
          ? `Invalid workflow for file upload: "${rawWorkflow}". Use: legal, competitors, analytics, or Russian workflow names.`
          : 'Field "workflow" is required in FormData (e.g. formData.append("workflow", selectedWorkflow)).';
        return res.status(400).json({
          error: 'Bad Request',
          message: hint,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Файл не передан. Поле формы: file',
        });
      }

      const note = typeof req.body?.message === 'string' ? req.body.message : req.body?.note ?? '';
      const metadata = req.body?.metadata;

      const pipeline = await processFileUpload({
        workflow,
        file: req.file,
        note,
        metadata,
      });

      return res.json({
        reply: pipeline.reply,
        result: pipeline.result,
        workflow: pipeline.workflow,
        workflowSlug: pipeline.workflowSlug,
        steps: pipeline.steps,
        stepIds: pipeline.stepIds,
        sections: pipeline.sections,
        filename: req.file.originalname,
      });
    } catch (error) {
      console.error('[POST /api/workflow/upload]', error);
      return handleProcessorError(error, res);
    }
  });
});

app.post('/api/upload-contract', (req, res) => {
  universalUpload.single('file')(req, res, async (uploadErr) => {
    console.log('[POST /api/upload-contract] req.body:', req.body);
    console.log('[POST /api/upload-contract] req.file:', req.file?.originalname ?? null);

    if (uploadErr) return handleUploadMiddlewareError(uploadErr, res);

    try {
      const workflow =
        resolveWorkflowForUpload(req.body?.workflow) ||
        resolveWorkflowForUpload('legal') ||
        WORKFLOW_IDS.CONTRACT;

      if (!req.file) {
        return res.status(400).json({ error: 'Bad Request', message: 'Файл не передан' });
      }

      const note = typeof req.body?.note === 'string' ? req.body.note : req.body?.message ?? '';
      const pipeline = await processFileUpload({
        workflow,
        file: req.file,
        note,
      });

      return res.json({
        reply: pipeline.reply,
        result: pipeline.result,
        workflow: pipeline.workflow,
        workflowSlug: pipeline.workflowSlug,
        steps: pipeline.steps,
        stepIds: pipeline.stepIds,
        sections: pipeline.sections,
        filename: req.file.originalname,
      });
    } catch (error) {
      console.error('[POST /api/upload-contract]', error);
      return handleProcessorError(error, res);
    }
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ error: 'Internal Server Error', message: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`WorkflowGPT API listening on http://localhost:${PORT}`);
});
