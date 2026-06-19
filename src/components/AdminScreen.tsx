import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  adminChangeUserPlan,
  approveAdminProRequest,
  fetchAdminProRequests,
  fetchAdminStats,
  fetchAdminUsers,
  rejectAdminProRequest,
} from '../lib/adminApi';
import {
  fetchAdminBillingStats,
  fetchAdminBillingTransactions,
  formatMoney,
  formatProviderLabel,
  formatTransactionStatus,
} from '../lib/billingApi';
import { formatRoleLabel } from '../lib/planLimits';
import type { AdminPlanFilter, AdminProRequest, AdminStats, AdminUserRow } from '../types/admin';
import type { BillingStats, BillingStatusFilter, BillingTransaction } from '../types/billing';
import type { UserRole } from '../types/user';
import { AdminUserDetailsPanel } from './AdminUserDetailsPanel';
import { AdminProRequestDetails } from './AdminProRequestDetails';

type LoadState = 'loading' | 'ready' | 'error';
type AdminView = 'overview' | 'billing';

const STATUS_FILTERS: BillingStatusFilter[] = ['all', 'paid', 'paid_manual', 'pending', 'failed', 'refunded', 'cancelled'];
const PLAN_FILTERS: { id: AdminPlanFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'pro', label: 'Pro' },
  { id: 'owner', label: 'Owner' },
];

function formatDate(value: string): string {
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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatUserLabel(row: AdminUserRow): string {
  const name = row.first_name?.trim() || 'User';
  return row.username ? `${name} (@${row.username})` : name;
}

function formatProRequestUserLabel(request: AdminProRequest): string {
  const name = request.first_name?.trim() || 'User';
  return request.username ? `${name} (@${request.username})` : name;
}

function formatTransactionUserLabel(userId: string, users: AdminUserRow[]): string {
  const row = users.find((u) => u.id === userId);
  if (!row) return userId.slice(0, 8) + '…';
  return formatUserLabel(row);
}

function matchesUserSearch(row: AdminUserRow, query: string): boolean {
  const search = query.trim().toLowerCase();
  if (!search) return true;

  return (
    (row.username ?? '').toLowerCase().includes(search) ||
    (row.first_name ?? '').toLowerCase().includes(search) ||
    (row.last_name ?? '').toLowerCase().includes(search) ||
    String(row.telegram_id).includes(search)
  );
}

export const AdminScreen: React.FC = () => {
  const { user, isOwner } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState<AdminView>('overview');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [billingStats, setBillingStats] = useState<BillingStats | null>(null);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [proRequests, setProRequests] = useState<AdminProRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<BillingStatusFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<AdminPlanFilter>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedProRequestId, setSelectedProRequestId] = useState<string | null>(null);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [approvingTxId, setApprovingTxId] = useState<string | null>(null);
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!user?.id || !isOwner) return;

    const [nextUsers, nextStats, nextBillingStats, nextProRequests] = await Promise.all([
      fetchAdminUsers(user.id),
      fetchAdminStats(user.id),
      fetchAdminBillingStats(user.id),
      fetchAdminProRequests(user.id),
    ]);
    setUsers(nextUsers);
    setStats(nextStats);
    setBillingStats(nextBillingStats);
    setProRequests(nextProRequests);
  }, [user?.id, isOwner]);

  const loadBilling = useCallback(async () => {
    if (!user?.id || !isOwner) return;

    const [nextBillingStats, nextTransactions, nextUsers] = await Promise.all([
      fetchAdminBillingStats(user.id),
      fetchAdminBillingTransactions(user.id, statusFilter),
      fetchAdminUsers(user.id),
    ]);
    setBillingStats(nextBillingStats);
    setTransactions(nextTransactions);
    setUsers(nextUsers);
  }, [user?.id, isOwner, statusFilter]);

  const loadData = useCallback(async () => {
    if (!user?.id || !isOwner) return;

    setLoadState('loading');
    setError(null);

    try {
      if (view === 'overview') {
        await loadOverview();
      } else {
        await loadBilling();
      }
      setLoadState('ready');
    } catch (e) {
      setLoadState('error');
      setError(e instanceof Error ? e.message : 'Не удалось загрузить админку');
    }
  }, [user?.id, isOwner, view, loadOverview, loadBilling]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    return users.filter((row) => {
      const matchesPlan = planFilter === 'all' || row.plan === planFilter;
      return matchesPlan && matchesUserSearch(row, searchQuery);
    });
  }, [users, planFilter, searchQuery]);

  const selectedUser = useMemo(
    () => users.find((row) => row.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const selectedProRequest = useMemo(
    () => proRequests.find((request) => request.id === selectedProRequestId) ?? null,
    [proRequests, selectedProRequestId]
  );

  const handleApproveRequest = async (transactionId: string) => {
    if (!user?.id) return;

    setApprovingTxId(transactionId);
    try {
      await approveAdminProRequest(user.id, transactionId);
      showToast('Заявка одобрена, пользователь переведён на Pro', 'success');
      setSelectedProRequestId(null);
      await loadData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Не удалось одобрить заявку', 'error');
    } finally {
      setApprovingTxId(null);
    }
  };

  const handleRejectRequest = async (transactionId: string) => {
    if (!user?.id) return;

    setRejectingTxId(transactionId);
    try {
      await rejectAdminProRequest(user.id, transactionId);
      showToast('Заявка отклонена', 'success');
      setSelectedProRequestId(null);
      await loadData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Не удалось отклонить заявку', 'error');
    } finally {
      setRejectingTxId(null);
    }
  };

  const handleSetPlan = async (targetUserId: string, plan: UserRole) => {
    if (!user?.id) return;

    setChangingUserId(targetUserId);
    try {
      await adminChangeUserPlan(user.id, { userId: targetUserId, plan });
      showToast(`Plan set to ${formatRoleLabel(plan)}`, 'success');
      await loadData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Не удалось сменить тариф', 'error');
    } finally {
      setChangingUserId(null);
    }
  };

  if (!isOwner) {
    return null;
  }

  if (loadState === 'loading' && !stats && view === 'overview') {
    return (
      <section className="admin-screen">
        <div className="admin-loading glass-panel" role="status">
          <p>Загрузка Admin Dashboard…</p>
        </div>
      </section>
    );
  }

  if (loadState === 'error' && !stats && view === 'overview') {
    return (
      <section className="admin-screen">
        <div className="admin-error glass-panel">
          <p className="admin-error__title">Ошибка загрузки</p>
          <p className="admin-error__desc">{error ?? 'Неизвестная ошибка'}</p>
          <button type="button" className="btn-primary btn-primary--outline" onClick={() => void loadData()}>
            Повторить
          </button>
        </div>
      </section>
    );
  }

  const currency = billingStats?.currency ?? 'RUB';

  const overviewStatCards = stats
    ? [
        { label: 'Всего пользователей', value: stats.total_users },
        { label: 'Free', value: stats.free_users },
        { label: 'Pro', value: stats.pro_users },
        { label: 'Owner', value: stats.owner_users },
        { label: 'Запусков всего', value: stats.total_workflows },
        { label: 'Записей истории', value: stats.total_history_records },
        { label: 'Запусков в месяце', value: stats.workflows_this_month },
      ]
    : [];

  const requestStatCards = billingStats
    ? [
        { label: 'Pending Requests', value: billingStats.pending_requests ?? 0 },
        { label: 'Approved Requests', value: billingStats.approved_requests ?? 0 },
        { label: 'Rejected Requests', value: billingStats.rejected_requests ?? 0 },
      ]
    : [];

  const revenueCards = billingStats
    ? [
        { label: 'Total Revenue', value: formatMoney(billingStats.total_revenue, currency) },
        { label: 'Paid Transactions', value: billingStats.paid_transactions },
        { label: 'Pending Transactions', value: billingStats.pending_transactions },
        { label: 'Active Pro Users', value: billingStats.active_pro_users },
      ]
    : [];

  return (
    <section className="admin-screen">
      <div className="section-intro admin-screen__intro">
        <div>
          <h2 className="section-title">Admin</h2>
          <p className="section-desc">Управление платформой и биллингом</p>
        </div>
        <button
          type="button"
          className="btn-primary btn-primary--outline admin-screen__refresh"
          onClick={() => void loadData()}
          disabled={loadState === 'loading'}
        >
          {loadState === 'loading' ? 'Обновление…' : 'Обновить'}
        </button>
      </div>

      <div className="admin-subtabs glass-panel">
        <button
          type="button"
          className={`admin-subtabs__item${view === 'overview' ? ' admin-subtabs__item--active' : ''}`}
          onClick={() => setView('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`admin-subtabs__item${view === 'billing' ? ' admin-subtabs__item--active' : ''}`}
          onClick={() => setView('billing')}
        >
          Billing Management
        </button>
      </div>

      {error && loadState === 'error' && (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      )}

      {view === 'overview' && (
        <>
          <div className="admin-section">
            <h3 className="admin-section__title">Revenue</h3>
            <div className="admin-stats-grid admin-stats-grid--revenue">
              {revenueCards.map((card) => (
                <article key={card.label} className="admin-stat-card glass-card admin-stat-card--revenue">
                  <p className="admin-stat-card__value">{card.value}</p>
                  <p className="admin-stat-card__label">{card.label}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-stats-grid">
            {overviewStatCards.map((card) => (
              <article key={card.label} className="admin-stat-card glass-card">
                <p className="admin-stat-card__value">{card.value}</p>
                <p className="admin-stat-card__label">{card.label}</p>
              </article>
            ))}
          </div>

          <div className="admin-section">
            <h3 className="admin-section__title">Pro Request Stats</h3>
            <div className="admin-stats-grid admin-stats-grid--requests">
              {requestStatCards.map((card) => (
                <article key={card.label} className="admin-stat-card glass-card">
                  <p className="admin-stat-card__value">{card.value}</p>
                  <p className="admin-stat-card__label">{card.label}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-section">
            <h3 className="admin-section__title">Pro Requests</h3>

            {proRequests.length === 0 ? (
              <div className="admin-empty glass-panel">
                <p className="admin-empty__title">Нет заявок</p>
                <p className="admin-empty__desc">Новые заявки появятся после отправки формы на Pricing</p>
              </div>
            ) : (
              <div className="admin-table-wrap glass-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Telegram ID</th>
                      <th>Amount</th>
                      <th>Created at</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proRequests.map((request) => {
                      const isSelected = selectedProRequestId === request.id;
                      return (
                        <tr
                          key={request.id}
                          className={isSelected ? 'admin-table__row--selected' : undefined}
                          onClick={() => setSelectedProRequestId(request.id)}
                        >
                          <td>
                            <span className="admin-table__name">
                              {request.request_name || formatProRequestUserLabel(request)}
                            </span>
                          </td>
                          <td>{request.telegram_id ?? '—'}</td>
                          <td>{formatMoney(request.amount, request.currency)}</td>
                          <td>{formatDateTime(request.created_at)}</td>
                          <td>
                            <span className={`billing-status billing-status--${request.status}`}>
                              {formatTransactionStatus(request.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {selectedProRequest && (
              <AdminProRequestDetails
                request={selectedProRequest}
                approving={approvingTxId === selectedProRequest.id}
                rejecting={rejectingTxId === selectedProRequest.id}
                onApprove={() => void handleApproveRequest(selectedProRequest.id)}
                onReject={() => void handleRejectRequest(selectedProRequest.id)}
                onClose={() => setSelectedProRequestId(null)}
              />
            )}
          </div>

          <div className="admin-section">
            <h3 className="admin-section__title">Users</h3>

            <div className="admin-toolbar glass-panel">
              <input
                type="search"
                className="admin-search"
                placeholder="Найти пользователя..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Поиск пользователей"
              />
              <div className="admin-filters">
                {PLAN_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`admin-filters__btn${planFilter === filter.id ? ' admin-filters__btn--active' : ''}`}
                    onClick={() => setPlanFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="admin-empty glass-panel">
                <p className="admin-empty__title">Пользователи не найдены</p>
                <p className="admin-empty__desc">Измените поиск или фильтр</p>
              </div>
            ) : (
              <div className="admin-table-wrap glass-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Пользователь</th>
                      <th>Role</th>
                      <th>Plan</th>
                      <th>Месяц</th>
                      <th>Всего</th>
                      <th>Создан</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((row) => {
                      const isChanging = changingUserId === row.id;
                      const isSelected = selectedUserId === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={isSelected ? 'admin-table__row--selected' : undefined}
                          onClick={() => setSelectedUserId(row.id)}
                        >
                          <td>
                            <span className="admin-table__name">{formatUserLabel(row)}</span>
                            <span className="admin-table__meta">ID {row.telegram_id}</span>
                          </td>
                          <td>
                            <span className={`admin-pill admin-pill--${row.role}`}>
                              {formatRoleLabel(row.role)}
                            </span>
                          </td>
                          <td>
                            <span className={`admin-pill admin-pill--${row.plan}`}>
                              {formatRoleLabel(row.plan)}
                            </span>
                          </td>
                          <td>{row.monthly_runs}</td>
                          <td>{row.total_runs}</td>
                          <td>{formatDate(row.created_at)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="admin-actions">
                              {(['free', 'pro', 'owner'] as const).map((plan) => (
                                <button
                                  key={plan}
                                  type="button"
                                  className={`admin-actions__btn${row.plan === plan ? ' admin-actions__btn--active' : ''}`}
                                  disabled={isChanging || row.plan === plan}
                                  onClick={() => void handleSetPlan(row.id, plan)}
                                >
                                  {isChanging ? '…' : `Set ${formatRoleLabel(plan)}`}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {selectedUser && user?.id && (
              <AdminUserDetailsPanel
                adminUserId={user.id}
                user={selectedUser}
                onClose={() => setSelectedUserId(null)}
              />
            )}
          </div>
        </>
      )}

      {view === 'billing' && (
        <div className="admin-section">
          <h3 className="admin-section__title">All Transactions</h3>

          <div className="admin-filters">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`admin-filters__btn${statusFilter === filter ? ' admin-filters__btn--active' : ''}`}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'all' ? 'All' : formatTransactionStatus(filter)}
              </button>
            ))}
          </div>

          {loadState === 'loading' && transactions.length === 0 ? (
            <div className="admin-loading glass-panel" role="status">
              <p>Загрузка транзакций…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="admin-empty glass-panel">
              <p className="admin-empty__title">Нет транзакций</p>
              <p className="admin-empty__desc">Платежи появятся после checkout пользователей</p>
            </div>
          ) : (
            <div className="admin-table-wrap glass-panel">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Пользователь</th>
                    <th>План</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Провайдер</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{formatDateTime(tx.created_at)}</td>
                      <td>
                        <span className="admin-table__name">
                          {formatTransactionUserLabel(tx.user_id, users)}
                        </span>
                      </td>
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
      )}
    </section>
  );
};
