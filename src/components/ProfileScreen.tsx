import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { formatPlanLimitLabel, formatRoleLabel } from '../lib/planLimits';

export const ProfileScreen: React.FC = () => {
  const { user, isLoading, isDevMode, error, refreshUser } = useAuth();
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
            <dt>Роль</dt>
            <dd>
              <span className={`profile-role profile-role--${user.role}`}>{formatRoleLabel(user.role)}</span>
            </dd>
          </div>
          <div className="profile-stats__row">
            <dt>Лимит</dt>
            <dd>{formatPlanLimitLabel(user.role)}</dd>
          </div>
          <div className="profile-stats__row">
            <dt>Всего запусков</dt>
            <dd>{user.total_runs}</dd>
          </div>
          <div className="profile-stats__row">
            <dt>Запусков за месяц</dt>
            <dd>{user.monthly_runs}</dd>
          </div>
          <div className="profile-stats__row">
            <dt>Telegram ID</dt>
            <dd>{user.telegram_id}</dd>
          </div>
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
