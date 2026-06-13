import type { UserRole } from '../types/user';
import { formatLimitValue } from './planLimits';

export interface PricingPlanDefinition {
  id: UserRole;
  name: string;
  description: string;
  limitLabel: string;
  features: string[];
  hidden?: boolean;
}

export const PRICING_PLANS: PricingPlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Стартовый тариф для знакомства с WorkflowGPT',
    limitLabel: '5 запусков в месяц',
    features: ['5 запусков в месяц', 'История', 'Базовые workflow'],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Для активной работы с AI workflow',
    limitLabel: '500 запусков в месяц',
    features: [
      '500 запусков в месяц',
      'Полная история',
      'Приоритетная обработка',
      'Будущие премиум workflow',
    ],
  },
  {
    id: 'owner',
    name: 'Owner',
    description: 'Безлимитный доступ для владельца платформы',
    limitLabel: 'Unlimited',
    features: ['Unlimited запуски', 'Полный доступ', 'Admin Dashboard'],
    hidden: true,
  },
];

export const PLAN_RANK: Record<UserRole, number> = {
  free: 0,
  pro: 1,
  owner: 2,
};

export function getVisiblePricingPlans(isOwner: boolean): PricingPlanDefinition[] {
  return PRICING_PLANS.filter((plan) => !plan.hidden || isOwner);
}

export function canUpgradeToPlan(currentPlan: UserRole, targetPlan: UserRole): boolean {
  return PLAN_RANK[targetPlan] > PLAN_RANK[currentPlan];
}

export function isCurrentPlan(currentPlan: UserRole, targetPlan: UserRole): boolean {
  return currentPlan === targetPlan;
}

export function getPlanLimitLabel(plan: UserRole): string {
  if (plan === 'owner') return 'Unlimited';
  return formatLimitValue(plan);
}
