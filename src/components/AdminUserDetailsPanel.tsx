import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminUserBilling,
  fetchAdminUserHistory,
} from '../lib/adminApi';
import {
  formatMoney,
  formatProviderLabel,
  formatTransactionStatus,
} from '../lib/billingApi';
import { formatRoleLabel } from '../lib/planLimits';
import type { AdminUserHistoryRow, AdminUserRow } from '../types/admin';
import type { BillingTransaction } from '../types/billing';

type PanelLoadState = 'idle' | 'loading' | 'ready' | 'error';

interface AdminUserDetailsPanelProps {
  adminUserId: string;
  user: AdminUserRow;
  onClose: () => void;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="admin-detail-row">
      <span className="admin-detail-row__label">{label}</span>
      <span className="admin-detail-row__value">{value}</span>
    </div>
  );
}

export const AdminUserDetailsPanel: React.FC<AdminUserDetailsPanelProps> = ({
  adminUserId,
  user,
  onClose,
}) => {
  const [loadState, setLoadState] = useState<PanelLoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AdminUserHistoryRow[]>([]);
  const [billing, setBilling] = useState<BillingTransaction[]>([]);

  const loadDetails = useCallback(async () => {
    setLoadState('loading');
    setError(null);

    try {
      const [nextHistory, nextBilling] = await Promise.all([
        fetchAdminUserHistory(adminUserId, user.id),
        fetchAdminUserBilling(adminUserId, user.id),
      ]);
      setHistory(nextHistory);
      setBilling(nextBilling);
      setLoadState('ready');
    } catch (e) {
      setLoadState('error');
      setError(e instanceof Error ? e.message : 'Не удалось загрузить данные пользователя');
    }
  }, [adminUserId, user.id]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const displayName = user.username
    ? `${user.first_name} (@${user.username})`
    : user.first_name || 'User';

  return (
    <article className="admin-user-details glass-card">
      <div className="admin-user-details__header">
        <div>
          <h3 className="admin-user-details__title">{displayName}</h3>
          <p className="admin-user-details__subtitle">Подробная карточка пользователя</p>
        </div>
        <button type="button" className="admin-user-details__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      <div className="admin-user-details__grid">
        <DetailRow label="Telegram ID" value={user.telegram_id} />
        <DetailRow label="Username" value={user.username ? `@${user.username}` : '—'} />
        <DetailRow label="First name" value={user.first_name || '—'} />
        <DetailRow label="Last name" value={user.last_name?.trim() || '—'} />
        <DetailRow label="Role" value={formatRoleLabel(user.role)} />
        <DetailRow label="Current plan" value={formatRoleLabel(user.plan)} />
        <DetailRow label="Monthly runs" value={user.monthly_runs} />
        <DetailRow label="Total runs" value={user.total_runs} />
        <DetailRow label="Created at" value={formatDate(user.created_at)} />
        <DetailRow label="Last login" value={formatDate(user.last_login_at)} />
        <DetailRow label="Provider" value={formatProviderLabel(user.provider)} />
        <DetailRow label="Subscription status" value={user.subscription_status} />
      </div>

      {loadState === 'loading' && (
        <div className="admin-user-details__loading glass-panel" role="status">
          <p>Загрузка истории и биллинга…</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="admin-user-details__error glass-panel">
          <p className="admin-error__title">Ошибка</p>
          <p className="admin-error__desc">{error ?? 'Неизвестная ошибка'}</p>
          <button type="button" className="btn-primary btn-primary--outline" onClick={() => void loadDetails()}>
            Повторить
          </button>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <div className="admin-user-details__section">
            <h4 className="admin-user-details__section-title">Workflow History</h4>
            {history.length === 0 ? (
              <div className="admin-empty glass-panel">
                <p className="admin-empty__title">Нет записей</p>
                <p className="admin-empty__desc">Пользователь ещё не запускал workflow</p>
              </div>
            ) : (
              <div className="admin-table-wrap glass-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Subject</th>
                      <th>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateTime(row.created_at)}</td>
                        <td>{row.workflow_type}</td>
                        <td>{row.subject || '—'}</td>
                        <td>{row.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-user-details__section">
            <h4 className="admin-user-details__section-title">Billing Transactions</h4>
            {billing.length === 0 ? (
              <div className="admin-empty glass-panel">
                <p className="admin-empty__title">Нет транзакций</p>
                <p className="admin-empty__desc">У пользователя нет billing-записей</p>
              </div>
            ) : (
              <div className="admin-table-wrap glass-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Provider</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.map((tx) => (
                      <tr key={tx.id}>
                        <td>{formatDateTime(tx.created_at)}</td>
                        <td>{formatRoleLabel(tx.plan)}</td>
                        <td>{formatMoney(tx.amount, tx.currency)}</td>
                        <td>
                          <span className={`billing-status billing-status--${tx.status}`}>
                            {formatTransactionStatus(tx.status)}
                          </span>
                        </td>
                        <td>{formatProviderLabel(tx.provider)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
};
