-- RMS POS Cloud Preview tables
-- Execute once in Supabase SQL Editor.

create table if not exists public.pos_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_date date not null default current_date,
  table_name text,
  customer_name text,
  payment_method text not null default 'cash' check (payment_method in ('cash','bank','wolt','mixed')),
  total_amount numeric(14,2) not null default 0,
  status text not null default 'closed' check (status in ('open','closed','cancelled')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  hall_name text,
  guest_count numeric(10,2) default 1,
  order_mode text default 'hall',
  cashier_name text,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pos_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pos_orders(id) on delete cascade,
  menu_item_id uuid null references public.menu_items(id) on delete set null,
  item_name text not null,
  item_category text,
  item_type text not null default 'Кухня',
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table if exists public.pos_orders add column if not exists hall_name text;
alter table if exists public.pos_orders add column if not exists guest_count numeric(10,2) default 1;
alter table if exists public.pos_orders add column if not exists order_mode text default 'hall';
alter table if exists public.pos_orders add column if not exists cashier_name text;

create index if not exists idx_pos_orders_branch_date on public.pos_orders(branch_id, order_date);
create index if not exists idx_pos_orders_status on public.pos_orders(status);
create index if not exists idx_pos_order_items_order on public.pos_order_items(order_id);
create index if not exists idx_pos_order_items_menu on public.pos_order_items(menu_item_id);

alter table public.pos_orders enable row level security;
alter table public.pos_order_items enable row level security;

drop policy if exists "pos_orders_read_anon_auth" on public.pos_orders;
drop policy if exists "pos_orders_write_anon_auth" on public.pos_orders;
drop policy if exists "pos_order_items_read_anon_auth" on public.pos_order_items;
drop policy if exists "pos_order_items_write_anon_auth" on public.pos_order_items;

create policy "pos_orders_read_anon_auth"
on public.pos_orders for select
to anon, authenticated
using (true);

create policy "pos_orders_write_anon_auth"
on public.pos_orders for all
to anon, authenticated
using (true)
with check (true);

create policy "pos_order_items_read_anon_auth"
on public.pos_order_items for select
to anon, authenticated
using (true);

create policy "pos_order_items_write_anon_auth"
on public.pos_order_items for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.pos_orders to anon, authenticated;
grant select, insert, update, delete on public.pos_order_items to anon, authenticated;
