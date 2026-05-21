import React from 'react';
import type { CompetitorMetadata } from '../config/workflows';

interface CompetitorFieldsProps {
  values: CompetitorMetadata;
  onChange: (values: CompetitorMetadata) => void;
}

export const CompetitorFields: React.FC<CompetitorFieldsProps> = ({ values, onChange }) => {
  const update = (key: keyof CompetitorMetadata, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="competitor-form glass-panel">
      <p className="competitor-form__title">Данные конкурента</p>
      <p className="competitor-form__desc">Название, ссылки и username — все поля опциональны</p>

      <label className="field-label" htmlFor="company-name">
        Название компании
      </label>
      <input
        id="company-name"
        className="field-input"
        type="text"
        inputMode="text"
        autoComplete="organization"
        placeholder="Например: Acme Corp"
        value={values.companyName ?? ''}
        onChange={(e) => update('companyName', e.target.value)}
      />

      <label className="field-label" htmlFor="company-website">
        Website URL
      </label>
      <input
        id="company-website"
        className="field-input"
        type="text"
        inputMode="url"
        autoComplete="url"
        placeholder="https://example.com"
        value={values.website ?? ''}
        onChange={(e) => update('website', e.target.value)}
      />

      <label className="field-label" htmlFor="company-instagram">
        Instagram username
      </label>
      <input
        id="company-instagram"
        className="field-input"
        type="text"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="@brand или instagram.com/brand"
        value={values.instagram ?? ''}
        onChange={(e) => update('instagram', e.target.value)}
      />

      <label className="field-label" htmlFor="company-telegram">
        Telegram username
      </label>
      <input
        id="company-telegram"
        className="field-input"
        type="text"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="@channel или t.me/channel"
        value={values.telegram ?? ''}
        onChange={(e) => update('telegram', e.target.value)}
      />
    </div>
  );
};
