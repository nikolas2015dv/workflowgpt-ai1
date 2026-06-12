import type { ChangeSubscriptionPayload, SubscriptionInfo } from '../types/subscription';
import { apiUrl, mapFetchError } from './api';
import { logMobile } from './mobileDebug';

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function fetchSubscription(userId: string): Promise<SubscriptionInfo> {
  logMobile('subscription fetch', userId);

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/subscription'), {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-User-Id': userId },
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<SubscriptionInfo & { message?: string; error?: string }>(response);
  if (!response.ok || !data.subscription) {
    throw new Error(data.message ?? data.error ?? `Failed to load subscription (${response.status})`);
  }

  return {
    subscription: data.subscription,
    effectivePlan: data.effectivePlan,
    quota: data.quota,
  };
}

export async function changeSubscriptionPlan(
  userId: string,
  payload: ChangeSubscriptionPayload
): Promise<SubscriptionInfo> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/subscription/change'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{
    subscription?: SubscriptionInfo['subscription'];
    effectivePlan?: SubscriptionInfo['effectivePlan'];
    quota?: SubscriptionInfo['quota'];
    user?: unknown;
    message?: string;
    error?: string;
  }>(response);

  if (!response.ok || !data.subscription || !data.effectivePlan || !data.quota) {
    throw new Error(data.message ?? data.error ?? `Failed to change subscription (${response.status})`);
  }

  return {
    subscription: data.subscription,
    effectivePlan: data.effectivePlan,
    quota: data.quota,
  };
}

export function formatSubscriptionStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Active',
    cancelled: 'Cancelled',
    expired: 'Expired',
    trialing: 'Trialing',
  };
  return map[status] ?? status;
}
