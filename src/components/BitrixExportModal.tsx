import React, { useEffect, useState } from 'react';
import type { BitrixExportMode } from '../lib/bitrixExport';
import { validateBitrixConnection, BitrixExportError } from '../lib/bitrixExport';
import { loadBitrixCredentials, saveBitrixCredentials } from '../lib/bitrixStorage';

export type BitrixModalPurpose = 'crm' | 'tasks';

interface BitrixExportModalProps {
  open: boolean;
  loading: boolean;
  purpose?: BitrixModalPurpose;
  recommendationCount?: number;
  onClose: () => void;
  onExport: (domain: string, webhookUrl: string, mode: BitrixExportMode) => void;
  onCreateTasks?: (domain: string, webhookUrl: string) => void;
}

type ValidationState = 'idle' | 'checking' | 'success' | 'error';

export const BitrixExportModal: React.FC<BitrixExportModalProps> = ({
  open,
  loading,
  purpose = 'crm',
  recommendationCount = 0,
  onClose,
  onExport,
  onCreateTasks,
}) => {
  const [domain, setDomain] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [mode, setMode] = useState<BitrixExportMode>('lead');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [connectionSaved, setConnectionSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    const saved = loadBitrixCredentials();
    setDomain(saved.domain);
    setWebhookUrl(saved.webhookUrl);
    setMode('lead');
    setValidationState(saved.domain && saved.webhookUrl ? 'success' : 'idle');
    setValidationMessage(
      saved.domain && saved.webhookUrl ? 'Сохранённое подключение загружено. Можно проверить снова.' : null
    );
    setConnectionSaved(!!(saved.domain && saved.webhookUrl));
  }, [open]);

  if (!open) return null;

  const busy = loading || validationState === 'checking';
  const isTasks = purpose === 'tasks';

  const handleValidate = async () => {
    setValidationState('checking');
    setValidationMessage(null);
    setConnectionSaved(false);

    try {
      const result = await validateBitrixConnection({ domain, webhookUrl });
      saveBitrixCredentials({ domain: result.domain ?? domain, webhookUrl });
      setConnectionSaved(true);
      setValidationState('success');
      setValidationMessage(
        result.userName
          ? `Подключение успешно. Пользователь: ${result.userName}`
          : 'Подключение успешно. Webhook работает.'
      );
    } catch (e) {
      setValidationState('error');
      setConnectionSaved(false);
      const message =
        e instanceof BitrixExportError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Не удалось проверить подключение';
      setValidationMessage(message);
    }
  };

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionSaved) {
      setValidationState('error');
      setValidationMessage('Сначала проверьте подключение к Bitrix24.');
      return;
    }
    saveBitrixCredentials({ domain, webhookUrl });
    if (isTasks) {
      onCreateTasks?.(domain.trim(), webhookUrl.trim());
      return;
    }
    onExport(domain.trim(), webhookUrl.trim(), mode);
  };

  return (
    <div className="bitrix-modal" role="dialog" aria-modal="true" aria-labelledby="bitrix-modal-title">
      <button
        type="button"
        className="bitrix-modal__backdrop"
        aria-label="Закрыть"
        onClick={busy ? undefined : onClose}
        disabled={busy}
      />
      <div className="bitrix-modal__panel glass-panel">
        <h2 id="bitrix-modal-title" className="bitrix-modal__title">
          {isTasks ? 'Create Bitrix24 Tasks' : 'Export to Bitrix24'}
        </h2>
        <p className="bitrix-modal__hint">
          Домен и Incoming Webhook хранятся только в браузере (localStorage), не на сервере.
        </p>
        {isTasks && recommendationCount > 0 && (
          <p className="bitrix-modal__hint bitrix-modal__hint--count">
            Будет создано задач: {recommendationCount}
          </p>
        )}

        <form className="bitrix-modal__form" onSubmit={handleExport}>
          <label className="bitrix-modal__field">
            <span>Bitrix24 Domain</span>
            <input
              type="text"
              name="bitrixDomain"
              className="field-input"
              autoComplete="off"
              placeholder="company.bitrix24.com"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setConnectionSaved(false);
                setValidationState('idle');
                setValidationMessage(null);
              }}
              disabled={busy}
              required
            />
          </label>

          <label className="bitrix-modal__field">
            <span>Incoming Webhook URL</span>
            <input
              type="url"
              name="bitrixWebhook"
              className="field-input"
              autoComplete="off"
              placeholder="https://company.bitrix24.com/rest/1/xxxxxxxx/"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setConnectionSaved(false);
                setValidationState('idle');
                setValidationMessage(null);
              }}
              disabled={busy}
              required
            />
          </label>

          <button
            type="button"
            className="btn-export btn-export--ghost bitrix-modal__validate"
            onClick={() => void handleValidate()}
            disabled={busy || !domain.trim() || !webhookUrl.trim()}
          >
            {validationState === 'checking' ? 'Проверка…' : 'Проверить подключение'}
          </button>

          {validationMessage && (
            <p
              className={
                validationState === 'success'
                  ? 'bitrix-modal__status bitrix-modal__status--success'
                  : 'bitrix-modal__status bitrix-modal__status--error'
              }
              role={validationState === 'error' ? 'alert' : 'status'}
            >
              {validationMessage}
            </p>
          )}

          {!isTasks && (
            <fieldset className="bitrix-modal__mode">
              <legend>Тип экспорта</legend>
              <label className="bitrix-modal__mode-option">
                <input
                  type="radio"
                  name="bitrixMode"
                  value="lead"
                  checked={mode === 'lead'}
                  onChange={() => setMode('lead')}
                  disabled={busy}
                />
                <span>Create Lead</span>
              </label>
              <label className="bitrix-modal__mode-option">
                <input
                  type="radio"
                  name="bitrixMode"
                  value="deal"
                  checked={mode === 'deal'}
                  onChange={() => setMode('deal')}
                  disabled={busy}
                />
                <span>Create Deal</span>
              </label>
            </fieldset>
          )}

          <p className="bitrix-modal__help">
            {isTasks
              ? 'Вебхук должен иметь права CRM (crm) и Задачи (task). Одна рекомендация = одна задача в Bitrix24.'
              : 'Создайте входящий вебхук в Bitrix24: Приложения → Вебхуки → Входящий вебхук. Нужны права CRM (crm).'}
          </p>

          <div className="bitrix-modal__actions">
            <button type="button" className="btn-export btn-export--ghost" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn-export btn-export--bitrix" disabled={busy}>
              {loading
                ? isTasks
                  ? 'Creating Bitrix24 Tasks...'
                  : 'Exporting to Bitrix24...'
                : isTasks
                  ? 'Create Bitrix24 Tasks'
                  : mode === 'lead'
                    ? 'Export Lead'
                    : 'Export Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
