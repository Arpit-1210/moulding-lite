// Automatic daily close. After 12:00 am (Indian time) every finished day is
// saved as one frozen summary row (units, weight, value, wage) and rolls into
// the monthly record. Wage is locked at close time, so changing the overtime
// multiplier or a worker's rate later never changes finished days.
import { buildTeamDays, sumDays, fetchSummaries, OVERTIME_MULTIPLIER } from './cost.js';
import { istToday, fetchRosterRows } from './roster.js';
import { entryValue } from './value.js';

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

/** (Re)compute and save the summary for the given dates. */
export async function closeDays(supabase, dates) {
  for (const part of chunk([...new Set(dates)], 30)) {
    const [lr, tr, wr, pr, rosters] = await Promise.all([
      supabase.from('production_log').select('team_id, product_id, production_date, quantity, weight').in('production_date', part).limit(50000),
      supabase.from('teams').select('*'),
      supabase.from('workers').select('name, daily_rate'),
      supabase.from('products').select('id, selling_price, pricing_unit'),
      fetchRosterRows(supabase),
    ]);
    const logs = lr.data || [];
    const price = new Map((pr.data || []).map(p => [p.id, p]));
    const teamDays = buildTeamDays(logs, tr.data || [], wr.data || [], rosters); // live wage, no frozen
    const rows = part.map(d => {
      const td = teamDays.filter(r => r.date === d);
      const t = sumDays(td);
      const value = logs.filter(l => l.production_date === d).reduce((s, l) => s + entryValue(l.quantity, l.weight, price.get(l.product_id)), 0);
      return {
        summary_date: d, units: t.units, weight: t.weight, value, wage: t.wage, multiplier: OVERTIME_MULTIPLIER,
        teams: td.map(r => ({ team_id: String(r.teamId), team: r.team, units: r.units, weight: r.weight, wage: r.wage })),
        closed_at: new Date().toISOString(),
      };
    });
    if (rows.length) {
      const { error } = await supabase.from('daily_summary').upsert(rows, { onConflict: 'summary_date' });
      if (error) throw error;
    }
  }
}

/** Close every finished day that has production but no summary yet. */
export async function closePastDays(supabase) {
  const today = istToday();
  const { data } = await supabase.from('production_log').select('production_date').lt('production_date', today).limit(50000);
  const dates = [...new Set((data || []).map(r => r.production_date))];
  if (!dates.length) return;
  const have = new Set((await fetchSummaries(supabase)).map(s => s.summary_date));
  const missing = dates.filter(d => !have.has(d));
  if (missing.length) await closeDays(supabase, missing);
}

/** Run at app start and again right after midnight (IST) while the app is open. */
export function startAutoClose(supabase) {
  let day = istToday();
  closePastDays(supabase).catch(e => console.warn('auto-close:', e.message));
  setInterval(async () => {
    if (istToday() !== day) {
      try { await closePastDays(supabase); } catch (e) { console.warn('auto-close:', e.message); }
      location.reload();
    }
  }, 60000);
}

/** Month-by-month record: finished days from summaries + today live. */
export async function loadMonthly(supabase) {
  const today = istToday();
  const [summaries, lr, pr, tr, wr, rosters] = await Promise.all([
    fetchSummaries(supabase),
    supabase.from('production_log').select('team_id, product_id, production_date, quantity, weight').eq('production_date', today).limit(5000),
    supabase.from('products').select('id, selling_price, pricing_unit'),
    supabase.from('teams').select('*'),
    supabase.from('workers').select('name, daily_rate'),
    fetchRosterRows(supabase),
  ]);
  const months = new Map();
  const add = (date, u, w, v, g) => {
    const k = date.slice(0, 7);
    const m = months.get(k) || { month: k, dates: new Set(), units: 0, weight: 0, value: 0, wage: 0 };
    m.dates.add(date); m.units += u; m.weight += w; m.value += v; m.wage += g;
    months.set(k, m);
  };
  for (const s of summaries) if (s.summary_date < today) add(s.summary_date, Number(s.units), Number(s.weight), Number(s.value), Number(s.wage));
  const logs = lr.data || [];
  if (logs.length) {
    const price = new Map((pr.data || []).map(p => [p.id, p]));
    const t = sumDays(buildTeamDays(logs, tr.data || [], wr.data || [], rosters));
    add(today, t.units, t.weight, logs.reduce((s, l) => s + entryValue(l.quantity, l.weight, price.get(l.product_id)), 0), t.wage);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month))
    .map(m => ({ ...m, days: m.dates.size, cpk: m.weight > 0 ? m.wage / m.weight : 0, rpk: m.weight > 0 ? m.value / m.weight : 0 }));
}

export function monthlyTableHTML(rows, tableClass) {
  const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
  const label = k => { const [y, m] = k.split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1] + ' ' + y; };
  const body = rows.map(r => `<tr><td class="bold">${label(r.month)}</td><td class="num">${r.days}</td><td class="num">${r.units.toLocaleString('en-IN')}</td><td class="num">${r.weight.toFixed(1)} kg</td><td class="num">${inr(r.value)}</td><td class="num">${inr(r.wage)}</td><td class="num" style="font-weight:600;">${r.cpk > 0 ? '₹' + r.cpk.toFixed(2) : '—'}</td><td class="num" style="font-weight:600;">${r.rpk > 0 ? '₹' + r.rpk.toFixed(2) : '—'}</td></tr>`).join('')
    || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#667085;">No production recorded yet</td></tr>';
  return `<div class="table-wrap"><table class="${tableClass}">
    <thead><tr><th>Month</th><th class="num">Days</th><th class="num">Units</th><th class="num">Weight</th><th class="num">Value</th><th class="num">Wage</th><th class="num">Labour Cost/kg</th><th class="num">Realisation/kg</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}
