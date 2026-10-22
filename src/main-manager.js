import { supabase } from './services/supabaseClient.js';
import { requireLogin } from './utils/auth.js';
import { istToday, fetchRosterRows } from './utils/roster.js';
import { buildTeamDays, sumDays, fetchSummaries } from './utils/cost.js';
import { entryValue } from './utils/value.js';

const $ = id => document.getElementById(id);
const TODAY = istToday();
let SEL = TODAY, D = null, MONEY = false;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const num = n => (Math.round((n || 0) * 10) / 10).toLocaleString('en-IN');
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

async function load() {
  const [tr, pr, wr, rosters, summaries] = await Promise.all([
    supabase.from('teams').select('*').order('team_number'), supabase.from('products').select('*'),
    supabase.from('workers').select('name, daily_rate'), fetchRosterRows(supabase), fetchSummaries(supabase),
  ]);
  D = { teams: tr.data || [], products: pr.data || [], workers: wr.data || [], rosters, summaries };
}

async function draw() {
  const body = $('m-body');
  const { data: logs, error } = await supabase.from('production_log').select('*').eq('production_date', SEL).limit(20000);
  if (error) { body.innerHTML = `<div class="state-msg" style="color:#b91c1c">Error: ${esc(error.message)}</div>`; return; }
  const prod = new Map(D.products.map(p => [p.id, p]));
  const days = buildTeamDays(logs || [], D.teams, D.workers, D.rosters, D.summaries, D.products);
  const t = sumDays(days);
  const pct = t.value > 0 ? t.wage / t.value * 100 : 0;
  const m = new Map();
  for (const l of logs || []) {
    const p = prod.get(l.product_id);
    const r = m.get(l.product_id) || { name: p?.name || 'Unknown', qty: 0, wt: 0, value: 0 };
    r.qty += Number(l.quantity || 0); r.wt += Number(l.weight || 0); r.value += entryValue(l.quantity, l.weight, p);
    m.set(l.product_id, r);
  }
  const list = [...m.values()].sort((a, b) => b.qty - a.qty);
  const kpi = (icon, label, val, sub, accent) => `<div class="kpi-card" style="--accent-color:${accent}"><div class="kpi-icon">${icon}</div><div class="kpi-label">${label}</div><div class="kpi-value">${val}</div><div class="kpi-sub">${sub}</div></div>`;
  const empty = c => `<tr><td colspan="${c}" style="text-align:center;padding:20px;color:var(--ink-dim)">No production</td></tr>`;
  body.innerHTML = `
    <div class="kpi-grid">
      ${kpi('🏭', 'Units Made', num(t.units), `${list.length} products · ${days.length} team${days.length === 1 ? '' : 's'}`, 'var(--primary)')}
      ${kpi('⚖️', 'Weight Made', num(t.weight) + ' kg', 'total weight', 'var(--teal,#0ea5a4)')}
      ${MONEY ? kpi('💰', 'Value Produced', inr(t.value), 'at selling price', 'var(--green)') : ''}
      ${MONEY ? kpi('👷', 'Labour Cost', inr(t.wage), '1.5× overtime included', 'var(--red)') : ''}
      ${MONEY ? kpi('🧮', 'Labour % of Value', t.value > 0 ? pct.toFixed(1) + '%' : '—', `${inr(t.wage)} ÷ ${inr(t.value)}`, 'var(--orange)') : ''}
      ${MONEY ? kpi('📉', 'Labour Cost / kg', t.weight > 0 ? '₹' + t.cpk.toFixed(2) : '—', 'wage ÷ weight', 'var(--purple)') : ''}
      ${MONEY ? kpi('📈', 'Realisation / kg', t.weight > 0 ? '₹' + t.rpk.toFixed(2) : '—', 'value ÷ weight', 'var(--primary)') : ''}
    </div>
    <div class="section-head"><div><div class="section-title">Products made — ${fmtDate(SEL)}</div></div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th class="num">Quantity</th><th class="num">Weight (kg)</th>${MONEY ? '<th class="num">Value</th>' : ''}</tr></thead><tbody>
      ${list.map(r => `<tr><td class="bold">${esc(r.name)}</td><td class="num">${num(r.qty)}</td><td class="num">${num(r.wt)}</td>${MONEY ? `<td class="num">${inr(r.value)}</td>` : ''}</tr>`).join('') || empty(MONEY ? 4 : 3)}
    </tbody>${list.length ? `<tfoot><tr style="font-weight:700;background:var(--bg)"><td>Total</td><td class="num">${num(t.units)}</td><td class="num">${num(t.weight)}</td>${MONEY ? `<td class="num">${inr(t.value)}</td>` : ''}</tr></tfoot>` : ''}</table></div>
    <div class="section-head"><div><div class="section-title">Team-wise — ${fmtDate(SEL)}</div></div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Team</th><th class="num">Units</th><th class="num">Weight (kg)</th>${MONEY ? '<th class="num">Value</th><th class="num">Labour</th><th class="num">Labour %</th>' : ''}</tr></thead><tbody>
      ${days.map(r => `<tr><td class="bold">${esc(r.team)}</td><td class="num">${num(r.units)}</td><td class="num">${num(r.weight)}</td>${MONEY ? `<td class="num">${inr(r.value)}</td><td class="num">${inr(r.wage)}</td><td class="num">${r.value > 0 ? (r.wage / r.value * 100).toFixed(1) + '%' : '—'}</td>` : ''}</tr>`).join('') || empty(MONEY ? 6 : 3)}
    </tbody></table></div>`;
}
const refresh = async () => { try { await draw(); } catch (e) { $('m-body').innerHTML = `<div class="state-msg" style="color:#b91c1c">Error: ${esc(e.message)}</div>`; } };

requireLogin().then(async me => {
  if (!me.manager && !me.admin) { document.body.innerHTML = '<div class="state-msg" style="padding:40px;text-align:center">Master access only. <a href="#" id="so">Sign out</a></div>'; $('so').onclick = async () => { await supabase.auth.signOut(); location.reload(); }; return; }
  MONEY = !!(me.owner2 || me.admin);
  $('mgr-logout').onclick = async () => { await supabase.auth.signOut(); location.reload(); };
  const d = $('m-date'); d.value = SEL; d.max = TODAY;
  d.onchange = () => { if (!d.value) return; SEL = d.value > TODAY ? TODAY : d.value; d.value = SEL; refresh(); };
  $('m-today').onclick = () => { SEL = TODAY; d.value = SEL; refresh(); };
  await load(); await refresh();
  supabase.channel('ml-mgr').on('postgres_changes', { event: '*', schema: 'public', table: 'production_log' }, () => refresh()).subscribe();
});
