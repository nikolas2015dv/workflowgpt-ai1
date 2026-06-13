import React from 'react';

export type AppTab = 'workflows' | 'history' | 'pricing' | 'profile' | 'admin';

interface AppTabBarProps {
  activeTab: AppTab;
  isOwner: boolean;
  onChange: (tab: AppTab) => void;
}

export const AppTabBar: React.FC<AppTabBarProps> = ({ activeTab, isOwner, onChange }) => {
  const tabClass = (tab: AppTab) =>
    `app-tabs__item${activeTab === tab ? ' app-tabs__item--active' : ''}`;

  return (
    <nav
      className={`app-tabs glass-panel${isOwner ? ' app-tabs--owner' : ''}`}
      aria-label="Навигация"
    >
      <button type="button" className={tabClass('workflows')} onClick={() => onChange('workflows')}>
        Workflows
      </button>
      <button type="button" className={tabClass('history')} onClick={() => onChange('history')}>
        History
      </button>
      <button type="button" className={tabClass('pricing')} onClick={() => onChange('pricing')}>
        Pricing
      </button>
      <button type="button" className={tabClass('profile')} onClick={() => onChange('profile')}>
        Profile
      </button>
      {isOwner && (
        <button type="button" className={tabClass('admin')} onClick={() => onChange('admin')}>
          Admin
        </button>
      )}
    </nav>
  );
};
