# Factory OS — Moulding

A focused production, team, and profit-tracking app for the Moulding
Department. Built on Vite + vanilla JavaScript, Supabase (Postgres +
Realtime), deployed to Vercel.

Two pages, one codebase:

- **`/` (index.html)** — the factory-floor flow: select supervisor → set up
  teams (with real worker records and daily wages) → log production, fast,
  repeatedly, for the rest of the shift.
- **`/owner.html`** — **Factory OS — Moulding**: a sidebar ERP-style app —
  Dashboard, Log Production, Production Log, Teams, Products, Profit & Loss,
  Settings — all reading live from the same Supabase data.

## 1. Set up Supabase (first time only)

Run these three files, **in this order**, in the Supabase SQL Editor (the
database query editor, not the Logs tab):

1. `sql/schema.sql` — core tables (supervisors, products, teams,
   production_log), RLS, realtime.
2. `sql/seed.sql` — a few sample supervisors and products.
3. `sql/migration_001_erp.sql` — adds product pricing (selling price, RM
   cost), the `workers` table (with daily wage), and `team_members` —
   everything the new sidebar app needs. Safe to run even if you already
   have teams/production data; nothing existing is dropped.

If you already ran `schema.sql` + `seed.sql` before this update, you only
need to run `migration_001_erp.sql` now.

## 2. Configure and run

```bash
cp .env.example .env.local   # fill in your Supabase Project URL + anon/publishable key
npm install
npm run dev
```

- Floor app: http://localhost:5173/
- Factory OS — Moulding (owner app): http://localhost:5173/owner.html

## How profit is calculated

Centralized in `src/services/calculations.js` so the Dashboard, Production
Log, and Profit & Loss pages can never disagree:

```
Production Value = quantity × product.selling_price
RM Cost           = quantity × product.rm_cost
Wage Cost          = for every (team, day) that logged production, the sum
                      of that team's current members' daily_wage — counted
                      once per team per day, not once per production line
Profit             = Production Value − RM Cost − Wage Cost
Margin             = Profit ÷ Production Value × 100
```

Two things worth knowing:

- **Wage cost is a team/day cost, not a per-unit one.** A team that logs 5
  separate entries in one day is still only charged its members' daily wage
  once for that day. This is why the "By product" breakdown on Profit & Loss
  shows profit *before* wage cost (wage can't be meaningfully split across
  products) while "By team" and the overall KPIs include it.
- **Pricing is current, not historical.** If you change a product's selling
  price, past entries in the Production Log and Profit & Loss will
  recalculate using the *new* price, not the price at the time they were
  logged. For a Lite app this keeps things simple; it's worth knowing if a
  price changes mid-month.

## Owner app pages

| Page | What it does |
|---|---|
| Dashboard | KPIs (units, weight, value, RM cost, wage cost, profit, margin) for Today / This week / This month, plus a recent-activity list |
| Log Production | Desktop entry form — supervisor, team, searchable product, quantity, weight, with a live value/RM-cost preview |
| Production Log | Every entry, filterable by team/product and date range |
| Teams | Pick a supervisor, add teams, add members from existing workers or create new ones with a daily wage, remove members |
| Products | Add/edit products with selling price and RM cost; activate/deactivate |
| Profit & Loss | Same KPIs as the Dashboard, plus breakdowns by product and by team |
| Settings | Add supervisors, activate/deactivate them |

## Design decisions worth knowing about

- **Session, not login.** The floor app keeps the selected supervisor/team in
  `sessionStorage` per browser tab — no password, just picking a name from a
  list (see "Security tradeoffs" below).
- **Workers are real records, not plain text.** Each team member is a
  `workers` row with a daily wage, linked to teams via `team_members`. This
  is what makes the wage-cost math possible; it replaced the old plain-text
  member list.
- **Append-only production log.** No edit/delete path for `production_log`,
  in the UI or in the database grants (`anon` only has SELECT/INSERT on that
  table in `schema.sql`).
- **Deliberately left out:** attendance, inventory/RM stock, salary/payroll
  disbursement, orders, dispatch, invoicing, Excel export. If you need any
  of these later, they're a deliberate addition, not something this Lite
  app tries to half-do.

## Security tradeoffs (read this before relying on it)

There is intentionally no authentication — anyone with the app URL can pick
any supervisor name, and the browser talks to Supabase directly with the
public anon/publishable key. Row Level Security does not verify identity;
it only limits what that key can do at all:

- `production_log`: insert and read only — never update or delete, enforced
  by database grants, so even a bug in the frontend can't edit history.
- `supervisors` / `products` / `workers`: readable and writable by anyone
  holding the anon key (there's no separate "admin" identity to restrict
  to). Appropriate for a trusted, on-site tool — not for a publicly shared
  link.

## Acceptance test

1. Open `/owner.html` → **Settings** → confirm your supervisors are there
   (add one if not).
2. Go to **Teams** → pick a supervisor → **+ Add team** → **+ New worker**
   (name + daily wage) → confirm the worker tile appears.
3. Go to **Products** → add a product with a selling price and RM cost.
4. Go to **Log Production** → pick supervisor/team/product, enter quantity
   + weight → **Save production** → see the live value/RM-cost preview
   before saving.
5. Go to **Production Log** → confirm the entry shows up.
6. Go to **Dashboard** and **Profit & Loss** → confirm units/value/profit
   reflect that entry, and that opening another tab and saving a second
   entry updates both without a manual refresh.
