import React from 'react';
import type { AdminAnalytics } from '../types/admin';

interface AdminAnalyticsPanelProps {
  analytics: AdminAnalytics | null;
  loadState: 'loading' | 'ready' | 'error';
  error: string | null;
  onRetry: () => void;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function PeriodTable({ title, data }: { title: string; data: AdminAnalytics['periods']['last7Days'] }) {
  const rows = [
    { label: 'New Users', value: data.newUsers },
    { label: 'Pro Requests', value: data.proRequests },
    { label: 'Approved Requests', value: data.approvedRequests },
    { label: 'Workflow Runs', value: data.workflowRuns },
  ];

  return (
    <article className="admin-analytics-period glass-card">
      <h4 className="admin-analytics-period__title">{title}</h4>
      <dl className="admin-analytics-period__list">
        {rows.map((row) => (
          <div key={row.label} className="admin-analytics-period__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export const AdminAnalyticsPanel: React.FC<AdminAnalyticsPanelProps> = ({
  analytics,
  loadState,
  error,
  onRetry,
}) => {
  if (loadState === 'loading' && !analytics) {
    return (
      <div className="admin-loading glass-panel" role="status">
        <p>Загрузка аналитики…</p>
      </div>
    );
  }

  if (loadState === 'error' && !analytics) {
    return (
      <div className="admin-error glass-panel">
        <p className="admin-error__title">Ошибка загрузки аналитики</p>
        <p className="admin-error__desc">{error ?? 'Неизвестная ошибка'}</p>
        <button type="button" className="btn-primary btn-primary--outline" onClick={onRetry}>
          Повторить
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="admin-empty glass-panel">
        <p className="admin-empty__title">Нет данных</p>
        <p className="admin-empty__desc">Аналитика появится после активности пользователей</p>
      </div>
    );
  }

  const isEmpty =
    analytics.users.total === 0 &&
    analytics.proRequests.total === 0 &&
    analytics.workflows.totalRuns === 0;

  const userCards = [
    { label: 'Total Users', value: analytics.users.total },
    { label: 'Free Users', value: analytics.users.free },
    { label: 'Pro Users', value: analytics.users.pro },
    { label: 'Owner Users', value: analytics.users.owner },
  ];

  const requestCards = [
    { label: 'Pro Requests Total', value: analytics.proRequests.total },
    { label: 'Pending Pro Requests', value: analytics.proRequests.pending },
    { label: 'Approved Pro Requests', value: analytics.proRequests.approved },
    { label: 'Rejected Pro Requests', value: analytics.proRequests.rejected },
  ];

  const workflowCards = [
    { label: 'Workflow Runs Total', value: analytics.workflows.totalRuns },
    { label: 'Workflow Runs Last 7 Days', value: analytics.workflows.runsLast7Days },
    { label: 'Workflow Runs Last 30 Days', value: analytics.workflows.runsLast30Days },
    { label: 'Free → Pro Conversion Rate', value: formatPercent(analytics.conversion.freeToProRate) },
  ];

  return (
    <>
      {error && loadState === 'error' && (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      )}

      {isEmpty ? (
        <div className="admin-empty glass-panel">
          <p className="admin-empty__title">Нет данных для аналитики</p>
          <p className="admin-empty__desc">Метрики появятся после регистрации пользователей и запусков workflow</p>
        </div>
      ) : (
        <>
          <div className="admin-section">
            <h3 className="admin-section__title">Users</h3>
            <div className="admin-stats-grid">
              {userCards.map((card) => (
                <article key={card.label} className="admin-stat-card glass-card">
                  <p className="admin-stat-card__value">{card.value}</p>
                  <p className="admin-stat-card__label">{card.label}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-section">
            <h3 className="admin-section__title">Pro Requests</h3>
            <div className="admin-stats-grid admin-stats-grid--requests">
              {requestCards.map((card) => (
                <article key={card.label} className="admin-stat-card glass-card">
                  <p className="admin-stat-card__value">{card.value}</p>
                  <p className="admin-stat-card__label">{card.label}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-section">
            <h3 className="admin-section__title">Workflows</h3>
            <div className="admin-stats-grid">
              {workflowCards.map((card) => (
                <article key={card.label} className="admin-stat-card glass-card">
                  <p className="admin-stat-card__value">{card.value}</p>
                  <p className="admin-stat-card__label">{card.label}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-section">
            <h3 className="admin-section__title">Time Period Stats</h3>
            <div className="admin-analytics-periods">
              <PeriodTable title="Last 7 Days" data={analytics.periods.last7Days} />
              <PeriodTable title="Last 30 Days" data={analytics.periods.last30Days} />
            </div>
          </div>

          <div className="admin-section">
            <h3 className="admin-section__title">Top Workflows</h3>
            {analytics.workflows.topWorkflows.length === 0 ? (
              <div className="admin-empty glass-panel">
                <p className="admin-empty__title">Нет запусков workflow</p>
                <p className="admin-empty__desc">Популярные workflow появятся после первых запусков</p>
              </div>
            ) : (
              <div className="admin-table-wrap glass-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Workflow Type</th>
                      <th>Total Runs</th>
                      <th>Runs Last 30 Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.workflows.topWorkflows.map((row) => (
                      <tr key={row.workflow_type}>
                        <td>
                          <span className="admin-table__name">{row.workflow_type}</span>
                        </td>
                        <td>{row.totalRuns}</td>
                        <td>{row.runsLast30Days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};
