import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  BILLING_PENDING_MESSAGE,
  createBillingCheckout,
  fetchBillingSummary,
  formatMoney,
} from '../lib/billingApi';
import {
  canUpgradeToPlan,
  getVisiblePricingPlans,
  isCurrentPlan,
} from '../lib/pricingPlans';
import { formatRoleLabel } from '../lib/planLimits';
import type { BillingTransaction } from '../types/billing';
import type { UserRole } from '../types/user';

export const PricingScreen: React.FC = () => {
  const { user, effectivePlan, isLoading, isOwner } = useAuth();
  const { showToast } = useToast();
  const [processingPlan, setProcessingPlan] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<BillingTransaction | null>(null);

  const loadPending = useCallback(async () => {
    if (!user?.id || isOwner) return;
    try {
      const summary = await fetchBillingSummary(user.id);
      setPendingTransaction(summary.pending_transaction);
    } catch {
      setPendingTransaction(null);
    }
  }, [user?.id, isOwner]);

  useEffect(() => {
    void loadPending();
  }, [loadPending, effectivePlan]);

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
  const proPending = pendingTransaction?.plan === 'pro' ? pendingTransaction : null;

  const handleCreateTransaction = async (targetPlan: UserRole) => {
    if (isOwner || !canUpgradeToPlan(currentPlan, targetPlan)) return;

    setProcessingPlan(targetPlan);
    setError(null);

    try {
      const transaction = await createBillingCheckout(user.id, { plan: targetPlan, provider: 'manual' });
      if (transaction.status !== 'pending') {
        throw new Error('Unexpected transaction status.');
      }
      setPendingTransaction(transaction);
      showToast(BILLING_PENDING_MESSAGE, 'info');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось создать транзакцию';
      setError(message);
      showToast(message, 'error');
    } finally {
      setProcessingPlan(null);
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
          const isProcessing = processingPlan === plan.id;
          const hasPendingForPlan = proPending?.plan === plan.id;

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

              <p className="pricing-card__limit">
                {plan.priceLabel ?? plan.limitLabel}
              </p>
              {plan.priceLabel && (
                <p className="pricing-card__limit-note">{plan.limitLabel}</p>
              )}

              <ul className="pricing-card__features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <div className="pricing-card__status">
                {isCurrent ? (
                  <span className="pricing-card__current">Current Plan</span>
                ) : hasPendingForPlan && proPending ? (
                  <div className="pricing-card__checkout">
                    <p className="pricing-card__pending">
                      Заявка на {formatRoleLabel(proPending.plan)}:{' '}
                      {formatMoney(proPending.amount, proPending.currency)} — ожидает оплаты
                    </p>
                    <p className="pricing-card__pending-note">{BILLING_PENDING_MESSAGE}</p>
                  </div>
                ) : canUpgrade ? (
                  <button
                    type="button"
                    className="btn-primary pricing-card__btn"
                    disabled={isProcessing}
                    onClick={() => void handleCreateTransaction(plan.id)}
                  >
                    {isProcessing ? 'Создание…' : 'Start Checkout'}
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
