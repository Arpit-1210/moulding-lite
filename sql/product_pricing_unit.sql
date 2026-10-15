-- Products can be priced per unit (default), per kg, or per set. Run ONCE in Supabase -> SQL Editor. Safe to run again.
-- per set: the price is for one set of `set_size` pieces; value = quantity / set_size x price.
alter table products add column if not exists pricing_unit text not null default 'unit';
alter table products add column if not exists set_size numeric not null default 1;
alter table products drop constraint if exists products_pricing_unit_check;
alter table products add constraint products_pricing_unit_check check (pricing_unit in ('unit','kg','set'));
alter table products drop constraint if exists products_set_size_check;
alter table products add constraint products_set_size_check check (set_size >= 1);
