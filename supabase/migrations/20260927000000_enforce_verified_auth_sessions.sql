-- Password-authenticated and passwordless Supabase sessions are not trusted by
-- SCIMS until a server-only login challenge records their session_id here.
create table if not exists public.auth_login_challenges (
  challenge_hash text primary key check (challenge_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  password_session_id uuid not null,
  email text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  resends integer not null default 0 check (resends between 0 and 3),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_login_challenges_expiry_idx
  on public.auth_login_challenges(expires_at);

alter table public.auth_login_challenges enable row level security;
revoke all on public.auth_login_challenges from anon, authenticated;
grant all on public.auth_login_challenges to service_role;

create table if not exists public.verified_auth_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

alter table public.verified_auth_sessions enable row level security;
revoke all on public.verified_auth_sessions from anon, authenticated;
grant all on public.verified_auth_sessions to service_role;

create table if not exists public.auth_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (event in (
    'password_failed',
    'password_verified',
    'challenge_creation_failed',
    'challenge_cleanup_failed',
    'password_session_cleanup_failed',
    'password_session_invalid',
    'otp_delivery_failed',
    'otp_failed',
    'otp_expired',
    'otp_attempt_limited',
    'otp_resent',
    'otp_resend_failed',
    'otp_resend_limited',
    'otp_identity_mismatch',
    'otp_challenge_completion_failed',
    'login_completed',
    'logout'
  )),
  created_at timestamptz not null default now()
);

create index if not exists auth_security_events_user_created_idx
  on public.auth_security_events(user_id, created_at desc);

alter table public.auth_security_events enable row level security;
revoke all on public.auth_security_events from anon, authenticated;
grant all on public.auth_security_events to service_role;

drop function if exists public.take_auth_login_challenge(text);
create function public.take_auth_login_challenge(p_challenge_hash text)
returns table(user_id uuid, email text, password_session_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.auth_login_challenges as challenge
  set attempts = challenge.attempts + 1
  where challenge.challenge_hash = p_challenge_hash
    and challenge.expires_at > now()
    and challenge.consumed_at is null
    and challenge.attempts < 5
  returning challenge.user_id, challenge.email, challenge.password_session_id;
end;
$$;

create or replace function public.take_auth_login_resend(p_challenge_hash text)
returns table(user_id uuid, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.auth_login_challenges as challenge
  set resends = challenge.resends + 1
  where challenge.challenge_hash = p_challenge_hash
    and challenge.expires_at > now()
    and challenge.consumed_at is null
    and challenge.resends < 3
  returning challenge.user_id, challenge.email;
end;
$$;

drop function if exists public.complete_auth_login_challenge(text, uuid, uuid);
drop function if exists public.complete_auth_login_challenge(text, uuid, uuid, uuid);
create function public.complete_auth_login_challenge(
  p_challenge_hash text,
  p_user_id uuid,
  p_password_session_id uuid,
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.auth_login_challenges as challenge
  set consumed_at = now()
  where challenge.challenge_hash = p_challenge_hash
    and challenge.user_id = p_user_id
    and challenge.password_session_id = p_password_session_id
    and challenge.expires_at > now()
    and challenge.consumed_at is null
    and challenge.attempts between 1 and 5;

  if not found then
    return false;
  end if;

  insert into public.verified_auth_sessions (session_id, user_id)
  values (p_session_id, p_user_id);
  return true;
end;
$$;

create or replace function public.is_auth_session_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.verified_auth_sessions as verified
    where verified.user_id = (select auth.uid())
      and verified.session_id::text = ((select auth.jwt()) ->> 'session_id')
      and verified.expires_at > now()
  );
$$;

create or replace function public.touch_verified_auth_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.verified_auth_sessions as verified
  set expires_at = now() + interval '30 days'
  where verified.user_id = (select auth.uid())
    and verified.session_id::text = ((select auth.jwt()) ->> 'session_id')
    and verified.expires_at > now();
  return found;
end;
$$;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Profile roles can only be changed by a trusted administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
  before update of role on public.profiles
  for each row execute function public.prevent_profile_role_change();

revoke all on function public.take_auth_login_challenge(text) from public, anon, authenticated;
revoke all on function public.take_auth_login_resend(text) from public, anon, authenticated;
revoke all on function public.complete_auth_login_challenge(text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.prevent_profile_role_change() from public, anon, authenticated;
grant execute on function public.take_auth_login_challenge(text) to service_role;
grant execute on function public.take_auth_login_resend(text) to service_role;
grant execute on function public.complete_auth_login_challenge(text, uuid, uuid, uuid) to service_role;

revoke all on function public.is_auth_session_verified() from public, anon;
revoke all on function public.touch_verified_auth_session() from public, anon;
grant execute on function public.is_auth_session_verified() to authenticated;
grant execute on function public.touch_verified_auth_session() to authenticated;

alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
  check (action in ('login', 'login_attempt', 'otp_failed', 'logout', 'create', 'update', 'delete', 'approve', 'cancel'));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id and (select public.is_auth_session_verified()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id and (select public.is_auth_session_verified()))
  with check ((select auth.uid()) = id and (select public.is_auth_session_verified()));

drop policy if exists inventory_owner_access on public.inventory_items;
create policy inventory_owner_access on public.inventory_items
  for all to authenticated
  using ((select auth.uid()) = owner_id and (select public.is_auth_session_verified()))
  with check ((select auth.uid()) = owner_id and (select public.is_auth_session_verified()));

drop policy if exists suppliers_owner_access on public.suppliers;
create policy suppliers_owner_access on public.suppliers
  for all to authenticated
  using ((select auth.uid()) = owner_id and (select public.is_auth_session_verified()))
  with check ((select auth.uid()) = owner_id and (select public.is_auth_session_verified()));

drop policy if exists purchase_orders_owner_access on public.purchase_orders;
create policy purchase_orders_owner_access on public.purchase_orders
  for all to authenticated
  using ((select auth.uid()) = owner_id and (select public.is_auth_session_verified()))
  with check ((select auth.uid()) = owner_id and (select public.is_auth_session_verified()));

drop policy if exists sales_owner_access on public.sales;
create policy sales_owner_access on public.sales
  for all to authenticated
  using ((select auth.uid()) = owner_id and (select public.is_auth_session_verified()))
  with check ((select auth.uid()) = owner_id and (select public.is_auth_session_verified()));

drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own on public.audit_logs
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_auth_session_verified()));

drop policy if exists audit_logs_insert_own on public.audit_logs;
create policy audit_logs_insert_own on public.audit_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_auth_session_verified()));

-- These legacy policies existed in the remote schema independently of the
-- migration history. Preserve their row ownership checks while requiring the
-- same verified Supabase session as the canonical SCIMS policies above.
do $$
declare
  policy_change record;
begin
  for policy_change in
    select *
    from (values
      ('profiles', 'Users can view their own profile', 'using', '(auth.uid() = id and public.is_auth_session_verified())'),
      ('profiles', 'Users can insert their own profile', 'with check', '(auth.uid() = id and public.is_auth_session_verified())'),
      ('profiles', 'Users can update their own profile', 'using and with check', '(auth.uid() = id and public.is_auth_session_verified())'),
      ('inventory_items', 'Users can view their own inventory', 'using', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('inventory_items', 'Users can create their own inventory', 'with check', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('inventory_items', 'Users can update their own inventory', 'using and with check', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('inventory_items', 'Users can delete their own inventory', 'using', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('suppliers', 'Users can view their own suppliers', 'using', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('suppliers', 'Users can create their own suppliers', 'with check', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('suppliers', 'Users can update their own suppliers', 'using and with check', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('suppliers', 'Users can delete their own suppliers', 'using', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('purchase_orders', 'Users can view their own purchase orders', 'using', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('purchase_orders', 'Users can create their own purchase orders', 'with check', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('purchase_orders', 'Users can update their own purchase orders', 'using and with check', '(auth.uid() = owner_id and public.is_auth_session_verified())'),
      ('purchase_orders', 'Users can delete their own purchase orders', 'using', '(auth.uid() = owner_id and public.is_auth_session_verified())')
    ) as changes(table_name, policy_name, clause, predicate)
  loop
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = policy_change.table_name
        and policyname = policy_change.policy_name
    ) then
      if policy_change.clause = 'using and with check' then
        execute format(
          'alter policy %I on public.%I to authenticated using %s with check %s',
          policy_change.policy_name,
          policy_change.table_name,
          policy_change.predicate,
          policy_change.predicate
        );
      else
        execute format(
          'alter policy %I on public.%I to authenticated %s %s',
          policy_change.policy_name,
          policy_change.table_name,
          policy_change.clause,
          policy_change.predicate
        );
      end if;
    end if;
  end loop;
end;
$$;
