-- Run ONCE in Supabase -> SQL Editor: lets the Products page delete a product.
-- (A product that has production entries is still protected and cannot be deleted.)
drop policy if exists "products deletable" on products;
create policy "products deletable" on products for delete using (true);
