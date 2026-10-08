-- ──────────────────────────────────────────────────────────────────
-- Kairo — menu_sales table
-- Stores monthly product-mix snapshots imported from Toast POS exports.
-- No PII — purely aggregate item-level sales data.
-- ──────────────────────────────────────────────────────────────────

create table if not exists menu_sales (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  month         text not null,          -- 'YYYY-MM', e.g. '2026-01'
  item          text not null,          -- item name as exported from Toast
  menu_group    text,                   -- e.g. 'Specialty Rolls', 'Yakitori'
  qty_sold      int not null default 0,
  gross_sales   numeric(10,2) not null default 0,
  net_sales     numeric(10,2) not null default 0,
  avg_price     numeric(10,2),
  discount_amt  numeric(10,2) not null default 0,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, month, item)
);

create index if not exists menu_sales_restaurant_month_idx
  on menu_sales(restaurant_id, month);

create index if not exists menu_sales_item_idx
  on menu_sales(restaurant_id, item);

alter table menu_sales enable row level security;
