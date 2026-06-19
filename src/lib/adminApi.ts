import type {
  AdminChangePlanPayload,
  AdminPlanFilter,
  AdminProRequest,
  AdminStats,
  AdminUserHistoryRow,
  AdminUserRow,
} from '../types/admin';
import type { BillingTransaction } from '../types/billing';
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

export interface FetchAdminUsersOptions {
  query?: string;
  plan?: AdminPlanFilter;
}

export async function fetchAdminUsers(
  adminUserId: string,
  options: FetchAdminUsersOptions = {}
): Promise<AdminUserRow[]> {
  const params = new URLSearchParams();
  if (options.query?.trim()) params.set('query', options.query.trim());
  if (options.plan && options.plan !== 'all') params.set('plan', options.plan);

  const query = params.toString();
  const url = apiUrl(`/api/admin/users${query ? `?${query}` : ''}`);

  let response: Response;
  try {
    response = await fetch(url, {
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

export async function fetchAdminUserHistory(
  adminUserId: string,
  targetUserId: string
): Promise<AdminUserHistoryRow[]> {
  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(targetUserId)}/history`), {
      method: 'GET',
      headers: adminHeaders(adminUserId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{ history?: AdminUserHistoryRow[]; message?: string; error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Admin user history failed (${response.status})`);
  }
  return data.history ?? [];
}

export async function fetchAdminUserBilling(
  adminUserId: string,
  targetUserId: string
): Promise<BillingTransaction[]> {
  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(targetUserId)}/billing`), {
      method: 'GET',
      headers: adminHeaders(adminUserId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{ transactions?: BillingTransaction[]; message?: string; error?: string }>(
    response
  );
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Admin user billing failed (${response.status})`);
  }
  return data.transactions ?? [];
}

export async function fetchAdminProRequests(adminUserId: string): Promise<AdminProRequest[]> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/admin/pro-requests'), {
      method: 'GET',
      headers: adminHeaders(adminUserId),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{ requests?: AdminProRequest[]; message?: string; error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Admin pro requests failed (${response.status})`);
  }
  return data.requests ?? [];
}

export async function cancelAdminBillingTransaction(
  adminUserId: string,
  transactionId: string
): Promise<BillingTransaction> {
  return rejectAdminProRequest(adminUserId, transactionId);
}

export async function approveAdminProRequest(
  adminUserId: string,
  transactionId: string
): Promise<AdminChangePlanResult> {
  let response: Response;
  try {
    response = await fetch(
      apiUrl(`/api/admin/pro-requests/${encodeURIComponent(transactionId)}/approve`),
      {
        method: 'POST',
        headers: adminHeaders(adminUserId),
      }
    );
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
    throw new Error(data.message ?? data.error ?? `Approve pro request failed (${response.status})`);
  }

  return {
    user: data.user,
    subscription: data.subscription,
    effectivePlan: data.effectivePlan,
    quota: data.quota,
  };
}

export async function rejectAdminProRequest(
  adminUserId: string,
  transactionId: string
): Promise<BillingTransaction> {
  let response: Response;
  try {
    response = await fetch(
      apiUrl(`/api/admin/pro-requests/${encodeURIComponent(transactionId)}/reject`),
      {
        method: 'POST',
        headers: adminHeaders(adminUserId),
      }
    );
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{ transaction?: BillingTransaction; message?: string; error?: string }>(response);
  if (!response.ok || !data.transaction) {
    throw new Error(data.message ?? data.error ?? `Reject pro request failed (${response.status})`);
  }
  return data.transaction;
}

export interface AdminChangePlanResult {  user: AppUser;
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
