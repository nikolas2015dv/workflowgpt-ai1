-- WorkflowGPT: user accounts (Telegram ID) + usage tracking + history ownership

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  role text not null default 'free' check (role in ('owner', 'pro', 'free')),
  monthly_runs integer not null default 0,
  total_runs integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

comment on table public.users is 'WorkflowGPT users identified by Telegram ID';

create index if not exists users_telegram_id_idx on public.users (telegram_id);
create index if not exists users_role_idx on public.users (role);

create table if not exists public.user_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workflow_type text not null,
  created_at timestamptz not null default now()
);

comment on table public.user_usage is 'Per-run usage events for analytics and monthly limits';

create index if not exists user_usage_user_id_idx on public.user_usage (user_id);
create index if not exists user_usage_created_at_idx on public.user_usage (created_at desc);
create index if not exists user_usage_user_month_idx on public.user_usage (user_id, created_at desc);

alter table public.workflow_history
  add column if not exists user_id uuid references public.users(id) on delete cascade;

create index if not exists workflow_history_user_id_idx
  on public.workflow_history (user_id, created_at desc);

alter table public.users enable row level security;
alter table public.user_usage enable row level security;
