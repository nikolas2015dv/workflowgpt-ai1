const DOMAIN_KEY = 'workflowgpt_bitrix_domain';
const WEBHOOK_KEY = 'workflowgpt_bitrix_webhook_url';

export interface BitrixCredentials {
  domain: string;
  webhookUrl: string;
}

export function loadBitrixCredentials(): BitrixCredentials {
  try {
    return {
      domain: localStorage.getItem(DOMAIN_KEY) ?? '',
      webhookUrl: localStorage.getItem(WEBHOOK_KEY) ?? '',
    };
  } catch {
    return { domain: '', webhookUrl: '' };
  }
}

export function saveBitrixCredentials(credentials: BitrixCredentials): void {
  try {
    localStorage.setItem(DOMAIN_KEY, credentials.domain.trim());
    localStorage.setItem(WEBHOOK_KEY, credentials.webhookUrl.trim());
  } catch {
    /* private mode / quota */
  }
}

export function clearBitrixCredentials(): void {
  try {
    localStorage.removeItem(DOMAIN_KEY);
    localStorage.removeItem(WEBHOOK_KEY);
  } catch {
    /* ignore */
  }
}
