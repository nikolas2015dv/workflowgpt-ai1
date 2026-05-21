import React from 'react';
import { getBuildLabel, BUILD_TIMESTAMP } from '../config/buildInfo';

export const AppFooter: React.FC = () => {
  return (
    <footer className="app-footer" aria-label="Версия приложения">
      <span className="app-footer__brand">WorkflowGPT</span>
      <span className="app-footer__version" title={BUILD_TIMESTAMP}>
        {getBuildLabel()}
      </span>
    </footer>
  );
};
