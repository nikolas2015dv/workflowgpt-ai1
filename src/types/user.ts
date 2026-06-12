export type UserRole = 'owner' | 'pro' | 'free';

export interface AppUser {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  role: UserRole;
  monthly_runs: number;
  total_runs: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface TelegramAuthPayload {
  telegram_id: number;
  username?: string | null;
  first_name?: string;
  last_name?: string | null;
  photo_url?: string | null;
}

export interface UsageStats {
  monthly_runs: number;
  total_runs: number;
  monthly_usage_events?: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  role: UserRole;
  tariff: 'free' | 'pro' | 'unlimited';
}

export type PlanLimits = {
  maxMonthlyRuns: number | null;
};

export interface UsageQuota {
  monthly_runs: number;
  total_runs: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  role: UserRole;
  tariff: 'free' | 'pro' | 'unlimited';
}
