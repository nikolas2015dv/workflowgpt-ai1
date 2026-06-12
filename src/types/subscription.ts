import type { UsageQuota, UserRole } from './user';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trialing';
export type SubscriptionProvider = 'manual' | 'telegram' | 'stripe';

export interface Subscription {
  id: string;
  user_id: string;
  plan: UserRole;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInfo {
  subscription: Subscription;
  effectivePlan: UserRole;
  quota: UsageQuota;
}

export interface ChangeSubscriptionPayload {
  plan: UserRole;
  status?: SubscriptionStatus;
  provider?: SubscriptionProvider;
}
