import React from 'react';

export type StepStatus = 'done' | 'active' | 'pending';

interface WorkflowProgressProps {
  steps: string[];
  activeIndex: number;
}

function getStatus(index: number, activeIndex: number): StepStatus {
  if (index < activeIndex) return 'done';
  if (index === activeIndex) return 'active';
  return 'pending';
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ steps, activeIndex }) => {
  return (
    <ul className="workflow-progress" aria-label="Прогресс workflow">
      {steps.map((label, index) => {
        const status = getStatus(index, activeIndex);
        return (
          <li
            key={label}
            className={`workflow-progress__item workflow-progress__item--${status}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="workflow-progress__icon" aria-hidden="true">
              {status === 'done' && (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 12.5l2.5 2.5L16 9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {status === 'active' && <span className="workflow-progress__spinner" />}
              {status === 'pending' && <span className="workflow-progress__dot" />}
            </span>
            <span className="workflow-progress__label">{label}</span>
          </li>
        );
      })}
    </ul>
  );
};
