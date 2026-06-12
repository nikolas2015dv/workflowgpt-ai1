import type { AppUser, TelegramAuthPayload, UsageQuota, UsageStats, UserRole } from '../types/user';
import type { Subscription } from '../types/subscription';
import { getUsageQuota } from './planLimits';
import { apiUrl, mapFetchError } from './api';
import { logError, logMobile } from './mobileDebug';

export const DEV_TELEGRAM_USER: TelegramAuthPayload = {
  telegram_id: 999999999,
  username: 'owner',
  first_name: 'WorkflowGPT',
  last_name: 'Dev',
  photo_url: null,
};

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function authenticateWithTelegram(payload: TelegramAuthPayload): Promise<{
  user: AppUser;
  subscription?: Subscription | null;
  effectivePlan?: UserRole;
  usage?: UsageQuota;
}> {
  logMobile('auth telegram', payload.telegram_id);

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/auth/telegram'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{
    user?: AppUser;
    subscription?: Subscription | null;
    effectivePlan?: UserRole;
    usage?: UsageQuota;
    message?: string;
    error?: string;
  }>(response);
  if (!response.ok || !data.user) {
    throw new Error(data.message ?? data.error ?? `Auth failed (${response.status})`);
  }

  return {
    user: data.user,
    subscription: data.subscription ?? null,
    effectivePlan: data.effectivePlan ?? data.user.role,
    usage: data.usage,
  };
}

export async function fetchCurrentUser(userId: string): Promise<{
  user: AppUser;
  usage: UsageStats | UsageQuota;
  subscription?: Subscription | null;
  effectivePlan?: UserRole;
}> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/auth/me'), {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-User-Id': userId },
    });
  } catch (e) {
    throw mapFetchError(e);
  }

  const data = await parseJson<{
    user?: AppUser;
    usage?: UsageStats;
    subscription?: Subscription | null;
    effectivePlan?: UserRole;
    message?: string;
    error?: string;
  }>(response);

  if (!response.ok || !data.user) {
    throw new Error(data.message ?? data.error ?? `Failed to load user (${response.status})`);
  }

  const fallbackQuota = getUsageQuota(
    data.user.role as UserRole,
    data.user.monthly_runs,
    data.user.total_runs
  );

  return {
    user: data.user,
    usage: data.usage ?? {
      ...fallbackQuota,
      monthly_usage_events: data.user.monthly_runs,
    },
    subscription: data.subscription ?? null,
    effectivePlan: data.effectivePlan ?? data.user.role,
  };
}

export function buildTelegramAuthPayload(user: {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
}): TelegramAuthPayload {
  return {
    telegram_id: user.id,
    username: user.username ?? null,
    first_name: user.first_name,
    last_name: user.last_name ?? null,
    photo_url: user.photo_url ?? null,
  };
}

export function buildDevAuthPayload(): TelegramAuthPayload {
  return { ...DEV_TELEGRAM_USER };
}
