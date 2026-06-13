import type {
  BillingCheckoutPayload,
  BillingPayPayload,
  BillingPayResult,
  BillingStats,
  BillingSummary,
  BillingTransaction,
  BillingStatusFilter,
} from '../types/billing';
import { apiUrl, mapFetchError } from './api';

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function billingHeaders(userId: string): Record<string, string> {
  return { Accept: 'application/json', 'X-User-Id': userId };
}

export async function fetchBillingSummary(userId: string): Promise<BillingSummary> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/billing/summary'), {
      method: 'GET',
      headers: billingHeaders(userId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<BillingSummary & { message?: string; error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Billing summary failed (${response.status})`);
  }
  return data;
}

export async function fetchBillingHistory(userId: string): Promise<BillingTransaction[]> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/billing/history'), {
      method: 'GET',
      headers: billingHeaders(userId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{ transactions?: BillingTransaction[]; message?: string; error?: string }>(
    response
  );
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Billing history failed (${response.status})`);
  }
  return data.transactions ?? [];
}

export async function createBillingCheckout(
  userId: string,
  payload: BillingCheckoutPayload
): Promise<BillingTransaction> {
  const url = apiUrl('/api/billing/checkout');
  // AUDIT-TEMP: log immediately before network request
  console.log('[AUDIT][billingApi.createBillingCheckout] sending request', {
    url,
    method: 'POST',
    userId,
    payload,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        ...billingHeaders(userId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{ transaction?: BillingTransaction; message?: string; error?: string }>(response);
  console.log('[AUDIT][billingApi.createBillingCheckout] response received', {
    url,
    status: response.status,
    ok: response.ok,
    hasTransaction: Boolean(data.transaction),
    error: data.error,
    message: data.message,
  });
  if (!response.ok || !data.transaction) {
    throw new Error(data.message ?? data.error ?? `Checkout failed (${response.status})`);
  }
  return data.transaction;
}

export async function payBillingTransaction(
  userId: string,
  payload: BillingPayPayload
): Promise<BillingPayResult> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/billing/pay'), {
      method: 'POST',
      headers: {
        ...billingHeaders(userId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<BillingPayResult & { message?: string; error?: string }>(response);
  if (!response.ok || !data.transaction || !data.user || !data.subscription || !data.effectivePlan || !data.quota) {
    throw new Error(data.message ?? data.error ?? `Payment failed (${response.status})`);
  }
  return data;
}

export async function fetchAdminBillingStats(adminUserId: string): Promise<BillingStats> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/admin/billing/stats'), {
      method: 'GET',
      headers: billingHeaders(adminUserId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<BillingStats & { message?: string; error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Admin billing stats failed (${response.status})`);
  }
  return data;
}

export async function fetchAdminBillingTransactions(
  adminUserId: string,
  status: BillingStatusFilter = 'all'
): Promise<BillingTransaction[]> {
  const query = status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/admin/billing/transactions${query}`), {
      method: 'GET',
      headers: billingHeaders(adminUserId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{ transactions?: BillingTransaction[]; message?: string; error?: string }>(
    response
  );
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Admin transactions failed (${response.status})`);
  }
  return data.transactions ?? [];
}

export function formatTransactionStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    paid: 'Paid',
    failed: 'Failed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };
  return map[status] ?? status;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatProviderLabel(provider: string): string {
  const map: Record<string, string> = {
    fake: 'Test',
    stripe: 'Stripe',
    telegram: 'Telegram Stars',
    manual: 'Manual',
  };
  return map[provider] ?? provider;
}
