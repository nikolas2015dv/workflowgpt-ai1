/** Plan catalog for billing (amounts in major currency units) */
const BILLING_PLANS = {
  pro: {
    plan: 'pro',
    amount: 9.99,
    currency: 'USD',
    label: 'WorkflowGPT Pro',
  },
};

const VALID_TRANSACTION_STATUSES = new Set(['pending', 'paid', 'failed', 'cancelled', 'refunded']);
const VALID_PROVIDERS = new Set(['fake', 'stripe', 'telegram', 'manual']);
const VALID_BILLABLE_PLANS = new Set(['pro']);

function getPlanPricing(plan) {
  return BILLING_PLANS[plan] ?? null;
}

module.exports = {
  BILLING_PLANS,
  VALID_TRANSACTION_STATUSES,
  VALID_PROVIDERS,
  VALID_BILLABLE_PLANS,
  getPlanPricing,
};
