import React, { useEffect, useState } from 'react';
import {
  WORKFLOW_IDS,
  type CompetitorMetadata,
  getUploadConfig,
  supportsFileUpload,
} from '../config/workflows';
import { getPipelineLoadingSteps } from '../config/pipelineSteps';
import { requestAiReply, uploadWorkflowFile } from '../lib/api';
import { logError, logUpload, logWorkflow } from '../lib/mobileDebug';
import { WorkflowProgress } from './WorkflowProgress';
import type { WorkflowRunResult } from '../types/workflowResult';
import { useTelegram } from '../hooks/useTelegram';
import { useTelegramMainButton } from '../hooks/useTelegramMainButton';
import { FileUploadField } from './FileUploadField';
import { CompetitorFields } from './CompetitorFields';

interface TaskExecutorProps {
  workflow: string;
  onComplete: (result: WorkflowRunResult) => void;
  onBack: () => void;
}

const PROGRESS_CAP = 92;

function hasCompetitorData(meta: CompetitorMetadata): boolean {
  return Boolean(meta.companyName || meta.website || meta.instagram || meta.telegram);
}

function getWorkflowDescription(workflow: string): string {
  switch (workflow) {
    case WORKFLOW_IDS.CONTRACT:
      return 'Загрузите договор, фото или вставьте текст';
    case WORKFLOW_IDS.COMPETITORS:
      return 'Данные конкурента, файл или текст для анализа';
    case WORKFLOW_IDS.DATA:
      return 'Загрузите таблицу или вставьте данные для анализа';
    default:
      return 'Введите данные — AI подготовит отчёт';
  }
}

export const TaskExecutor: React.FC<TaskExecutorProps> = ({ workflow, onComplete, onBack }) => {
  const uploadConfig = getUploadConfig(workflow);
  const isCompetitors = workflow === WORKFLOW_IDS.COMPETITORS;
  const canUpload = supportsFileUpload(workflow);

  const [inputData, setInputData] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [competitorMeta, setCompetitorMeta] = useState<CompetitorMetadata>({});
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadingSteps = getPipelineLoadingSteps(workflow, selectedFile);
  const hasText = inputData.trim().length > 0;
  const canSubmit =
    hasText ||
    Boolean(selectedFile) ||
    (isCompetitors && hasCompetitorData(competitorMeta));

  const { isTelegram, hapticNotification } = useTelegram();

  const runWorkflow = async () => {
    if (!canSubmit || loading) return;

    setError(null);
    setLoading(true);
    setUploadProgress(null);
    setProgress(0);
    setLoadingStep(0);

    try {
      let run: WorkflowRunResult;

      logWorkflow('start', { workflow, hasFile: Boolean(selectedFile), hasText, isCompetitors });

      if (selectedFile && canUpload) {
        logUpload('sending', { name: selectedFile.name, size: selectedFile.size });
        run = await uploadWorkflowFile(workflow, selectedFile, {
          message: hasText ? inputData.trim() : undefined,
          metadata: isCompetitors ? competitorMeta : undefined,
          onUploadProgress: setUploadProgress,
        });
        logUpload('complete');
      } else {
        run = await requestAiReply(
          inputData.trim(),
          workflow,
          isCompetitors ? competitorMeta : undefined
        );
        logWorkflow('text complete');
      }

      setProgress(100);
      setLoadingStep(loadingSteps.length - 1);
      hapticNotification('success');
      onComplete({ ...run, workflow: run.workflow || workflow });
    } catch (err) {
      logError('workflow', err);
      const message =
        err instanceof Error ? err.message : 'Не удалось выполнить анализ. Попробуйте снова.';
      setError(message);
      hapticNotification('error');
      setLoading(false);
      setProgress(0);
      setUploadProgress(null);
    }
  };

  useTelegramMainButton({
    visible: !loading,
    text: 'Запустить workflow',
    disabled: !canSubmit,
    loading,
    onClick: () => void runWorkflow(),
  });

  useEffect(() => {
    if (!loading) return;

    let rafId = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const duration = Math.max(loadingSteps.length * 3500, 14000);
      const pct = Math.min(PROGRESS_CAP, (elapsed / duration) * PROGRESS_CAP);
      setProgress(pct);
      setLoadingStep(
        Math.min(loadingSteps.length - 1, Math.floor((pct / PROGRESS_CAP) * loadingSteps.length))
      );
      if (pct < PROGRESS_CAP) rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [loading, loadingSteps.length]);

  if (loading) {
    return (
      <section className="task-executor task-executor--loading">
        <div className="loading-panel glass-panel loading-panel--v2">
          <div className="loading-panel__header">
            <div
              className="loading-ring loading-ring--sm"
              style={{ '--progress': `${progress}%` } as React.CSSProperties}
            >
              <svg viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--tg-button, #2aabee)" />
                    <stop offset="100%" stopColor="#7c5cff" />
                  </linearGradient>
                </defs>
                <circle className="loading-ring__track" cx="50" cy="50" r="42" />
                <circle className="loading-ring__fill" cx="50" cy="50" r="42" />
              </svg>
              <span className="loading-ring__value">{Math.round(progress)}%</span>
            </div>
            <div>
              <h2 className="loading-panel__title">AI Workflow Engine</h2>
              <p className="loading-panel__subtitle">Выполняем шаги pipeline…</p>
            </div>
          </div>

          <WorkflowProgress steps={loadingSteps} activeIndex={loadingStep} />

          <div className="progress-bar">
            <span className="progress-bar__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="task-executor">
      <button type="button" className="btn-ghost btn-back" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Назад
      </button>

      <div className="section-intro">
        <h2 className="section-title">{workflow}</h2>
        <p className="section-desc">{getWorkflowDescription(workflow)}</p>
      </div>

      {error && (
        <div className="api-error glass-panel" role="alert">
          <span className="api-error__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <div className="api-error__body">
            <p className="api-error__title">Не удалось выполнить запрос</p>
            <p className="api-error__message">{error}</p>
          </div>
          <button type="button" className="api-error__dismiss" onClick={() => setError(null)} aria-label="Закрыть">
            ×
          </button>
        </div>
      )}

      <form className="task-form" onSubmit={(e) => { e.preventDefault(); void runWorkflow(); }}>
        {isCompetitors && (
          <CompetitorFields values={competitorMeta} onChange={setCompetitorMeta} />
        )}

        {uploadConfig && (
          <FileUploadField
            label={
              workflow === WORKFLOW_IDS.CONTRACT
                ? 'Файл договора'
                : workflow === WORKFLOW_IDS.COMPETITORS
                  ? 'Файл конкурента (опционально)'
                  : 'Файл с данными'
            }
            accept={uploadConfig.accept}
            hint={uploadConfig.hint}
            file={selectedFile}
            uploadProgress={uploadProgress}
            onFileChange={(f) => {
              setSelectedFile(f);
              if (error) setError(null);
            }}
          />
        )}

        <div className="glass-panel task-form__panel">
          <label className="field-label" htmlFor="task-input">
            {canUpload ? 'Текст (опционально)' : 'Данные для анализа'}
          </label>
          <textarea
            id="task-input"
            className="field-textarea"
            placeholder={
              isCompetitors
                ? 'Дополнительный контекст о конкуренте...'
                : canUpload
                  ? 'Или вставьте данные вручную...'
                  : 'Вставьте текст, метрики или описание...'
            }
            value={inputData}
            onChange={(e) => {
              setInputData(e.target.value);
              if (error) setError(null);
            }}
            rows={5}
          />
          <p className="field-hint">
            {selectedFile
              ? `Файл: ${selectedFile.name}`
              : hasText
                ? `${inputData.length} символов`
                : isCompetitors
                  ? 'Заполните поля или добавьте текст'
                  : canUpload
                    ? 'Загрузите файл или введите текст'
                    : 'Минимум несколько слов'}
          </p>

          {!isTelegram && (
            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              <span className="btn-primary__shine" aria-hidden="true" />
              Запустить workflow
            </button>
          )}

          {isTelegram && (
            <p className="field-hint field-hint--main-button">Используйте кнопку внизу экрана Telegram</p>
          )}
        </div>
      </form>
    </section>
  );
};
