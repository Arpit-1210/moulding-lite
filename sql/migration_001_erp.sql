-- Factory OS — Moulding: upgrade migration
-- Run this ONCE in the Supabase SQL Editor, after schema.sql + seed.sql have
-- already been run. It only ADDS to your existing tables/data — nothing is
-- dropped, so your existing supervisors/products/teams/production_log rows
-- are untouched.
--
-- What this adds:
--   - products: selling_price, rm_cost (the two numbers profit is built from)
--   - workers: a real table for team members, each with a daily wage
--   - team_members: links workers to teams (replaces the old plain-text
--     `members` list on `teams` — that column is left in place but the app
--     no longer reads/writes it after this migration)
--
-- Profit formula used everywhere in the app:
--   Production Value = quantity × product.selling_price
--   RM Cost           = quantity × product.rm_cost
--   Wage Cost          = for every (team, day) that logged production,
--                        the sum of that team's current members' daily_wage
--   Profit             = Production Value − RM Cost − Wage Cost

-- ---------------------------------------------------------------------------
-- products: add pricing fields used by Profit & Loss
-- ---------------------------------------------------------------------------
alter table products add column if not exists selling_price numeric not null default 0;
alter table products add column if not exists rm_cost numeric not null default 0;

-- The original schema only let the anon key SELECT active products/supervisors.
-- The new Settings pages need to see inactive rows too (to reactivate them)
-- and need insert/update rights to manage them from the app.
drop policy if exists "products are readable when active" on products;
create policy "products are readable by anyone" on products for select using (true);
create policy "products can be created by anyone" on products for insert with check (true);
create policy "products can be updated by anyone" on products for update using (true) with check (true);
grant select, insert, update on products to anon, authenticated;

drop policy if exists "supervisors are readable when active" on supervisors;
create policy "supervisors are readable by anyone" on supervisors for select using (true);
create policy "supervisors can be created by anyone" on supervisors for insert with check (true);
create policy "supervisors can be updated by anyone" on supervisors for update using (true) with check (true);
grant select, insert, update on supervisors to anon, authenticated;

-- ---------------------------------------------------------------------------
-- workers: team members, each with a daily wage
-- ---------------------------------------------------------------------------
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  daily_wage numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table workers enable row level security;

drop policy if exists "workers are readable by anyone" on workers;
create policy "workers are readable by anyone"
  on workers for select
  using (true);

drop policy if exists "workers can be created by anyone" on workers;
create policy "workers can be created by anyone"
  on workers for insert
  with check (true);

drop policy if exists "workers can be updated by anyone" on workers;
create policy "workers can be updated by anyone"
  on workers for update
  using (true)
  with check (true);

grant select, insert, update on workers to anon, authenticated;
-- No delete: deactivate a worker instead of deleting them, so past team
-- history and wage totals stay meaningful.

-- ---------------------------------------------------------------------------
-- team_members: which workers are on which team right now
-- ---------------------------------------------------------------------------
create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, worker_id)
);

create index if not exists idx_team_members_team on team_members(team_id);
create index if not exists idx_team_members_worker on team_members(worker_id);

alter table team_members enable row level security;

drop policy if exists "team_members are readable by anyone" on team_members;
create policy "team_members are readable by anyone"
  on team_members for select
  using (true);

drop policy if exists "team_members can be created by anyone" on team_members;
create policy "team_members can be created by anyone"
  on team_members for insert
  with check (true);

drop policy if exists "team_members can be deleted by anyone" on team_members;
create policy "team_members can be deleted by anyone"
  on team_members for delete
  using (true);

grant select, insert, delete on team_members to anon, authenticated;

-- ---------------------------------------------------------------------------
-- One-time backfill: turn any existing teams.members (plain-text jsonb
-- array) into real worker rows + team_members links, so teams created
-- before this migration don't lose their members.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
  member_name text;
  new_worker_id uuid;
begin
  for t in select id, members from teams where members is not null and jsonb_array_length(members) > 0 loop
    for member_name in select jsonb_array_elements_text(t.members) loop
      if trim(member_name) <> '' then
        insert into workers (name) values (trim(member_name))
        returning id into new_worker_id;

        insert into team_members (team_id, worker_id)
        values (t.id, new_worker_id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;
