import React, { useEffect, useState } from 'react';
import { loadNotionCredentials, saveNotionCredentials } from '../lib/notionStorage';

interface NotionExportModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string, databaseId: string) => void;
}

export const NotionExportModal: React.FC<NotionExportModalProps> = ({
  open,
  loading,
  onClose,
  onSubmit,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [databaseId, setDatabaseId] = useState('');

  useEffect(() => {
    if (!open) return;
    const saved = loadNotionCredentials();
    setApiKey(saved.apiKey);
    setDatabaseId(saved.databaseId);
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveNotionCredentials({ apiKey, databaseId });
    onSubmit(apiKey.trim(), databaseId.trim());
  };

  return (
    <div className="notion-modal" role="dialog" aria-modal="true" aria-labelledby="notion-modal-title">
      <button
        type="button"
        className="notion-modal__backdrop"
        aria-label="Закрыть"
        onClick={loading ? undefined : onClose}
        disabled={loading}
      />
      <div className="notion-modal__panel glass-panel">
        <h2 id="notion-modal-title" className="notion-modal__title">
          Export to Notion
        </h2>
        <p className="notion-modal__hint">
          Токен и Database ID хранятся только в браузере (localStorage), не на сервере.
        </p>

        <form className="notion-modal__form" onSubmit={handleSubmit}>
          <label className="notion-modal__field">
            <span>Notion Integration Token</span>
            <input
              type="password"
              name="notionApiKey"
              autoComplete="off"
              placeholder="secret_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label className="notion-modal__field">
            <span>Database ID</span>
            <input
              type="text"
              name="databaseId"
              autoComplete="off"
              placeholder="UUID или ссылка на базу"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <p className="notion-modal__help">
            Создайте интеграцию на notion.so/my-integrations и добавьте её в Connections вашей базы.
          </p>

          <div className="notion-modal__actions">
            <button
              type="button"
              className="btn-export btn-export--ghost"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button type="submit" className="btn-export btn-export--notion" disabled={loading}>
              {loading ? 'Exporting to Notion...' : 'Export to Notion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
