import React, { useState } from 'react';
import type { WorkflowRunResult } from '../types/workflowResult';
import { buildCopyText, sectionHasContent } from '../lib/formatResult';
import { copyReportText, downloadReport, shareReport } from '../lib/exportApi';
import { exportReportToNotion, NotionExportError } from '../lib/notionExport';
import { exportReportToBitrix, BitrixExportError, type BitrixExportMode } from '../lib/bitrixExport';
import { NotionExportModal } from './NotionExportModal';
import { BitrixExportModal } from './BitrixExportModal';
import { ResultSectionCard } from './ResultSectionCard';

interface ResultsViewerProps {
  run: WorkflowRunResult;
  onRestart: () => void;
  restartLabel?: string;
  subject?: string;
  createdAt?: number;
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({
  run,
  onRestart,
  restartLabel,
  subject,
  createdAt,
}) => {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [notionOpen, setNotionOpen] = useState(false);
  const [notionLoading, setNotionLoading] = useState(false);
  const [bitrixOpen, setBitrixOpen] = useState(false);
  const [bitrixLoading, setBitrixLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportHint, setExportHint] = useState<string | null>(null);

  const resultRecord = run.result as Record<string, unknown>;
  const visibleSections = run.sections.filter((section) =>
    sectionHasContent(resultRecord[section.key], section.type)
  );

  const copyText = buildCopyText(run.workflow, resultRecord, run.sections, run.reply);

  const handleCopy = async () => {
    const ok = await copyReportText(copyText);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExportError(null);
    setExportHint(null);
    setExporting(format);
    try {
      const result = await downloadReport(run, format);
      if (result === 'shared') {
        setExportHint('Отчёт отправлен через «Поделиться»');
      } else if (result === 'opened') {
        setExportHint('Отчёт открыт в новой вкладке — сохраните вручную');
      } else if (result === 'failed') {
        setExportError('Скачивание недоступно. Нажмите «Поделиться» или «Копировать».');
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Ошибка экспорта');
    } finally {
      setExporting(null);
    }
  };

  const handleShare = async () => {
    setExportError(null);
    setExportHint(null);
    const ok = await shareReport(copyText, `WorkflowGPT — ${run.workflow}`);
    if (!ok) await handleCopy();
    else setExportHint('Текст отчёта готов к отправке');
  };

  const exportsBusy = !!exporting || notionLoading || bitrixLoading;

  const handleBitrixExport = async (domain: string, webhookUrl: string, mode: BitrixExportMode) => {
    setExportError(null);
    setExportHint(null);
    setBitrixLoading(true);
    try {
      const result = await exportReportToBitrix(
        run,
        { domain, webhookUrl },
        { subject, createdAt, mode }
      );
      setBitrixOpen(false);
      const entityLabel = result.entityType === 'deal' ? 'сделку' : 'лид';
      setExportHint(`Экспорт в Bitrix24: ${entityLabel} #${result.entityId} создан.`);
      if (result.url) {
        try {
          window.open(result.url, '_blank', 'noopener,noreferrer');
        } catch {
          /* Telegram WebView may block popups */
        }
      }
    } catch (e) {
      const message =
        e instanceof BitrixExportError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Не удалось экспортировать в Bitrix24';
      setExportError(message);
    } finally {
      setBitrixLoading(false);
    }
  };

  const handleNotionExport = async (apiKey: string, databaseId: string) => {
    setExportError(null);
    setExportHint(null);
    setNotionLoading(true);
    try {
      const result = await exportReportToNotion(
        run,
        { apiKey, databaseId },
        { subject, createdAt }
      );
      setNotionOpen(false);
      setExportHint(
        result.url ? 'Exported successfully. Откройте страницу в Notion.' : 'Exported successfully'
      );
      if (result.url) {
        try {
          window.open(result.url, '_blank', 'noopener,noreferrer');
        } catch {
          /* Telegram WebView may block popups */
        }
      }
    } catch (e) {
      const message =
        e instanceof NotionExportError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Не удалось экспортировать в Notion';
      setExportError(message);
    } finally {
      setNotionLoading(false);
    }
  };

  return (
    <section className="results-viewer results-viewer--v2">
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
        <p className="results-hero__desc">{run.workflow}</p>
        {run.workflowSlug && (
          <span className="results-hero__badge">{run.workflowSlug}</span>
        )}
      </div>

      {run.report && (
        <article className="results-report glass-card">
          <h3 className="results-report__title">Итоговый отчёт</h3>
          <pre className="results-report__body">{run.report}</pre>
        </article>
      )}

      <div className="results-sections-v2">
        {visibleSections.map((section, index) => (
          <ResultSectionCard
            key={section.key}
            index={index}
            section={section}
            value={resultRecord[section.key]}
            defaultExpanded={index < 2}
          />
        ))}
      </div>

      {visibleSections.length === 0 && (
        <article className="results-card glass-card">
          <pre className="results-card__body">{run.reply}</pre>
        </article>
      )}

      {exportError && (
        <p className="results-export-error" role="alert">
          {exportError}
        </p>
      )}
      {exportHint && !exportError && (
        <p className="results-export-hint" role="status">
          {exportHint}
        </p>
      )}

      <div className="results-sticky-bar glass-panel">
        <div className="results-sticky-bar__actions">
          <button
            type="button"
            className="btn-export"
            disabled={exportsBusy}
            onClick={() => void handleExport('pdf')}
          >
            {exporting === 'pdf' ? 'PDF…' : 'PDF'}
          </button>
          <button
            type="button"
            className="btn-export"
            disabled={exportsBusy}
            onClick={() => void handleExport('docx')}
          >
            {exporting === 'docx' ? 'DOCX…' : 'DOCX'}
          </button>
          <button type="button" className="btn-export btn-export--ghost" onClick={() => void handleCopy()}>
            {copied ? '✓' : 'Копировать'}
          </button>
          <button type="button" className="btn-export btn-export--ghost" onClick={() => void handleShare()}>
            Поделиться
          </button>
          <button
            type="button"
            className="btn-export btn-export--notion"
            disabled={exportsBusy}
            onClick={() => {
              setExportError(null);
              setExportHint(null);
              setNotionOpen(true);
            }}
          >
            {notionLoading ? 'Exporting to Notion...' : 'Export to Notion'}
          </button>
          <button
            type="button"
            className="btn-export btn-export--bitrix"
            disabled={exportsBusy}
            onClick={() => {
              setExportError(null);
              setExportHint(null);
              setBitrixOpen(true);
            }}
          >
            {bitrixLoading ? 'Exporting to Bitrix24...' : 'Export to Bitrix24'}
          </button>
        </div>
        <button type="button" className="btn-primary btn-primary--outline btn-restart" onClick={onRestart}>
          {restartLabel ?? 'Начать заново'}
        </button>
      </div>

      <NotionExportModal
        open={notionOpen}
        loading={notionLoading}
        onClose={() => !notionLoading && setNotionOpen(false)}
        onSubmit={(apiKey, databaseId) => void handleNotionExport(apiKey, databaseId)}
      />

      <BitrixExportModal
        open={bitrixOpen}
        loading={bitrixLoading}
        onClose={() => !bitrixLoading && setBitrixOpen(false)}
        onExport={(domain, webhookUrl, mode) => void handleBitrixExport(domain, webhookUrl, mode)}
      />
    </section>
  );
};
