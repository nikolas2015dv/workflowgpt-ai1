import type { UserRole } from './user';

export type BillingTransactionStatus =
  | 'pending'
  | 'paid'
  | 'paid_manual'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type BillingProvider = 'fake' | 'stripe' | 'telegram' | 'manual';

export interface ProRequestMeta {
  name: string;
  username: string;
  contact: string;
  comment: string;
}

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
  request_meta?: ProRequestMeta | null;
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

export interface ProRequestPayload {
  name: string;
  username: string;
  contact: string;
  comment?: string;
}

export interface BillingPayPayload {
  transactionId: string;
}

export interface BillingPayResult {
  transaction: BillingTransaction;
  user: import('./user').AppUser;
  subscription: import('./subscription').Subscription;
  effectivePlan: UserRole;
  quota: import('./user').UsageQuota;
}

export interface BillingStats {
  total_revenue: number;
  paid_transactions: number;
  pending_transactions: number;
  active_pro_users: number;
  currency: string;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
}

export type BillingStatusFilter = BillingTransactionStatus | 'all';
