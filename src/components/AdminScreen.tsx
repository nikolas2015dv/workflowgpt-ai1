import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { adminChangeUserPlan, fetchAdminStats, fetchAdminUsers } from '../lib/adminApi';
import { formatRoleLabel } from '../lib/planLimits';
import type { AdminStats, AdminUserRow } from '../types/admin';
import type { UserRole } from '../types/user';

type LoadState = 'loading' | 'ready' | 'error';

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

function formatUserLabel(row: AdminUserRow): string {
  const name = row.first_name?.trim() || 'User';
  return row.username ? `${name} (@${row.username})` : name;
}

export const AdminScreen: React.FC = () => {
  const { user, isOwner } = useAuth();
  const { showToast } = useToast();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id || !isOwner) return;

    setLoadState('loading');
    setError(null);

    try {
      const [nextUsers, nextStats] = await Promise.all([
        fetchAdminUsers(user.id),
        fetchAdminStats(user.id),
      ]);
      setUsers(nextUsers);
      setStats(nextStats);
      setLoadState('ready');
    } catch (e) {
      setLoadState('error');
      setError(e instanceof Error ? e.message : 'Не удалось загрузить админку');
    }
  }, [user?.id, isOwner]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  if (loadState === 'loading' && !stats) {
    return (
      <section className="admin-screen">
        <div className="admin-loading glass-panel" role="status">
          <p>Загрузка Admin Dashboard…</p>
        </div>
      </section>
    );
  }

  if (loadState === 'error' && !stats) {
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

  const statCards = stats
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

  return (
    <section className="admin-screen">
      <div className="section-intro admin-screen__intro">
        <div>
          <h2 className="section-title">Admin</h2>
          <p className="section-desc">Управление пользователями и статистика системы</p>
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

      {error && loadState === 'error' && (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-stats-grid">
        {statCards.map((card) => (
          <article key={card.label} className="admin-stat-card glass-card">
            <p className="admin-stat-card__value">{card.value}</p>
            <p className="admin-stat-card__label">{card.label}</p>
          </article>
        ))}
      </div>

      <div className="admin-section">
        <h3 className="admin-section__title">Users</h3>

        {users.length === 0 ? (
          <div className="admin-empty glass-panel">
            <p className="admin-empty__title">Нет пользователей</p>
            <p className="admin-empty__desc">Список пуст или ещё не загружен</p>
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
                {users.map((row) => {
                  const isChanging = changingUserId === row.id;
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="admin-table__name">{formatUserLabel(row)}</span>
                        <span className="admin-table__meta">ID {row.telegram_id}</span>
                      </td>
                      <td>
                        <span className={`admin-pill admin-pill--${row.role}`}>{formatRoleLabel(row.role)}</span>
                      </td>
                      <td>
                        <span className={`admin-pill admin-pill--${row.plan}`}>{formatRoleLabel(row.plan)}</span>
                      </td>
                      <td>{row.monthly_runs}</td>
                      <td>{row.total_runs}</td>
                      <td>{formatDate(row.created_at)}</td>
                      <td>
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
      </div>
    </section>
  );
};
