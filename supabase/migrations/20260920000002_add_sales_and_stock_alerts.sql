-- Sales recording updates inventory and creates a traceable sales record in one transaction.
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_amount numeric(12,2) generated always as (quantity * unit_price) stored,
  customer_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists sales_owner_created_idx on public.sales(owner_id, created_at desc);
alter table public.sales enable row level security;

drop policy if exists "sales_owner_access" on public.sales;
create policy "sales_owner_access" on public.sales for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create or replace function public.record_sale(
  p_inventory_item_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_customer_name text default null,
  p_notes text default null
)
returns public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  item public.inventory_items;
  sale public.sales;
  next_quantity integer;
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to record a sale';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Sale quantity must be greater than zero';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'Unit price cannot be negative';
  end if;

  select * into item from public.inventory_items
    where id = p_inventory_item_id and owner_id = auth.uid()
    for update;
  if not found then
    raise exception 'Inventory item was not found';
  end if;
  if item.quantity < p_quantity then
    raise exception 'Insufficient stock: only % units available', item.quantity;
  end if;

  next_quantity := item.quantity - p_quantity;
  next_status := case when next_quantity <= 0 then 'out_of_stock'
                      when next_quantity <= item.reorder_level then 'low_stock'
                      else 'in_stock' end;

  insert into public.sales (owner_id, inventory_item_id, quantity, unit_price, customer_name, notes)
  values (auth.uid(), item.id, p_quantity, p_unit_price, nullif(trim(p_customer_name), ''), nullif(trim(p_notes), ''))
  returning * into sale;

  update public.inventory_items set quantity = next_quantity, status = next_status, updated_at = now()
    where id = item.id;

  insert into public.audit_logs (user_id, action, module, record_id, description)
  values (auth.uid(), 'update', 'inventory', item.id, format('Recorded sale of %s unit(s) for %s', p_quantity, item.sku));

  return sale;
end;
$$;

revoke execute on function public.record_sale(uuid, integer, numeric, text, text) from public, anon;
grant execute on function public.record_sale(uuid, integer, numeric, text, text) to authenticated;
