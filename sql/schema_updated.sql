-- Moulding Lite Schema v1.0
create extension if not exists pgcrypto;

create table if not exists supervisors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  selling_price numeric default 0,
  cost_price numeric default 0,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references supervisors(id) on delete cascade,
  team_number int not null,
  members jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (supervisor_id, team_number)
);

create index if not exists idx_teams_supervisor on teams(supervisor_id);

create table if not exists production_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  weight numeric not null check (weight > 0),
  production_date date not null,
  production_time time not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_production_log_date on production_log(production_date);
create index if not exists idx_production_log_team on production_log(team_id);
create index if not exists idx_production_log_product on production_log(product_id);

-- RLS
alter table supervisors enable row level security;
alter table products enable row level security;
alter table teams enable row level security;
alter table production_log enable row level security;

create policy "supervisors readable" on supervisors for select using (active = true);
create policy "products readable" on products for select using (active = true);
create policy "products updatable" on products for update using (true) with check (true);
create policy "teams readable" on teams for select using (true);
create policy "teams insertable" on teams for insert with check (true);
create policy "teams updatable" on teams for update using (true) with check (true);
create policy "production readable" on production_log for select using (true);
create policy "production insertable" on production_log for insert with check (true);

grant select on supervisors to anon, authenticated;
grant select, update on products to anon, authenticated;
grant select, insert, update on teams to anon, authenticated;
grant select, insert on production_log to anon, authenticated;

alter publication supabase_realtime add table production_log;

-- ---------------------------------------------------------------------------
-- workers — labour rate list, managed by owner
-- ---------------------------------------------------------------------------
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  daily_rate numeric not null default 400,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table workers enable row level security;

create policy "workers readable" on workers for select using (true);
create policy "workers insertable" on workers for insert with check (true);
create policy "workers updatable" on workers for update using (true) with check (true);

grant select, insert, update on workers to anon, authenticated;
