import { createClient } from '@supabase/supabase-js';
import { buildTeamDays, sumDays, costVsWeightChart, OVERTIME_MULTIPLIER } from '../../utils/cost.js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

let dashChannel = null;
let cpkChart = null;

const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const fmtDate = s => { const [y, m, d] = s.split('-'); return `${+d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y}`; };

export async function renderDashboard(root) {
  if (dashChannel) { supabase.removeChannel(dashChannel); dashChannel = null; }
  const TODAY = istToday();
  let days = 30;

  root.innerHTML = `
    <div id="dash-kpis"></div>
    <div class="section-head"><div><div class="section-title">Day-wise Production</div><div class="section-sub">Units made and production value per day</div></div><span class="badge badge-green" id="live-badge">● Live</span></div>
    <div class="range-bar">
      <button class="range-btn" data-d="7">7 Days</button>
      <button class="range-btn active" data-d="30">30 Days</button>
      <button class="range-btn" data-d="90">3 Months</button>
      <button class="range-btn" data-d="365">1 Year</button>
    </div>
    <div id="dash-days"></div>
    <div class="section-head"><div><div class="section-title">Cost per Kg vs Weight</div><div class="section-sub">Each dot = one team's day · wage (daily rate × ${OVERTIME_MULTIPLIER}) ÷ weight produced</div></div></div>
    <div class="card" style="margin-bottom:20px;"><canvas id="dash-cpk-chart"></canvas></div>
    <div class="section-head"><div class="section-title">Today by Product</div></div>
    <div id="dash-today"></div>`;

  async function load() {
    const from = new Date(Date.now() + 5.5 * 3600 * 1000 - days * 86400000).toISOString().slice(0, 10);
    const [lr, pr, tr, wr] = await Promise.all([
      supabase.from('production_log').select('*').gte('production_date', from).lte('production_date', TODAY).limit(20000),
      supabase.from('products').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('workers').select('name, daily_rate'),
    ]);
    const logs = lr.data || [], prodMap = Object.fromEntries((pr.data || []).map(p => [p.id, p]));
    const value = l => Number(l.quantity || 0) * Number(prodMap[l.product_id]?.selling_price || 0);

    // today KPIs
    const tl = logs.filter(l => l.production_date === TODAY);
    const tUnits = tl.reduce((s, l) => s + Number(l.quantity || 0), 0);
    const tWt = tl.reduce((s, l) => s + Number(l.weight || 0), 0);
    const tVal = tl.reduce((s, l) => s + value(l), 0);
    const teamDays = buildTeamDays(logs, tr.data || [], wr.data || []);
    const tCost = sumDays(teamDays.filter(r => r.date === TODAY));
    const active = new Set(tl.map(l => l.team_id)).size;
    root.querySelector('#dash-kpis').innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card" style="--accent-color:var(--primary)"><div class="kpi-icon">🏭</div><div class="kpi-label">Units Today</div><div class="kpi-value">${tUnits.toLocaleString('en-IN')}</div><div class="kpi-sub">${tl.length} entries</div></div>
        <div class="kpi-card" style="--accent-color:var(--green)"><div class="kpi-icon">💰</div><div class="kpi-label">Value Today</div><div class="kpi-value">${inr(tVal)}</div><div class="kpi-sub">at selling price</div></div>
        <div class="kpi-card" style="--accent-color:var(--orange)"><div class="kpi-icon">⚖️</div><div class="kpi-label">Weight Today</div><div class="kpi-value">${tWt.toFixed(1)}</div><div class="kpi-sub">Kilograms</div></div>
        <div class="kpi-card" style="--accent-color:var(--red)"><div class="kpi-icon">🧮</div><div class="kpi-label">Cost per kg Today</div><div class="kpi-value">${tCost.cpk > 0 ? '₹' + tCost.cpk.toFixed(2) : '—'}</div><div class="kpi-sub">wage ${inr(tCost.wage)} ÷ ${tWt.toFixed(1)} kg</div></div>
        <div class="kpi-card" style="--accent-color:var(--purple)"><div class="kpi-icon">👷</div><div class="kpi-label">Active Teams</div><div class="kpi-value">${active}</div><div class="kpi-sub">of ${(tr.data || []).length} total</div></div>
      </div>`;

    // day-wise
    const byDay = {};
    teamDays.forEach(td => { const d = byDay[td.date] ||= { u: 0, w: 0, v: 0, n: 0, g: 0 }; d.g += td.wage; });
    logs.forEach(l => { const d = byDay[l.production_date] ||= { u: 0, w: 0, v: 0, n: 0, g: 0 }; d.u += Number(l.quantity || 0); d.w += Number(l.weight || 0); d.v += value(l); d.n++; });
    const dayKeys = Object.keys(byDay).sort().reverse();
    const tot = dayKeys.reduce((a, k) => ({ u: a.u + byDay[k].u, w: a.w + byDay[k].w, v: a.v + byDay[k].v, g: a.g + byDay[k].g }), { u: 0, w: 0, v: 0, g: 0 });
    const dRows = dayKeys.map(k => `<tr><td class="bold">${fmtDate(k)}</td><td class="num">${byDay[k].u.toLocaleString('en-IN')}</td><td class="num">${byDay[k].w.toFixed(1)} kg</td><td class="num" style="color:var(--green);font-weight:600;">${inr(byDay[k].v)}</td><td class="num">${inr(byDay[k].g)}</td><td class="num" style="font-weight:600;">${byDay[k].w > 0 ? '₹' + (byDay[k].g / byDay[k].w).toFixed(2) : '—'}</td></tr>`).join('')
      || '<tr><td colspan="6" style="text-align:center;color:var(--ink-dim);padding:20px;">No production in this period</td></tr>';
    root.querySelector('#dash-days').innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Date</th><th class="num">Units</th><th class="num">Weight</th><th class="num">Value</th><th class="num">Wage</th><th class="num">Cost/kg</th></tr></thead>
      <tbody>${dRows}</tbody>
      ${dayKeys.length ? `<tfoot><tr style="font-weight:700;background:var(--bg);"><td>Total (${dayKeys.length} days)</td><td class="num">${tot.u.toLocaleString('en-IN')}</td><td class="num">${tot.w.toFixed(1)} kg</td><td class="num">${inr(tot.v)}</td><td class="num">${inr(tot.g)}</td><td class="num">${tot.w > 0 ? '₹' + (tot.g / tot.w).toFixed(2) : '—'}</td></tr></tfoot>` : ''}
    </table></div>`;

    // cost per kg vs weight chart
    if (cpkChart) { cpkChart.destroy(); cpkChart = null; }
    const cv = root.querySelector('#dash-cpk-chart');
    if (cv && teamDays.length && window.Chart) cpkChart = new window.Chart(cv, costVsWeightChart(teamDays));

    // today by product
    const byProd = {};
    tl.forEach(l => { const n = prodMap[l.product_id]?.name || '—'; const p = byProd[n] ||= { q: 0, w: 0, v: 0 }; p.q += Number(l.quantity || 0); p.w += Number(l.weight || 0); p.v += value(l); });
    const pRows = Object.entries(byProd).sort((a, b) => b[1].q - a[1].q).map(([n, v]) => `<tr><td class="bold">${n}</td><td class="num">${v.q}</td><td class="num">${v.w.toFixed(1)} kg</td><td class="num">${inr(v.v)}</td></tr>`).join('')
      || '<tr><td colspan="4" style="text-align:center;color:var(--ink-dim);padding:20px;">No production today</td></tr>';
    root.querySelector('#dash-today').innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Product</th><th class="num">Units</th><th class="num">Weight</th><th class="num">Value</th></tr></thead><tbody>${pRows}</tbody></table></div>`;
  }

  root.querySelectorAll('.range-btn').forEach(b => b.addEventListener('click', () => {
    root.querySelectorAll('.range-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); days = +b.dataset.d; load();
  }));

  await load();

  dashChannel = supabase.channel(`owner-dash-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_log' }, () => {
      const b = document.getElementById('live-badge');
      if (b) { b.textContent = '● Updated'; setTimeout(() => { b.textContent = '● Live'; }, 2000); }
      load();
    }).subscribe();
}
