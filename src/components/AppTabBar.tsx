import React from 'react';

export type AppTab = 'workflows' | 'history';

interface AppTabBarProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

export const AppTabBar: React.FC<AppTabBarProps> = ({ activeTab, onChange }) => {
  return (
    <nav className="app-tabs glass-panel" aria-label="Навигация">
      <button
        type="button"
        className={`app-tabs__item${activeTab === 'workflows' ? ' app-tabs__item--active' : ''}`}
        onClick={() => onChange('workflows')}
      >
        Workflows
      </button>
      <button
        type="button"
        className={`app-tabs__item${activeTab === 'history' ? ' app-tabs__item--active' : ''}`}
        onClick={() => onChange('history')}
      >
        History
      </button>
    </nav>
  );
};
