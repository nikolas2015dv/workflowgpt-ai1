import React, { useEffect, useRef, useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useTelegramMainButton } from '../hooks/useTelegramMainButton';

interface TaskExecutorProps {
  workflow: string;
  onComplete: (results: string) => void;
  onBack: () => void;
}

const LOADING_STEPS = [
  'Подготовка контекста',
  'Анализ данных',
  'Формирование выводов',
];

export const TaskExecutor: React.FC<TaskExecutorProps> = ({ workflow, onComplete, onBack }) => {
  const { isTelegram, hapticNotification } = useTelegram();
  const formRef = useRef<HTMLFormElement>(null);
  const [inputData, setInputData] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);

  const canSubmit = inputData.trim().length > 0;

  const runWorkflow = () => {
    if (!canSubmit || loading) return;
    setLoading(true);
  };

  useTelegramMainButton({
    visible: !loading,
    text: 'Запустить workflow',
    disabled: !canSubmit,
    loading,
    onClick: runWorkflow,
  });

  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setLoadingStep(0);
      return;
    }

    const duration = 3000;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      setLoadingStep(Math.min(LOADING_STEPS.length - 1, Math.floor((pct / 100) * LOADING_STEPS.length)));

      if (elapsed < duration) {
        requestAnimationFrame(frame);
      }
    };

    const id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [loading]);

  useEffect(() => {
    if (!loading) return;

    const timer = window.setTimeout(() => {
      setLoading(false);
      hapticNotification('success');
      onComplete(
        `Результаты для «${workflow}»\n\n` +
          '• Ключевые находки: структура данных соответствует ожидаемому формату\n' +
          '• Риски: обнаружены 2 зоны, требующие внимания\n' +
          '• Рекомендации: оптимизировать формулировки и уточнить сроки\n\n' +
          'Синтетический отчёт AI на основе введённых данных.'
      );
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [loading, workflow, onComplete, hapticNotification]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runWorkflow();
  };

  if (loading) {
    return (
      <section className="task-executor task-executor--loading">
        <div className="loading-panel glass-panel">
          <div className="loading-ring" style={{ '--progress': `${progress}%` } as React.CSSProperties}>
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

          <h2 className="loading-panel__title">Выполняем анализ</h2>
          <p className="loading-panel__step">{LOADING_STEPS[loadingStep]}</p>

          <div className="progress-bar">
            <span className="progress-bar__fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="skeleton-stack">
            <span className="skeleton skeleton--line skeleton--lg" />
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line skeleton--short" />
            <span className="skeleton skeleton--block" />
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
        <p className="section-desc">Введите данные — AI подготовит краткий отчёт</p>
      </div>

      <form ref={formRef} className="task-form glass-panel" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="task-input">
          Данные для анализа
        </label>
        <textarea
          id="task-input"
          className="field-textarea"
          placeholder="Вставьте текст, описание или ключевые пункты..."
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          required
          rows={5}
        />
        <p className="field-hint">{inputData.length > 0 ? `${inputData.length} символов` : 'Минимум несколько слов'}</p>

        {!isTelegram && (
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            <span className="btn-primary__shine" aria-hidden="true" />
            Запустить workflow
          </button>
        )}

        {isTelegram && (
          <p className="field-hint field-hint--main-button">Используйте кнопку внизу экрана Telegram</p>
        )}
      </form>
    </section>
  );
};
