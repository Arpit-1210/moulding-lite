// Peak season: every worker is on overtime, paid 1.5x their daily rate.
// When peak season ends, set this to 1 and every screen recalculates.
import { rosterIndex, membersOn, fetchRosterRows } from './roster.js';

export const OVERTIME_MULTIPLIER = 1.5;

/**
 * Wage for one team on one day = sum of THAT DAY's roster members' daily_rate
 * x multiplier, counted ONCE per team per day (not per production entry).
 * Cost per kg = total wage / total weight produced.
 *
 * Returns one row per (team, day) that logged production:
 *   { date, teamId, team, units, weight, wage, cpk }
 */
export function buildTeamDays(logs, teams, workers, rosterRows = [], summaries = []) {
  const rate = new Map(workers.map(w => [w.name, Number(w.daily_rate || 0)]));
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const idx = rosterIndex(rosterRows);
  // Closed (finished) days use the wage frozen at close time, so later rate or multiplier changes never alter history.
  const frozen = new Map();
  for (const sm of summaries) for (const t of sm.teams || []) frozen.set(`${sm.summary_date}|${t.team_id}`, Number(t.wage || 0));
  const wageOf = (t, date) => membersOn(idx, t?.id, date).reduce((s, m) => s + (rate.get(m) || 0), 0) * OVERTIME_MULTIPLIER;

  const rows = new Map();
  for (const l of logs) {
    const t = teamMap.get(l.team_id);
    const key = l.team_id + '|' + l.production_date;
    let r = rows.get(key);
    if (!r) {
      r = { date: l.production_date, teamId: l.team_id, team: t?.name || 'Team ' + (t?.team_number ?? '—'), units: 0, weight: 0, wage: frozen.has(`${l.production_date}|${l.team_id}`) ? frozen.get(`${l.production_date}|${l.team_id}`) : wageOf(t, l.production_date) };
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

/** All-time cost data (permanent totals): every log, team, worker and roster. */
export async function loadCostData(supabase) {
  const [lr, tr, wr, rosters, summaries] = await Promise.all([
    supabase.from('production_log').select('team_id, production_date, quantity, weight').limit(50000),
    supabase.from('teams').select('*'),
    supabase.from('workers').select('name, daily_rate'),
    fetchRosterRows(supabase),
    fetchSummaries(supabase),
  ]);
  const teamDays = buildTeamDays(lr.data || [], tr.data || [], wr.data || [], rosters, summaries);
  return { teamDays, overall: sumDays(teamDays) };
}

export async function fetchSummaries(supabase) {
  const { data, error } = await supabase.from('daily_summary').select('*').limit(5000);
  if (error) { console.warn('daily_summary not available:', error.message); return []; }
  return data || [];
}
