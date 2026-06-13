import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { changeSubscriptionPlan } from '../lib/subscriptionApi';
import {
  canUpgradeToPlan,
  getVisiblePricingPlans,
  isCurrentPlan,
} from '../lib/pricingPlans';
import { formatRoleLabel } from '../lib/planLimits';
import type { UserRole } from '../types/user';

export const PricingScreen: React.FC = () => {
  const { user, effectivePlan, isLoading, isOwner, applySubscriptionResult } = useAuth();
  const { showToast } = useToast();
  const [upgradingPlan, setUpgradingPlan] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <section className="pricing-screen">
        <div className="pricing-loading glass-panel" role="status">
          <p>Загрузка тарифов…</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="pricing-screen">
        <div className="pricing-empty glass-panel">
          <p className="pricing-empty__title">Тарифы недоступны</p>
          <p className="pricing-empty__desc">Войдите через Telegram, чтобы увидеть планы</p>
        </div>
      </section>
    );
  }

  const currentPlan = effectivePlan ?? user.role;
  const plans = getVisiblePricingPlans(isOwner);

  const handleUpgrade = async (targetPlan: UserRole) => {
    if (isOwner || !canUpgradeToPlan(currentPlan, targetPlan)) return;

    setUpgradingPlan(targetPlan);
    setError(null);

    try {
      const result = await changeSubscriptionPlan(user.id, { plan: targetPlan });
      applySubscriptionResult(result);
      showToast('Plan upgraded successfully', 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось сменить тариф';
      setError(message);
      showToast(message, 'error');
    } finally {
      setUpgradingPlan(null);
    }
  };

  return (
    <section className="pricing-screen">
      <div className="section-intro">
        <h2 className="section-title">Pricing</h2>
        <p className="section-desc">
          Текущий план: <strong>{formatRoleLabel(currentPlan)}</strong>
        </p>
      </div>

      {error && (
        <p className="pricing-error" role="alert">
          {error}
        </p>
      )}

      <div className="pricing-grid">
        {plans.map((plan) => {
          const isCurrent = isCurrentPlan(currentPlan, plan.id);
          const canUpgrade = !isOwner && canUpgradeToPlan(currentPlan, plan.id);
          const isUpgrading = upgradingPlan === plan.id;

          return (
            <article
              key={plan.id}
              className={`pricing-card glass-card${isCurrent ? ' pricing-card--current' : ''}${plan.id === 'pro' ? ' pricing-card--featured' : ''}`}
            >
              {plan.id === 'pro' && <span className="pricing-card__badge">Popular</span>}
              {plan.hidden && <span className="pricing-card__badge pricing-card__badge--owner">Hidden</span>}

              <header className="pricing-card__header">
                <h3 className="pricing-card__name">{plan.name}</h3>
                <p className="pricing-card__desc">{plan.description}</p>
              </header>

              <p className="pricing-card__limit">{plan.limitLabel}</p>

              <ul className="pricing-card__features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <div className="pricing-card__status">
                {isCurrent ? (
                  <span className="pricing-card__current">Current Plan</span>
                ) : canUpgrade ? (
                  <button
                    type="button"
                    className="btn-primary pricing-card__btn"
                    disabled={isUpgrading}
                    onClick={() => void handleUpgrade(plan.id)}
                  >
                    {isUpgrading ? 'Upgrading…' : 'Upgrade'}
                  </button>
                ) : (
                  <span className="pricing-card__muted">
                    {isOwner ? 'Managed by admin' : '—'}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
