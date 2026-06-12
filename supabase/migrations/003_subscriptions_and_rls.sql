-- WorkflowGPT: subscriptions architecture + multi-tenant data isolation (RLS)

-- ─── Subscriptions (billing architecture, no payment yet) ───
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'owner')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'trialing')),
  provider text not null default 'manual' check (provider in ('manual', 'telegram', 'stripe')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is 'WorkflowGPT subscription records (SaaS plans)';

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan);

-- Backfill default free subscriptions for existing users
insert into public.subscriptions (user_id, plan, status, provider, started_at, created_at, updated_at)
select
  u.id,
  case when u.role = 'owner' then 'owner' when u.role = 'pro' then 'pro' else 'free' end,
  'active',
  'manual',
  coalesce(u.created_at, now()),
  coalesce(u.created_at, now()),
  coalesce(u.updated_at, now())
from public.users u
where not exists (
  select 1 from public.subscriptions s where s.user_id = u.id
);

-- ─── Workflow history: enforce per-user ownership ───
-- Legacy rows without user_id are not visible to any user (API filters by user_id).
delete from public.workflow_history where user_id is null;

alter table public.workflow_history
  alter column user_id set not null;

-- ─── Row Level Security ───
-- Backend uses service_role (bypasses RLS). Policies block direct anon/authenticated access.

alter table public.workflow_history enable row level security;
alter table public.subscriptions enable row level security;

-- users
drop policy if exists users_deny_anon on public.users;
create policy users_deny_anon on public.users
  as restrictive for all to anon using (false) with check (false);

drop policy if exists users_deny_authenticated on public.users;
create policy users_deny_authenticated on public.users
  as restrictive for all to authenticated using (false) with check (false);

-- user_usage
drop policy if exists user_usage_deny_anon on public.user_usage;
create policy user_usage_deny_anon on public.user_usage
  as restrictive for all to anon using (false) with check (false);

drop policy if exists user_usage_deny_authenticated on public.user_usage;
create policy user_usage_deny_authenticated on public.user_usage
  as restrictive for all to authenticated using (false) with check (false);

-- workflow_history
drop policy if exists workflow_history_deny_anon on public.workflow_history;
create policy workflow_history_deny_anon on public.workflow_history
  as restrictive for all to anon using (false) with check (false);

drop policy if exists workflow_history_deny_authenticated on public.workflow_history;
create policy workflow_history_deny_authenticated on public.workflow_history
  as restrictive for all to authenticated using (false) with check (false);

-- subscriptions
drop policy if exists subscriptions_deny_anon on public.subscriptions;
create policy subscriptions_deny_anon on public.subscriptions
  as restrictive for all to anon using (false) with check (false);

drop policy if exists subscriptions_deny_authenticated on public.subscriptions;
create policy subscriptions_deny_authenticated on public.subscriptions
  as restrictive for all to authenticated using (false) with check (false);
