import React, { useState } from 'react';
import type { ProRequestPayload } from '../types/billing';

interface ProRequestFormProps {
  defaultName: string;
  defaultUsername: string;
  submitting: boolean;
  onSubmit: (payload: ProRequestPayload) => void;
  onCancel: () => void;
}

export const ProRequestForm: React.FC<ProRequestFormProps> = ({
  defaultName,
  defaultUsername,
  submitting,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState(defaultName);
  const [username, setUsername] = useState(defaultUsername);
  const [contact, setContact] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      username: username.trim(),
      contact: contact.trim(),
      comment: comment.trim(),
    });
  };

  return (
    <form className="pro-request-form" onSubmit={handleSubmit}>
      <p className="pro-request-form__title">Заявка на Pro</p>
      <p className="pro-request-form__desc">Заполните контактные данные — администратор свяжется с вами.</p>

      <label className="pro-request-form__field">
        <span>Имя</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </label>

      <label className="pro-request-form__field">
        <span>Telegram username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@username"
          required
          autoComplete="username"
        />
      </label>

      <label className="pro-request-form__field">
        <span>Контакт для связи</span>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Telegram, телефон или email"
          required
        />
      </label>

      <label className="pro-request-form__field">
        <span>Комментарий (необязательно)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Дополнительная информация"
        />
      </label>

      <div className="pro-request-form__actions">
        <button type="button" className="btn-primary btn-primary--outline" onClick={onCancel} disabled={submitting}>
          Отмена
        </button>
        <button type="submit" className="btn-primary pricing-card__btn" disabled={submitting}>
          {submitting ? 'Отправка…' : 'Отправить заявку'}
        </button>
      </div>
    </form>
  );
};
