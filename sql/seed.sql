-- Sample seed data for Moulding Lite.
-- Replace the names below with the real supervisor and product list, or run
-- this as-is to try the app, then edit via the Supabase table editor.

insert into supervisors (name, active) values
  ('Supervisor A', true),
  ('Supervisor B', true),
  ('Supervisor C', true)
on conflict do nothing;

insert into products (name, active) values
  ('Product A', true),
  ('Product B', true),
  ('Product C', true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Optional: a demo team + a couple of production entries for today, so the
-- owner dashboard has something to show before the first real shift.
-- Uncomment and run separately after the inserts above have run once.
-- ---------------------------------------------------------------------------

-- with sup as (
--   select id from supervisors where name = 'Supervisor A' limit 1
-- ), demo_team as (
--   insert into teams (supervisor_id, team_number, members)
--   select id, 1, '["Raj", "Aman", "Suresh"]'::jsonb from sup
--   returning id
-- ), demo_product as (
--   select id from products where name = 'Product A' limit 1
-- )
-- insert into production_log (team_id, product_id, quantity, weight, production_date, production_time)
-- select demo_team.id, demo_product.id, 100, 75, current_date, '09:15:00'
-- from demo_team, demo_product;
