-- WorkflowGPT: billing architecture (provider-agnostic)

-- ─── Billing customers ───
create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  telegram_id bigint not null,
  customer_status text not null default 'active' check (customer_status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_customers is 'Billing customer records linked to WorkflowGPT users';

create index if not exists billing_customers_user_id_idx on public.billing_customers (user_id);
create index if not exists billing_customers_telegram_id_idx on public.billing_customers (telegram_id);

-- ─── Billing transactions ───
create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'fake' check (provider in ('fake', 'stripe', 'telegram', 'manual')),
  provider_transaction_id text,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  plan text not null check (plan in ('free', 'pro', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_transactions is 'Payment transactions for subscription upgrades';

create index if not exists billing_transactions_user_id_idx on public.billing_transactions (user_id);
create index if not exists billing_transactions_status_idx on public.billing_transactions (status);
create index if not exists billing_transactions_created_at_idx on public.billing_transactions (created_at desc);
create index if not exists billing_transactions_provider_idx on public.billing_transactions (provider);

-- ─── Billing events (audit log) ───
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.billing_events is 'Audit log for billing lifecycle events';

create index if not exists billing_events_user_id_idx on public.billing_events (user_id);
create index if not exists billing_events_event_type_idx on public.billing_events (event_type);
create index if not exists billing_events_created_at_idx on public.billing_events (created_at desc);

-- Backfill billing customers for existing users
insert into public.billing_customers (user_id, telegram_id, customer_status, created_at, updated_at)
select
  u.id,
  u.telegram_id,
  'active',
  coalesce(u.created_at, now()),
  coalesce(u.updated_at, now())
from public.users u
where not exists (
  select 1 from public.billing_customers bc where bc.user_id = u.id
);

-- ─── Row Level Security ───
alter table public.billing_customers enable row level security;
alter table public.billing_transactions enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists billing_customers_deny_anon on public.billing_customers;
create policy billing_customers_deny_anon on public.billing_customers
  as restrictive for all to anon using (false) with check (false);

drop policy if exists billing_customers_deny_authenticated on public.billing_customers;
create policy billing_customers_deny_authenticated on public.billing_customers
  as restrictive for all to authenticated using (false) with check (false);

drop policy if exists billing_transactions_deny_anon on public.billing_transactions;
create policy billing_transactions_deny_anon on public.billing_transactions
  as restrictive for all to anon using (false) with check (false);

drop policy if exists billing_transactions_deny_authenticated on public.billing_transactions;
create policy billing_transactions_deny_authenticated on public.billing_transactions
  as restrictive for all to authenticated using (false) with check (false);

drop policy if exists billing_events_deny_anon on public.billing_events;
create policy billing_events_deny_anon on public.billing_events
  as restrictive for all to anon using (false) with check (false);

drop policy if exists billing_events_deny_authenticated on public.billing_events;
create policy billing_events_deny_authenticated on public.billing_events
  as restrictive for all to authenticated using (false) with check (false);
