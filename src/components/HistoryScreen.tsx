import React, { useCallback, useState } from 'react';
import type { HistoryItem } from '../types/history';
import {
  clearHistory,
  deleteHistoryItem,
  formatHistoryDate,
  formatWorkflowTypeLabel,
  getHistoryItems,
  logHistoryOpened,
} from '../services/historyService';

interface HistoryScreenProps {
  onOpen: (item: HistoryItem) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onOpen }) => {
  const [items, setItems] = useState<HistoryItem[]>(() => getHistoryItems());

  const refresh = useCallback(() => {
    setItems(getHistoryItems());
  }, []);

  const handleOpen = (item: HistoryItem) => {
    logHistoryOpened(item.id);
    onOpen(item);
  };

  const handleDelete = (id: string) => {
    deleteHistoryItem(id);
    refresh();
  };

  const handleClear = () => {
    if (items.length === 0) return;
    if (!window.confirm('Удалить всю историю отчётов?')) return;
    clearHistory();
    refresh();
  };

  return (
    <section className="history-screen">
      <div className="section-intro">
        <h2 className="section-title">History</h2>
        <p className="section-desc">Сохранённые отчёты — доступны после перезагрузки</p>
      </div>

      {items.length === 0 ? (
        <div className="history-empty glass-panel">
          <span className="history-empty__icon" aria-hidden="true">
            📚
          </span>
          <p className="history-empty__title">История пуста</p>
          <p className="history-empty__desc">Запустите workflow — результат появится здесь автоматически</p>
        </div>
      ) : (
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
      )}

      {items.length > 0 && (
        <button type="button" className="btn-primary btn-primary--outline history-clear" onClick={handleClear}>
          Clear History
        </button>
      )}
    </section>
  );
};
