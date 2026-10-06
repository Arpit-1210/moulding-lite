-- Daily close: one frozen summary row per finished day (wage locked at that day's rate x multiplier).
-- Run this ONCE in Supabase -> SQL Editor.
create table if not exists daily_summary (
  summary_date date primary key,
  units numeric not null default 0,
  weight numeric not null default 0,
  value numeric not null default 0,
  wage numeric not null default 0,
  multiplier numeric not null default 1.5,
  teams jsonb not null default '[]',
  closed_at timestamptz default now()
);

alter table daily_summary enable row level security;
drop policy if exists "open access" on daily_summary;
create policy "open access" on daily_summary for all using (true) with check (true);
grant all on daily_summary to anon, authenticated;
