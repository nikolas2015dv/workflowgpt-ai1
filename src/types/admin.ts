import type { UserRole } from './user';
import type { BillingTransactionStatus } from './billing';

export interface AdminUserRow {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name?: string | null;
  role: UserRole;
  plan: UserRole;
  monthly_runs: number;
  total_runs: number;
  created_at: string;
  last_login_at: string | null;
  provider: string;
  subscription_status: string;
}

export interface AdminStats {
  total_users: number;
  free_users: number;
  pro_users: number;
  owner_users: number;
  total_workflows: number;
  total_history_records: number;
  workflows_this_month: number;
}

export interface AdminChangePlanPayload {
  userId: string;
  plan: UserRole;
}

export type AdminPlanFilter = 'all' | UserRole;

export interface AdminUserHistoryRow {
  id: string;
  created_at: string;
  workflow_type: string;
  subject: string;
  title: string;
}

export interface AdminProRequest {
  id: string;
  user_id: string;
  telegram_id: number | null;
  username: string | null;
  first_name: string;
  last_name: string | null;
  amount: number;
  currency: string;
  status: BillingTransactionStatus;
  created_at: string;
  request_name: string;
  request_username: string;
  contact: string;
  comment: string;
}

export interface AdminAnalyticsPeriod {
  newUsers: number;
  proRequests: number;
  approvedRequests: number;
  workflowRuns: number;
}

export interface AdminTopWorkflow {
  workflow_type: string;
  totalRuns: number;
  runsLast30Days: number;
}

export interface AdminAnalytics {
  users: {
    total: number;
    free: number;
    pro: number;
    owner: number;
  };
  proRequests: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    last7Days: number;
    last30Days: number;
  };
  conversion: {
    freeToProRate: number;
  };
  workflows: {
    totalRuns: number;
    runsLast7Days: number;
    runsLast30Days: number;
    topWorkflows: AdminTopWorkflow[];
  };
  periods: {
    last7Days: AdminAnalyticsPeriod;
    last30Days: AdminAnalyticsPeriod;
  };
}
