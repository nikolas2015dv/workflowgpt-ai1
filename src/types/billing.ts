import type { Subscription } from './subscription';
import type { AppUser, UsageQuota, UserRole } from './user';

export type BillingTransactionStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type BillingProvider = 'fake' | 'stripe' | 'telegram' | 'manual';

export interface BillingTransaction {
  id: string;
  user_id: string;
  provider: BillingProvider;
  provider_transaction_id: string | null;
  amount: number;
  currency: string;
  status: BillingTransactionStatus;
  plan: UserRole;
  created_at: string;
  updated_at: string;
}

export interface BillingSummary {
  total_paid: number;
  transactions_count: number;
  active_plan: UserRole;
  pending_transaction: BillingTransaction | null;
  currency: string;
}

export interface BillingCheckoutPayload {
  plan: UserRole;
  provider?: BillingProvider;
}

export interface BillingPayPayload {
  transactionId: string;
}

export interface BillingPayResult {
  transaction: BillingTransaction;
  user: AppUser;
  subscription: Subscription;
  effectivePlan: UserRole;
  quota: UsageQuota;
}

export interface BillingStats {
  total_revenue: number;
  paid_transactions: number;
  pending_transactions: number;
  active_pro_users: number;
  currency: string;
}

export type BillingStatusFilter = BillingTransactionStatus | 'all';
