-- TRI-M SCIMS core data model. Run this after the audit_logs migration.
-- Every business record is owned by the authenticated user, so one account
-- cannot read or modify another account's data.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  quantity integer not null default 0 check (quantity >= 0),
  reorder_level integer not null default 10 check (reorder_level >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  warehouse_location text,
  status text not null default 'in_stock' check (status in ('in_stock', 'low_stock', 'out_of_stock', 'on_order')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, sku)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  rating numeric(2,1) check (rating between 0 and 5),
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  po_number text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  expected_date date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'ordered', 'in_transit', 'received', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, po_number)
);

create index if not exists inventory_items_owner_created_idx on public.inventory_items(owner_id, created_at desc);
create index if not exists suppliers_owner_created_idx on public.suppliers(owner_id, created_at desc);
create index if not exists purchase_orders_owner_created_idx on public.purchase_orders(owner_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "inventory_owner_access" on public.inventory_items;
create policy "inventory_owner_access" on public.inventory_items for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "suppliers_owner_access" on public.suppliers;
create policy "suppliers_owner_access" on public.suppliers for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "purchase_orders_owner_access" on public.purchase_orders;
create policy "purchase_orders_owner_access" on public.purchase_orders for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- Create a profile automatically when a user confirms sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
