import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  formatLimitValue,
  formatRoleLabel,
  formatTariffLabel,
  getUsageQuota,
  isUnlimitedRole,
} from '../lib/planLimits';
import { formatSubscriptionStatus } from '../lib/subscriptionApi';

export const ProfileScreen: React.FC = () => {
  const { user, subscription, effectivePlan, usage, isLoading, isDevMode, error, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    void refreshUser();
  }, [user?.id, refreshUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <section className="profile-screen">
        <div className="profile-loading glass-panel" role="status">
          <p>Загрузка профиля…</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="profile-screen">
        <div className="profile-empty glass-panel">
          <p className="profile-empty__title">Профиль недоступен</p>
          <p className="profile-empty__desc">{error ?? 'Не удалось авторизовать пользователя'}</p>
        </div>
      </section>
    );
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.first_name;
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const planRole = effectivePlan ?? user.role;
  const unlimited = isUnlimitedRole(planRole);
  const quota =
    usage ??
    getUsageQuota(planRole, user.monthly_runs, user.total_runs);

  return (
    <section className="profile-screen">
      <div className="section-intro">
        <h2 className="section-title">Profile</h2>
        <p className="section-desc">
          {isDevMode ? 'Режим разработки (вне Telegram)' : 'Аккаунт Telegram Mini App'}
        </p>
      </div>

      {error && (
        <p className="profile-error" role="status">
          {error}
        </p>
      )}

      <article className="profile-card glass-card">
        <div className="profile-card__header">
          {user.photo_url ? (
            <img className="profile-card__avatar" src={user.photo_url} alt="" />
          ) : (
            <span className="profile-card__avatar profile-card__avatar--fallback" aria-hidden="true">
              {avatarLetter}
            </span>
          )}
          <div className="profile-card__identity">
            <h3 className="profile-card__name">{displayName}</h3>
            {user.username ? (
              <p className="profile-card__username">@{user.username}</p>
            ) : (
              <p className="profile-card__username profile-card__username--muted">без username</p>
            )}
          </div>
        </div>

        <dl className="profile-stats">
          <div className="profile-stats__row">
            <dt>Telegram ID</dt>
            <dd>{user.telegram_id}</dd>
          </div>
          <div className="profile-stats__row">
            <dt>Роль</dt>
            <dd>
              <span className={`profile-role profile-role--${planRole}`}>{formatRoleLabel(planRole)}</span>
            </dd>
          </div>
          <div className="profile-stats__row">
            <dt>Current Plan</dt>
            <dd>{formatTariffLabel(planRole)}</dd>
          </div>
          <div className="profile-stats__row">
            <dt>Subscription Status</dt>
            <dd>{formatSubscriptionStatus(subscription?.status ?? 'active')}</dd>
          </div>
          <div className="profile-stats__row">
            <dt>Monthly Limit</dt>
            <dd>{unlimited ? 'Unlimited' : formatLimitValue(planRole)}</dd>
          </div>
          {!unlimited && (
            <>
              <div className="profile-stats__row">
                <dt>Remaining Runs</dt>
                <dd>{quota.remaining ?? 0}</dd>
              </div>
              <div className="profile-stats__row">
                <dt>Использовано</dt>
                <dd>{quota.monthly_runs}</dd>
              </div>
            </>
          )}
          {unlimited && (
            <div className="profile-stats__row">
              <dt>Remaining Runs</dt>
              <dd>Unlimited</dd>
            </div>
          )}
          <div className="profile-stats__row">
            <dt>Всего запусков</dt>
            <dd>{user.total_runs}</dd>
          </div>
          {subscription?.provider && (
            <div className="profile-stats__row">
              <dt>Provider</dt>
              <dd>{subscription.provider}</dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          className="btn-export btn-export--ghost profile-refresh"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {refreshing ? 'Обновление…' : 'Обновить'}
        </button>
      </article>
    </section>
  );
};
