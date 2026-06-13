import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  fetchBillingHistory,
  fetchBillingSummary,
  formatMoney,
  formatProviderLabel,
  formatTransactionStatus,
  payBillingTransaction,
} from '../lib/billingApi';
import { formatRoleLabel } from '../lib/planLimits';
import type { BillingSummary, BillingTransaction } from '../types/billing';

type LoadState = 'loading' | 'ready' | 'error';

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

export const BillingScreen: React.FC = () => {
  const { user, effectivePlan, isLoading: authLoading, applySubscriptionResult } = useAuth();
  const { showToast } = useToast();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoadState('loading');
    setError(null);

    try {
      const [nextSummary, nextHistory] = await Promise.all([
        fetchBillingSummary(user.id),
        fetchBillingHistory(user.id),
      ]);
      setSummary(nextSummary);
      setTransactions(nextHistory);
      setLoadState('ready');
    } catch (e) {
      setLoadState('error');
      setError(e instanceof Error ? e.message : 'Не удалось загрузить биллинг');
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void loadData();
  }, [user?.id, loadData]);

  const handlePayPending = async (transactionId: string) => {
    if (!user?.id) return;

    setPayingId(transactionId);
    try {
      const result = await payBillingTransaction(user.id, { transactionId });
      applySubscriptionResult(result);
      showToast('Plan upgraded successfully', 'success');
      await loadData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Оплата не прошла', 'error');
    } finally {
      setPayingId(null);
    }
  };

  if (authLoading) {
    return (
      <section className="billing-screen">
        <div className="billing-loading glass-panel" role="status">
          <p>Загрузка биллинга…</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="billing-screen">
        <div className="billing-empty glass-panel">
          <p className="billing-empty__title">Billing недоступен</p>
          <p className="billing-empty__desc">Войдите через Telegram</p>
        </div>
      </section>
    );
  }

  if (loadState === 'loading' && !summary) {
    return (
      <section className="billing-screen">
        <div className="billing-loading glass-panel" role="status">
          <p>Загрузка данных…</p>
        </div>
      </section>
    );
  }

  if (loadState === 'error' && !summary) {
    return (
      <section className="billing-screen">
        <div className="billing-error glass-panel">
          <p className="billing-error__title">Ошибка</p>
          <p className="billing-error__desc">{error ?? 'Неизвестная ошибка'}</p>
          <button type="button" className="btn-primary btn-primary--outline" onClick={() => void loadData()}>
            Повторить
          </button>
        </div>
      </section>
    );
  }

  const currentPlan = summary?.active_plan ?? effectivePlan ?? user.role;
  const currency = summary?.currency ?? 'USD';
  const pending = summary?.pending_transaction;

  return (
    <section className="billing-screen">
      <div className="section-intro billing-screen__intro">
        <div>
          <h2 className="section-title">Billing</h2>
          <p className="section-desc">Платежи и статус подписки</p>
        </div>
        <button
          type="button"
          className="btn-primary btn-primary--outline billing-screen__refresh"
          onClick={() => void loadData()}
          disabled={loadState === 'loading'}
        >
          {loadState === 'loading' ? '…' : 'Обновить'}
        </button>
      </div>

      <article className="billing-plan-card glass-card">
        <p className="billing-plan-card__label">Current Plan</p>
        <p className="billing-plan-card__value">{formatRoleLabel(currentPlan)}</p>
        {pending && (
          <div className="billing-pending">
            <p className="billing-pending__text">
              Ожидает оплаты: {formatRoleLabel(pending.plan)} —{' '}
              {formatMoney(pending.amount, pending.currency)}
            </p>
            <button
              type="button"
              className="btn-primary billing-pending__btn"
              disabled={payingId === pending.id}
              onClick={() => void handlePayPending(pending.id)}
            >
              {payingId === pending.id ? 'Processing…' : 'Pay Now'}
            </button>
          </div>
        )}
      </article>

      <div className="billing-summary-grid">
        <article className="billing-stat-card glass-card">
          <p className="billing-stat-card__value">{formatMoney(summary?.total_paid ?? 0, currency)}</p>
          <p className="billing-stat-card__label">Total Paid</p>
        </article>
        <article className="billing-stat-card glass-card">
          <p className="billing-stat-card__value">{summary?.transactions_count ?? 0}</p>
          <p className="billing-stat-card__label">Transactions</p>
        </article>
        <article className="billing-stat-card glass-card">
          <p className="billing-stat-card__value">{formatRoleLabel(currentPlan)}</p>
          <p className="billing-stat-card__label">Current Status</p>
        </article>
      </div>

      <div className="billing-section">
        <h3 className="billing-section__title">Transaction History</h3>

        {transactions.length === 0 ? (
          <div className="billing-empty glass-panel">
            <p className="billing-empty__title">Нет транзакций</p>
            <p className="billing-empty__desc">История платежей появится после первого checkout</p>
          </div>
        ) : (
          <div className="billing-table-wrap glass-panel">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Дата</th>
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
    </section>
  );
};
