// Peak season: every worker is on overtime, paid 1.5x their daily rate.
// When peak season ends, set this to 1 and every screen recalculates.
export const OVERTIME_MULTIPLIER = 1.5;

/**
 * Wage for one team on one day = sum of members' daily_rate x multiplier,
 * counted ONCE per team per day (not per production entry).
 * Cost per kg = total wage / total weight produced.
 *
 * Returns one row per (team, day) that logged production:
 *   { date, teamId, team, units, weight, wage, cpk }
 */
export function buildTeamDays(logs, teams, workers) {
  const rate = new Map(workers.map(w => [w.name, Number(w.daily_rate || 0)]));
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const wageOf = t => (t?.members || []).reduce((s, m) => s + (rate.get(m) || 0), 0) * OVERTIME_MULTIPLIER;

  const rows = new Map();
  for (const l of logs) {
    const t = teamMap.get(l.team_id);
    const key = l.team_id + '|' + l.production_date;
    let r = rows.get(key);
    if (!r) {
      r = { date: l.production_date, teamId: l.team_id, team: t?.name || 'Team ' + (t?.team_number ?? '—'), units: 0, weight: 0, wage: wageOf(t) };
      rows.set(key, r);
    }
    r.units += Number(l.quantity || 0);
    r.weight += Number(l.weight || 0);
  }
  return [...rows.values()].map(r => ({ ...r, cpk: r.weight > 0 ? r.wage / r.weight : 0 }));
}

/** Sum a list of team-day rows: { units, weight, wage, cpk }. */
export function sumDays(list) {
  const s = list.reduce((a, r) => ({ units: a.units + r.units, weight: a.weight + r.weight, wage: a.wage + r.wage }), { units: 0, weight: 0, wage: 0 });
  return { ...s, cpk: s.weight > 0 ? s.wage / s.weight : 0 };
}

/** Chart.js scatter config: cost per kg (y) vs weight produced (x), one point per team per day. */
export function costVsWeightChart(teamDays) {
  return {
    type: 'scatter',
    data: { datasets: [{
      data: teamDays.filter(r => r.weight > 0).map(r => ({ x: +r.weight.toFixed(1), y: +r.cpk.toFixed(2), team: r.team, date: r.date })),
      backgroundColor: '#1967D2', pointRadius: 6, pointHoverRadius: 8,
    }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `${c.raw.team} · ${c.raw.date}: ${c.raw.x} kg, ₹${c.raw.y}/kg` } },
      },
      scales: {
        x: { title: { display: true, text: 'Weight produced (kg)' }, beginAtZero: true },
        y: { title: { display: true, text: 'Cost per kg (₹)' }, beginAtZero: true, ticks: { callback: v => '₹' + v } },
      },
    },
  };
}
