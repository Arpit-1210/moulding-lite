-- Daily team rosters: who worked in which team on which day.
-- Run this ONCE in Supabase -> SQL Editor.
create table if not exists team_rosters (
  id uuid primary key default gen_random_uuid(),
  team_id text not null,
  roster_date date not null,
  members text[] not null default '{}',
  updated_at timestamptz default now(),
  unique (team_id, roster_date)
);

alter table team_rosters enable row level security;
drop policy if exists "open access" on team_rosters;
create policy "open access" on team_rosters for all using (true) with check (true);
grant all on team_rosters to anon, authenticated;
