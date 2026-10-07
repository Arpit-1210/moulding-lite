-- Products can be priced per unit (default) or per kg. Run ONCE in Supabase -> SQL Editor. Safe to run again.
alter table products add column if not exists pricing_unit text not null default 'unit';
alter table products drop constraint if exists products_pricing_unit_check;
alter table products add constraint products_pricing_unit_check check (pricing_unit in ('unit','kg'));
