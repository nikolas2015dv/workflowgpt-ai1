import React, { useCallback, useEffect, useState } from 'react';
import type { HistoryItem } from '../types/history';
import type { WorkflowHistorySource } from '../types/database';
import { loadWorkflowHistory } from '../lib/workflowDatabase';
import { useAuth } from '../hooks/useAuth';
import {
  clearHistory,
  deleteHistoryItem,
  formatHistoryDate,
  formatWorkflowTypeLabel,
  logHistoryOpened,
} from '../services/historyService';

interface HistoryScreenProps {
  onOpen: (item: HistoryItem) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onOpen }) => {
  const { isLoading: authLoading, user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [source, setSource] = useState<WorkflowHistorySource>('local');

  const refresh = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await loadWorkflowHistory();
      setItems(result.items);
      setSource(result.source);
      if (result.error) {
        setLoadError('База данных недоступна — показана локальная история');
      }
    } catch {
      setLoadError('Не удалось загрузить историю');
      setItems([]);
      setSource('local');
    } finally {
      setLoading(false);
    }
  }, [authLoading, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpen = (item: HistoryItem) => {
    logHistoryOpened(item.id);
    onOpen(item);
  };

  const handleDelete = (id: string) => {
    deleteHistoryItem(id);
    void refresh();
  };

  const handleClear = () => {
    if (items.length === 0) return;
    if (!window.confirm('Удалить всю историю отчётов?')) return;
    clearHistory();
    void refresh();
  };

  return (
    <section className="history-screen">
      <div className="section-intro">
        <h2 className="section-title">History</h2>
        <p className="section-desc">
          {source === 'database'
            ? 'Сохранённые отчёты из базы данных'
            : 'Сохранённые отчёты — локальный режим'}
        </p>
      </div>

      {loading && (
        <div className="history-loading glass-panel" role="status">
          <p className="history-loading__text">Загрузка истории…</p>
        </div>
      )}

      {!loading && loadError && (
        <p className="history-load-error" role="status">
          {loadError}
        </p>
      )}

      {!loading && items.length === 0 ? (
        <div className="history-empty glass-panel">
          <span className="history-empty__icon" aria-hidden="true">
            📚
          </span>
          <p className="history-empty__title">История пуста</p>
          <p className="history-empty__desc">Запустите workflow — результат появится здесь автоматически</p>
        </div>
      ) : (
        !loading && (
          <ul className="history-list">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="history-item glass-card"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="history-item__body">
                  <span className="history-item__badge">{formatWorkflowTypeLabel(item.workflowType)}</span>
                  <h3 className="history-item__title">{item.title}</h3>
                  <p className="history-item__subject">{item.subject}</p>
                  <p className="history-item__date">{formatHistoryDate(item.createdAt)}</p>
                </div>
                <div className="history-item__actions">
                  <button type="button" className="btn-export btn-export--ghost" onClick={() => handleOpen(item)}>
                    Open
                  </button>
                  <button
                    type="button"
                    className="btn-export btn-export--danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {!loading && items.length > 0 && (
        <button type="button" className="btn-primary btn-primary--outline history-clear" onClick={handleClear}>
          Clear History
        </button>
      )}
    </section>
  );
};
