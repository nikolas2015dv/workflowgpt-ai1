import React from 'react';
import { useTelegram } from '../hooks/useTelegram';

interface WorkflowGalleryProps {
  onSelect: (workflow: string) => void;
}

interface WorkflowItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
}

const WORKFLOWS: WorkflowItem[] = [
  {
    id: 'contract',
    title: 'Анализ договора',
    description: 'Риски, сроки и ключевые условия за секунды',
    icon: '📄',
    accent: 'card-accent--blue',
  },
  {
    id: 'competitors',
    title: 'Анализ конкурентов',
    description: 'Сравнение позиций и сильных сторон рынка',
    icon: '📊',
    accent: 'card-accent--violet',
  },
  {
    id: 'data',
    title: 'Анализ данных',
    description: 'Метрики, инсайты и рекомендации для роста',
    icon: '📈',
    accent: 'card-accent--cyan',
  },
];

export const WorkflowGallery: React.FC<WorkflowGalleryProps> = ({ onSelect }) => {
  const { hapticImpact } = useTelegram();

  const handleSelect = (title: string) => {
    hapticImpact('light');
    onSelect(title);
  };

  return (
    <section className="workflow-gallery">
      <div className="section-intro">
        <h2 className="section-title">Выберите workflow</h2>
        <p className="section-desc">Готовые сценарии для быстрой автоматизации задач</p>
      </div>

      <div className="workflow-cards">
        {WORKFLOWS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`workflow-card glass-card ${item.accent}`}
            style={{ animationDelay: `${index * 80}ms` }}
            onClick={() => handleSelect(item.title)}
          >
            <span className="workflow-card__glow" aria-hidden="true" />
            <span className="workflow-card__icon">{item.icon}</span>
            <span className="workflow-card__body">
              <span className="workflow-card__title">{item.title}</span>
              <span className="workflow-card__desc">{item.description}</span>
            </span>
            <span className="workflow-card__arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        ))}
      </div>

      <p className="workflow-gallery__hint">Нажмите на карточку, чтобы настроить параметры</p>
    </section>
  );
};
