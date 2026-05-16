import React, { useState } from 'react';

interface ResultsViewerProps {
  results: string;
  onRestart: () => void;
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({ results, onRestart }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(results);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = results;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="results-viewer">
      <div className="results-hero glass-panel">
        <span className="results-hero__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 12.5l2.5 2.5L16 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2 className="results-hero__title">Анализ завершён</h2>
        <p className="results-hero__desc">Результаты готовы к просмотру</p>
      </div>

      <article className="results-card glass-card">
        <div className="results-card__header">
          <span className="results-card__label">Отчёт AI</span>
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={handleCopy}>
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
        <pre className="results-card__body">{results}</pre>
      </article>

      <button type="button" className="btn-primary btn-primary--outline" onClick={onRestart}>
        Начать заново
      </button>
    </section>
  );
};
