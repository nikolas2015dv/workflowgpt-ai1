import React, { useState } from 'react';
import { WorkflowGallery } from './components/WorkflowGallery';
import { TaskExecutor } from './components/TaskExecutor';
import { ResultsViewer } from './components/ResultsViewer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppFooter } from './components/AppFooter';
import { useTelegram } from './hooks/useTelegram';
import type { WorkflowRunResult } from './types/workflowResult';

type AppState = 'gallery' | 'executor' | 'results';

const App: React.FC = () => {
  const { user, isTelegram, isReady } = useTelegram();
  const [state, setState] = useState<AppState>('gallery');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<WorkflowRunResult | null>(null);
  const [screenKey, setScreenKey] = useState(0);

  const navigate = (next: AppState) => {
    setScreenKey((k) => k + 1);
    setState(next);
  };

  const handleSelectWorkflow = (workflow: string) => {
    setSelectedWorkflow(workflow);
    navigate('executor');
  };

  const handleCompleteTask = (result: WorkflowRunResult) => {
    setRunResult(result);
    navigate('results');
  };

  const handleRestart = () => {
    setSelectedWorkflow(null);
    setRunResult(null);
    navigate('gallery');
  };

  const handleBack = () => {
    setSelectedWorkflow(null);
    navigate('gallery');
  };

  const subtitle =
    state === 'gallery'
      ? 'Автоматизация с AI'
      : state === 'executor'
        ? selectedWorkflow ?? ''
        : 'Готово';

  const avatarLetter = user.first_name.charAt(0).toUpperCase();
  const showMainButtonPad = isTelegram && state === 'executor';
  const showResultsPad = state === 'results';

  return (
    <div
      className={`app-shell${showMainButtonPad ? ' app-shell--main-button' : ''}${showResultsPad ? ' app-shell--results' : ''}${isTelegram ? ' app-shell--telegram' : ''}`}
    >
      <div className="app-bg" aria-hidden="true">
        <span className="app-bg-orb app-bg-orb--1" />
        <span className="app-bg-orb app-bg-orb--2" />
        <span className="app-bg-orb app-bg-orb--3" />
      </div>

      <header className="app-header">
        <div className="app-header__inner glass-panel">
          <div className="app-header__brand">
            <span className="app-header__logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L4 7v10l8 5 8-5V7l-8-5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 8v8M8 10l4-2 4 2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="app-header__titles">
              <h1 className="app-header__title">WorkflowGPT</h1>
              <p className="app-header__subtitle">{subtitle}</p>
            </div>
          </div>

          <div className="app-header__user" title={user.username ? `@${user.username}` : user.first_name}>
            <span className="app-header__avatar" aria-hidden="true">
              {avatarLetter}
            </span>
            <span className="app-header__user-info">
              <span className="app-header__name">{user.first_name}</span>
              {isTelegram && user.username ? (
                <span className="app-header__username">@{user.username}</span>
              ) : (
                <span className="app-header__username app-header__username--muted">
                  {!isReady ? '…' : isTelegram ? 'без username' : 'браузер'}
                </span>
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <ErrorBoundary onReset={handleRestart}>
          <div key={screenKey} className="screen screen--enter">
            {state === 'gallery' && <WorkflowGallery onSelect={handleSelectWorkflow} />}
            {state === 'executor' && selectedWorkflow && (
              <TaskExecutor
                workflow={selectedWorkflow}
                onComplete={handleCompleteTask}
                onBack={handleBack}
              />
            )}
            {state === 'results' && runResult && (
              <ResultsViewer run={runResult} onRestart={handleRestart} />
            )}
          </div>
        </ErrorBoundary>
      </main>

      <AppFooter />
    </div>
  );
};

export default App;
