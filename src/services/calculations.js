// Centralized profit math, used by the Dashboard, Production Log, and
// Profit & Loss pages so they can never disagree with each other.
//
//   Production Value = quantity × product.selling_price
//   RM Cost           = quantity × product.rm_cost
//   Wage Cost          = for each (team, day) that logged production, the sum
//                         of that team's current members' daily_wage — once
//                         per team per day, not per production line
//   Profit             = Production Value − RM Cost − Wage Cost
//   Margin             = Profit / Production Value × 100

export function lineValue(quantity, sellingPrice) {
  return Number(quantity || 0) * Number(sellingPrice || 0);
}

export function lineRmCost(quantity, rmCost) {
  return Number(quantity || 0) * Number(rmCost || 0);
}

export function marginPct(profit, value) {
  if (!value) return 0;
  return (profit / value) * 100;
}

/**
 * Sums wage cost across every distinct (team, day) pair present in `rows`.
 * `teamDailyWageTotals` is the Map<team_id, dailyWageTotal> from
 * services/teams.js#fetchTeamDailyWageTotals.
 */
export function totalWageCost(rows, teamDailyWageTotals) {
  const seenTeamDays = new Set();
  let total = 0;
  for (const row of rows) {
    const teamId = row.teams?.id;
    if (!teamId) continue;
    const key = `${teamId}__${row.production_date}`;
    if (seenTeamDays.has(key)) continue;
    seenTeamDays.add(key);
    total += teamDailyWageTotals.get(teamId) ?? 0;
  }
  return total;
}

/** Overall totals across a set of production rows, wage cost included. */
export function summarize(rows, teamDailyWageTotals) {
  let units = 0;
  let weight = 0;
  let value = 0;
  let rmCost = 0;

  for (const row of rows) {
    const qty = Number(row.quantity) || 0;
    units += qty;
    weight += Number(row.weight) || 0;
    value += lineValue(qty, row.products?.selling_price);
    rmCost += lineRmCost(qty, row.products?.rm_cost);
  }

  const wageCost = totalWageCost(rows, teamDailyWageTotals);
  const profit = value - rmCost - wageCost;

  return { units, weight, value, rmCost, wageCost, profit, margin: marginPct(profit, value) };
}

/** Rows grouped by product. Wage cost isn't split here — it's a team/day cost, not a per-product one. */
export function groupByProduct(rows) {
  const map = new Map();
  for (const row of rows) {
    const name = row.products?.name ?? 'Unknown product';
    const entry = map.get(name) ?? { name, units: 0, weight: 0, value: 0, rmCost: 0 };
    const qty = Number(row.quantity) || 0;
    entry.units += qty;
    entry.weight += Number(row.weight) || 0;
    entry.value += lineValue(qty, row.products?.selling_price);
    entry.rmCost += lineRmCost(qty, row.products?.rm_cost);
    map.set(name, entry);
  }
  return Array.from(map.values())
    .map((e) => ({ ...e, profit: e.value - e.rmCost, margin: marginPct(e.value - e.rmCost, e.value) }))
    .sort((a, b) => b.value - a.value);
}

/** Rows grouped by team, with wage cost correctly counted once per team per day. */
export function groupByTeam(rows, teamDailyWageTotals) {
  const map = new Map();
  for (const row of rows) {
    const teamId = row.teams?.id;
    if (!teamId) continue;
    const label = `Team ${row.teams.team_number}`;
    const supervisorName = row.teams.supervisors?.name ?? '—';
    const key = teamId;
    const entry =
      map.get(key) ?? {
        teamId,
        label,
        supervisorName,
        units: 0,
        weight: 0,
        value: 0,
        rmCost: 0,
        days: new Set(),
      };
    const qty = Number(row.quantity) || 0;
    entry.units += qty;
    entry.weight += Number(row.weight) || 0;
    entry.value += lineValue(qty, row.products?.selling_price);
    entry.rmCost += lineRmCost(qty, row.products?.rm_cost);
    entry.days.add(row.production_date);
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((e) => {
      const wageCost = e.days.size * (teamDailyWageTotals.get(e.teamId) ?? 0);
      const profit = e.value - e.rmCost - wageCost;
      return {
        label: e.label,
        supervisorName: e.supervisorName,
        units: e.units,
        weight: e.weight,
        value: e.value,
        rmCost: e.rmCost,
        wageCost,
        profit,
        margin: marginPct(profit, e.value),
      };
    })
    .sort((a, b) => b.value - a.value);
}
