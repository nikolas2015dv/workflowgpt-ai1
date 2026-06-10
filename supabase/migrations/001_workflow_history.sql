-- WorkflowGPT: workflow history persistence
-- Run in Supabase SQL Editor or via Supabase CLI migrations.

create extension if not exists "pgcrypto";

create table if not exists public.workflow_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workflow_type text not null,
  subject text not null default '',
  title text not null,
  report text,
  summary text,
  recommendations text,
  raw_data jsonb not null default '{}'::jsonb
);

comment on table public.workflow_history is 'WorkflowGPT saved workflow run results';
comment on column public.workflow_history.raw_data is 'Full WorkflowRunResult JSON for replay/export';

create index if not exists workflow_history_created_at_idx
  on public.workflow_history (created_at desc);

create index if not exists workflow_history_workflow_type_idx
  on public.workflow_history (workflow_type);

-- RLS enabled; service role bypasses policies. Add user-scoped policies when auth ships.
alter table public.workflow_history enable row level security;
