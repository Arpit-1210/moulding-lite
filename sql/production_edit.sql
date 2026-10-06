-- Allow editing and deleting logged production entries. Run ONCE in Supabase -> SQL Editor.
drop policy if exists "production updatable" on production_log;
create policy "production updatable" on production_log for update using (true) with check (true);
drop policy if exists "production deletable" on production_log;
create policy "production deletable" on production_log for delete using (true);
grant select, insert, update, delete on production_log to anon, authenticated;
