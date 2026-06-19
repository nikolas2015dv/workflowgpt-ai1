import React from 'react';
import { formatMoney, formatTransactionStatus } from '../lib/billingApi';
import type { AdminProRequest } from '../types/admin';

interface AdminProRequestDetailsProps {
  request: AdminProRequest;
  approving: boolean;
  rejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
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

export const AdminProRequestDetails: React.FC<AdminProRequestDetailsProps> = ({
  request,
  approving,
  rejecting,
  onApprove,
  onReject,
  onClose,
}) => {
  const displayUsername = request.request_username || (request.username ? `@${request.username}` : '—');

  return (
    <article className="admin-pro-request-details glass-card">
      <div className="admin-user-details__header">
        <div>
          <h3 className="admin-user-details__title">Заявка на Pro</h3>
          <p className="admin-user-details__subtitle">{formatDateTime(request.created_at)}</p>
        </div>
        <button type="button" className="admin-user-details__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      <div className="admin-user-details__grid">
        <DetailRow label="Имя" value={request.request_name || request.first_name || '—'} />
        <DetailRow label="Telegram ID" value={request.telegram_id ?? '—'} />
        <DetailRow label="Username" value={displayUsername} />
        <DetailRow label="Контакт" value={request.contact || '—'} />
        <DetailRow label="Комментарий" value={request.comment || '—'} />
        <DetailRow label="Сумма" value={formatMoney(request.amount, request.currency)} />
        <DetailRow label="Статус" value={formatTransactionStatus(request.status)} />
        <DetailRow label="Дата создания" value={formatDateTime(request.created_at)} />
      </div>

      <div className="admin-pro-request-details__actions">
        <button
          type="button"
          className="btn-primary admin-pro-request-details__approve"
          disabled={approving || rejecting}
          onClick={onApprove}
        >
          {approving ? '…' : 'Approve Payment'}
        </button>
        <button
          type="button"
          className="btn-primary btn-primary--outline admin-actions__btn--danger"
          disabled={approving || rejecting}
          onClick={onReject}
        >
          {rejecting ? '…' : 'Reject'}
        </button>
      </div>
    </article>
  );
};
