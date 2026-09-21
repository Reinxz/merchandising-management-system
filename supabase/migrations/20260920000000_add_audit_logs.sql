create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('login', 'logout', 'create', 'update', 'delete', 'approve', 'cancel')),
  module text not null check (module in ('auth', 'inventory', 'suppliers', 'purchase_orders')),
  record_id uuid,
  description text not null check (char_length(trim(description)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_module_action_idx on public.audit_logs(module, action);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own on public.audit_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists audit_logs_insert_own on public.audit_logs;
create policy audit_logs_insert_own on public.audit_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
