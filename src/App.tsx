import React, { useState } from 'react';
import { WorkflowGallery } from './components/WorkflowGallery';
import { TaskExecutor } from './components/TaskExecutor';
import { ResultsViewer } from './components/ResultsViewer';
import { HistoryScreen } from './components/HistoryScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { PricingScreen } from './components/PricingScreen';
import { AdminScreen } from './components/AdminScreen';
import { AppTabBar, type AppTab } from './components/AppTabBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppFooter } from './components/AppFooter';
import { useTelegram } from './hooks/useTelegram';
import { useAuth } from './hooks/useAuth';
import { buildWorkflowSubject, type HistorySubjectContext } from './lib/historySubject';
import { saveHistoryItem, historyItemToRunResult } from './services/historyService';
import type { WorkflowRunResult } from './types/workflowResult';
import type { HistoryItem } from './types/history';

type AppState = 'gallery' | 'executor' | 'results';
type ResultsReturnTo = 'gallery' | 'history';

const App: React.FC = () => {
  const { user: tgUser, isTelegram, isReady } = useTelegram();
  const { user: appUser, refreshUser, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>('workflows');
  const [state, setState] = useState<AppState>('gallery');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<WorkflowRunResult | null>(null);
  const [resultSubject, setResultSubject] = useState<string | undefined>();
  const [resultCreatedAt, setResultCreatedAt] = useState<number | undefined>();
  const [resultsReturnTo, setResultsReturnTo] = useState<ResultsReturnTo>('gallery');
  const [screenKey, setScreenKey] = useState(0);

  const navigate = (next: AppState) => {
    setScreenKey((k) => k + 1);
    setState(next);
  };

  const handleSelectWorkflow = (workflow: string) => {
    setSelectedWorkflow(workflow);
    setActiveTab('workflows');
    navigate('executor');
  };

  const handleCompleteTask = (result: WorkflowRunResult, subjectContext: HistorySubjectContext) => {
    const workflowType = result.workflowSlug ?? result.workflow;
    const subject = buildWorkflowSubject(result.workflow || selectedWorkflow || workflowType, subjectContext);

    saveHistoryItem({
      workflowType,
      subject,
      result,
    });
    void refreshUser();

    setRunResult(result);
    setResultSubject(subject);
    setResultCreatedAt(Date.now());
    setResultsReturnTo('gallery');
    setActiveTab('workflows');
    navigate('results');
  };

  const handleOpenHistoryItem = (item: HistoryItem) => {
    setRunResult(historyItemToRunResult(item));
    setResultSubject(item.subject);
    setResultCreatedAt(item.createdAt);
    setResultsReturnTo('history');
    setActiveTab('history');
    navigate('results');
  };

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab === 'history' || tab === 'profile' || tab === 'pricing' || tab === 'admin') {
      navigate('gallery');
    } else if (state !== 'executor' && state !== 'results') {
      navigate('gallery');
    }
  };

  const handleRestart = () => {
    setSelectedWorkflow(null);
    setRunResult(null);
    setResultSubject(undefined);
    setResultCreatedAt(undefined);
    navigate('gallery');
  };

  const handleResultsExit = () => {
    if (resultsReturnTo === 'history') {
      setRunResult(null);
      setResultSubject(undefined);
      setResultCreatedAt(undefined);
      setActiveTab('history');
      navigate('gallery');
      return;
    }
    handleRestart();
  };

  const handleBack = () => {
    setSelectedWorkflow(null);
    navigate('gallery');
  };

  const subtitle =
    state === 'results'
      ? 'Готово'
      : state === 'executor'
        ? selectedWorkflow ?? ''
        : activeTab === 'history'
          ? 'History'
          : activeTab === 'pricing'
            ? 'Pricing'
            : activeTab === 'admin'
              ? 'Admin'
              : activeTab === 'profile'
                ? 'Profile'
                : 'Автоматизация с AI';

  const headerUser = appUser ?? tgUser;
  const avatarLetter = headerUser.first_name.charAt(0).toUpperCase();
  const headerPhoto = appUser?.photo_url ?? tgUser.photo_url;
  const showMainButtonPad = isTelegram && state === 'executor';
  const showResultsPad = state === 'results';
  const showTabBar = state === 'gallery';

  return (
    <div
      className={`app-shell${showMainButtonPad ? ' app-shell--main-button' : ''}${showResultsPad ? ' app-shell--results' : ''}${showTabBar ? ' app-shell--tabs' : ''}${isTelegram ? ' app-shell--telegram' : ''}`}
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

          <div
            className="app-header__user"
            title={headerUser.username ? `@${headerUser.username}` : headerUser.first_name}
          >
            {headerPhoto ? (
              <img className="app-header__avatar app-header__avatar--img" src={headerPhoto} alt="" />
            ) : (
              <span className="app-header__avatar" aria-hidden="true">
                {avatarLetter}
              </span>
            )}
            <span className="app-header__user-info">
              <span className="app-header__name">{headerUser.first_name}</span>
              {headerUser.username ? (
                <span className="app-header__username">@{headerUser.username}</span>
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
            {state === 'gallery' && activeTab === 'workflows' && (
              <WorkflowGallery onSelect={handleSelectWorkflow} />
            )}
            {state === 'gallery' && activeTab === 'history' && (
              <HistoryScreen onOpen={handleOpenHistoryItem} />
            )}
            {state === 'gallery' && activeTab === 'pricing' && <PricingScreen />}
            {state === 'gallery' && activeTab === 'profile' && <ProfileScreen />}
            {state === 'gallery' && activeTab === 'admin' && isOwner && <AdminScreen />}
            {state === 'executor' && selectedWorkflow && (
              <TaskExecutor
                workflow={selectedWorkflow}
                onComplete={handleCompleteTask}
                onBack={handleBack}
              />
            )}
            {state === 'results' && runResult && (
              <ResultsViewer
                run={runResult}
                onRestart={handleResultsExit}
                restartLabel={resultsReturnTo === 'history' ? 'Назад в History' : undefined}
                subject={resultSubject}
                createdAt={resultCreatedAt}
              />
            )}
          </div>
        </ErrorBoundary>
      </main>

      {showTabBar && (
        <AppTabBar activeTab={activeTab} isOwner={isOwner} onChange={handleTabChange} />
      )}

      <AppFooter />
    </div>
  );
};

export default App;
