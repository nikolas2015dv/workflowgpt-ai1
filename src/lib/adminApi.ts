import type { AdminChangePlanPayload, AdminStats, AdminUserRow } from '../types/admin';
import type { SubscriptionInfo } from '../types/subscription';
import type { AppUser } from '../types/user';
import { apiUrl, mapFetchError } from './api';

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function adminHeaders(userId: string): Record<string, string> {
  return { Accept: 'application/json', 'X-User-Id': userId };
}

export async function fetchAdminUsers(adminUserId: string): Promise<AdminUserRow[]> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/admin/users'), {
      method: 'GET',
      headers: adminHeaders(adminUserId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{ users?: AdminUserRow[]; message?: string; error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Admin users failed (${response.status})`);
  }
  return data.users ?? [];
}

export async function fetchAdminStats(adminUserId: string): Promise<AdminStats> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/admin/stats'), {
      method: 'GET',
      headers: adminHeaders(adminUserId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<AdminStats & { message?: string; error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Admin stats failed (${response.status})`);
  }
  return data;
}

export interface AdminChangePlanResult {
  user: AppUser;
  subscription: SubscriptionInfo['subscription'];
  effectivePlan: SubscriptionInfo['effectivePlan'];
  quota: SubscriptionInfo['quota'];
}

export async function adminChangeUserPlan(
  adminUserId: string,
  payload: AdminChangePlanPayload
): Promise<AdminChangePlanResult> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/admin/subscription/change'), {
      method: 'POST',
      headers: {
        ...adminHeaders(adminUserId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{
    user?: AppUser;
    subscription?: SubscriptionInfo['subscription'];
    effectivePlan?: SubscriptionInfo['effectivePlan'];
    quota?: SubscriptionInfo['quota'];
    message?: string;
    error?: string;
  }>(response);

  if (!response.ok || !data.user || !data.subscription || !data.effectivePlan || !data.quota) {
    throw new Error(data.message ?? data.error ?? `Admin plan change failed (${response.status})`);
  }

  return {
    user: data.user,
    subscription: data.subscription,
    effectivePlan: data.effectivePlan,
    quota: data.quota,
  };
}
