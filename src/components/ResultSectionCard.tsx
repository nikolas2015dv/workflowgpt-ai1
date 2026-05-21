import React, { useState } from 'react';
import type { ResultSectionConfig, SwotData } from '../types/workflowResult';
import { isSwot } from '../lib/formatResult';

interface ResultSectionCardProps {
  index: number;
  section: ResultSectionConfig;
  value: unknown;
  defaultExpanded?: boolean;
}

const SWOT_LABELS: { key: keyof SwotData; title: string; accent: string }[] = [
  { key: 'strengths', title: 'S', accent: 'swot--s' },
  { key: 'weaknesses', title: 'W', accent: 'swot--w' },
  { key: 'opportunities', title: 'O', accent: 'swot--o' },
  { key: 'threats', title: 'T', accent: 'swot--t' },
];

const SWOT_FULL: Record<keyof SwotData, string> = {
  strengths: 'Сильные стороны',
  weaknesses: 'Слабые стороны',
  opportunities: 'Возможности',
  threats: 'Угрозы',
};

export const ResultSectionCard: React.FC<ResultSectionCardProps> = ({
  index,
  section,
  value,
  defaultExpanded = index === 0,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const renderBody = () => {
    if (section.type === 'list' && Array.isArray(value)) {
      return (
        <ul className="result-list">
          {value.map((item, i) => (
            <li key={i} className="result-list__item">
              {String(item)}
            </li>
          ))}
        </ul>
      );
    }

    if (section.type === 'swot' && isSwot(value)) {
      return (
        <div className="swot-grid">
          {SWOT_LABELS.map(({ key, accent }) => {
            const items = value[key];
            if (!items?.length) return null;
            return (
              <div key={key} className={`swot-quadrant glass-panel ${accent}`}>
                <span className="swot-quadrant__badge">{SWOT_FULL[key]}</span>
                <ul className="result-list result-list--compact">
                  {items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      );
    }

    return <p className="result-section-card__text">{String(value ?? '')}</p>;
  };

  return (
    <article
      className={`result-section-card glass-card${expanded ? ' result-section-card--open' : ''}`}
    >
      <button
        type="button"
        className="result-section-card__toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="result-section-card__index">{index + 1}</span>
        <span className="result-section-card__title">{section.title}</span>
        <span className={`result-section-card__chevron${expanded ? ' result-section-card__chevron--up' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <div className="result-section-card__body" hidden={!expanded}>
        {renderBody()}
      </div>
    </article>
  );
};
