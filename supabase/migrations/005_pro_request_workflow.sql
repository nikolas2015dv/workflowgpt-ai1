-- WorkflowGPT: Pro request workflow metadata + paid_manual status

alter table public.billing_transactions
  add column if not exists request_meta jsonb;

comment on column public.billing_transactions.request_meta is
  'Pro request form payload: name, username, contact, comment';

alter table public.billing_transactions
  drop constraint if exists billing_transactions_status_check;

alter table public.billing_transactions
  add constraint billing_transactions_status_check
  check (status in ('pending', 'paid', 'paid_manual', 'failed', 'cancelled', 'refunded'));

create index if not exists billing_transactions_request_meta_idx
  on public.billing_transactions ((request_meta is not null))
  where plan = 'pro';
