alter table public.purchase_orders
  add column if not exists item_name text,
  add column if not exists quantity integer not null default 1,
  add column if not exists unit_cost numeric(12,2) not null default 0;

update public.purchase_orders
set unit_cost = total_amount
where unit_cost = 0 and total_amount > 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'purchase_orders_quantity_positive'
      and conrelid = 'public.purchase_orders'::regclass
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_quantity_positive check (quantity > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'purchase_orders_unit_cost_non_negative'
      and conrelid = 'public.purchase_orders'::regclass
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_unit_cost_non_negative check (unit_cost >= 0);
  end if;
end $$;
