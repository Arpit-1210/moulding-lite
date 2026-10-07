// v2.1 - date picker added
import './styles/base.css';
import { supabase } from './services/supabaseClient.js';
import { requireLogin } from './utils/auth.js';
import { buildTeamDays, sumDays, costVsWeightChart, loadCostData, fetchSummaries, OVERTIME_MULTIPLIER } from './utils/cost.js';
import { startAutoClose, closeDays, loadMonthly, monthlyTableHTML } from './utils/dayclose.js';
import { istToday, fetchRosterRows, rosterIndex, membersOn, hasExact, conflictTeam, withRoster, saveRoster } from './utils/roster.js';


// ── State ──
let currentTeamId = null;
let teams = [], products = [], workers = [], todayLogs = [];
let currentPage = 'dashboard';
const TODAY = istToday();
let SEL = TODAY;            // ONE date for the whole app
let logDays = 0;
const fmtD = d => d === TODAY ? 'Today' : new Date(d + 'T12:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// ── Toast ──
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Date pill ──
document.getElementById('date-pill').textContent =
  new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

// ── Sidebar toggle ──
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('open');
});
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}
document.getElementById('overlay').addEventListener('click', closeSidebar);

// ── Navigation ──
function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  const titles = { dashboard: 'Dashboard', production: 'Log Production', teams: 'Teams', log: 'History', inventory: 'Inventory' };
  document.getElementById('page-title').textContent = titles[page] || page;
  closeSidebar();
  switch(page) {
    case 'dashboard':  renderDashboard(); break;
    case 'production': renderProduction(); break;
    case 'teams':      renderTeams(); break;
    case 'log':        renderLog(0); break;
    case 'inventory':  renderInventory(); break;
  }
}
window.showPage = showPage;

document.querySelectorAll('.nav-item').forEach(btn =>
  btn.addEventListener('click', () => showPage(btn.dataset.page))
);

// Range buttons
document.querySelectorAll('[data-days]').forEach(btn =>
  btn.addEventListener('click', () => {
    btn.closest('.range-bar').querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLog(parseInt(btn.dataset.days));
  })
);

// ── Load data ──
async function loadData() {
  const [tr, pr, wr] = await Promise.all([
    supabase.from('teams').select('*').order('team_number'),
    supabase.from('products').select('*').eq('active', true).order('name'),
    supabase.from('workers').select('*').eq('active', true).order('name'),
  ]);
  teams = tr.data || [];
  products = pr.data || [];
  workers = wr.data || [];
  if (teams.length && !currentTeamId) currentTeamId = teams[0].id;
  await loadTodayLogs();
}

async function loadTodayLogs() {
  await loadLogsForDate(SEL);
}

async function loadLogsForDate(date) {
  if (!teams.length) { todayLogs = []; return; }
  const { data } = await supabase.from('production_log').select('*')
    .in('team_id', teams.map(t => t.id))
    .eq('production_date', date)
    .order('created_at', { ascending: false });
  todayLogs = data || [];
}

// ── Dashboard ──
async function renderDashboard() {
  const el = document.getElementById('dash-content');
  el.innerHTML = '<div class="state-msg">Loading…</div>';
  const [lr, pr, tr, wr0, rosters0, sums0] = await Promise.all([
    supabase.from('production_log').select('*').eq('production_date', SEL),
    supabase.from('products').select('*'),
    supabase.from('teams').select('*'),
    supabase.from('workers').select('name, daily_rate'),
    fetchRosterRows(supabase),
    fetchSummaries(supabase),
  ]);
  const logs = lr.data || [], prods = pr.data || [], allTeams = tr.data || [];
  const dayTeamDays = buildTeamDays(logs, allTeams, wr0.data || [], rosters0, sums0);
  const dayTot = sumDays(dayTeamDays);
  const permanent = (await loadCostData(supabase)).overall;
  const prodMap = Object.fromEntries(prods.map(p => [p.id, p]));
  const totalUnits = logs.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalWeight = logs.reduce((s, l) => s + Number(l.weight || 0), 0);
  const activeTeams = [...new Set(logs.map(l => l.team_id))].length;
  const byProd = {};
  logs.forEach(l => {
    const n = prodMap[l.product_id]?.name || '—';
    if (!byProd[n]) byProd[n] = { qty: 0, wt: 0 };
    byProd[n].qty += Number(l.quantity || 0);
    byProd[n].wt += Number(l.weight || 0);
  });

  const teamCards = allTeams.map(t => {
    const tLogs = logs.filter(l => l.team_id === t.id);
    const tUnits = tLogs.reduce((s, l) => s + Number(l.quantity || 0), 0);
    const tWt = tLogs.reduce((s, l) => s + Number(l.weight || 0), 0);
    const active = tUnits > 0;
    const tdRow = dayTeamDays.find(r => r.team === (t.name || 'Team ' + t.team_number));
    const tCpk = tdRow && tdRow.weight > 0 ? '₹' + tdRow.cpk.toFixed(2) : '—';
    return `<div class="team-card" style="border-left-color:${active ? '#16a34a' : '#e4e7ec'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3>${t.name || 'Team ' + t.team_number}</h3>
        <span class="badge ${active ? 'badge-green' : ''}" style="${!active ? 'background:#f8f9fb;color:#98a2b3;' : ''}">${active ? '● Active' : 'Idle'}</span>
      </div>
      <div class="tstat"><span class="l">Units</span><span class="v" style="color:#1967D2">${tUnits}</span></div>
      <div class="tstat"><span class="l">Weight</span><span class="v">${tWt.toFixed(1)} kg</span></div>
      <div class="tstat"><span class="l">Entries</span><span class="v">${tLogs.length}</span></div>
      <div class="tstat"><span class="l">Cost per kg</span><span class="v" style="color:#dc2626">${tCpk}</span></div>
    </div>`;
  }).join('') || '<div class="state-msg">No teams yet</div>';

  const prodRows = Object.entries(byProd).sort((a, b) => b[1].qty - a[1].qty)
    .map(([n, v]) => `<tr><td class="bold">${n}</td><td class="num">${v.qty}</td><td class="num">${v.wt.toFixed(1)} kg</td></tr>`)
    .join('') || '<tr><td colspan="3" style="text-align:center;color:#667085;padding:20px;">No production on this date</td></tr>';

  el.innerHTML = `
    <div class="hero-banner">
      <div>
        <div class="hero-title">Good ${new Date().getHours() < 12 ? 'Morning' : 'Afternoon'} 👋</div>
        <div class="hero-sub">Moulding · ${fmtD(SEL)}</div>
      </div>
      <button class="hero-action" onclick="showPage('production')">Log Production →</button>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card" style="--ac:#1967D2"><div class="kpi-icon">🏭</div><div class="kpi-label">Units · ${fmtD(SEL)}</div><div class="kpi-value">${totalUnits}</div><div class="kpi-sub">${logs.length} entries</div></div>
      <div class="kpi-card" style="--ac:#16a34a"><div class="kpi-icon">⚖️</div><div class="kpi-label">Weight (kg)</div><div class="kpi-value">${totalWeight.toFixed(1)}</div><div class="kpi-sub">produced</div></div>
      <div class="kpi-card" style="--ac:#d97706"><div class="kpi-icon">👷</div><div class="kpi-label">Active Teams</div><div class="kpi-value">${activeTeams}</div><div class="kpi-sub">of ${allTeams.length} total</div></div>
      <div class="kpi-card" style="--ac:#7c3aed"><div class="kpi-icon">📦</div><div class="kpi-label">Products</div><div class="kpi-value">${Object.keys(byProd).length}</div><div class="kpi-sub">made</div></div>
      <div class="kpi-card" style="--ac:#dc2626"><div class="kpi-icon">🏭</div><div class="kpi-label">Factory Cost per kg · ${fmtD(SEL)}</div><div class="kpi-value">${dayTot.cpk > 0 ? '₹' + dayTot.cpk.toFixed(2) : '—'}</div><div class="kpi-sub">labour ₹${Math.round(dayTot.wage).toLocaleString('en-IN')} ÷ ${totalWeight.toFixed(1)} kg</div></div>
      <div class="kpi-card" style="--ac:#dc2626"><div class="kpi-icon">🧮</div><div class="kpi-label">Total Cost per kg</div><div class="kpi-value">${permanent.cpk > 0 ? '₹' + permanent.cpk.toFixed(2) : '—'}</div><div class="kpi-sub">all time · ₹${Math.round(permanent.wage).toLocaleString('en-IN')} ÷ ${permanent.weight.toFixed(0)} kg</div></div>
    </div>
    <div class="section-head"><div><div class="section-title">Teams — ${fmtD(SEL)}</div></div></div>
    <div class="team-grid">${teamCards}</div>
    <div class="section-head"><div class="section-title">${fmtD(SEL)} by Product</div></div>
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Product</th><th class="num">Units</th><th class="num">Weight</th></tr></thead>
      <tbody>${prodRows}</tbody>
    </table></div>`;

  if (window._dashCh) supabase.removeChannel(window._dashCh);
  window._dashCh = supabase.channel(`dash-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_log', filter: `production_date=eq.${SEL}` },
      () => { if (currentPage === 'dashboard') renderDashboard(); })
    .subscribe();
}

// ── Production ──
async function renderProduction() {
  const el = document.getElementById('prod-content');
  el.innerHTML = `
    <div class="today-bar">
      <div class="today-kpi"><div class="val" id="kpi-units">0</div><div class="lbl">Units</div></div>
      <div class="today-kpi"><div class="val" id="kpi-weight">0</div><div class="lbl">Kg</div></div>
      <div class="today-kpi"><div class="val" id="kpi-entries">0</div><div class="lbl">Entries</div></div>
    </div>
    <div class="prod-panel">
      <div style="font-size:13px;font-weight:600;color:#1967D2;margin-bottom:10px;">📅 Logging for ${fmtD(SEL)} <span style="font-weight:400;color:#667085;">(change the date at the top)</span></div>
      <div class="team-tabs" id="team-tabs"></div>
      <div id="roster-note" style="font-size:12px;color:#667085;margin:-2px 0 12px;"></div>
      <div class="field">
        <label>Search Product</label>
        <input type="text" id="prod-search" placeholder="Type to search…" autocomplete="off" />
      </div>
      <div class="field">
        <label>Product</label>
        <select id="prod-select"><option value="">Select product…</option></select>
      </div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0;"><label>Quantity (pcs)</label><input type="number" id="prod-qty" inputmode="numeric" placeholder="0" min="1" /></div>
        <div class="field" style="margin-bottom:0;"><label>Weight (kg)</label><input type="number" id="prod-wt" inputmode="decimal" placeholder="0.0" step="0.1" /></div>
      </div>
      <div style="height:12px;"></div>
      <button class="btn-primary" id="btn-save">Save Entry</button>
    </div>
    <div class="section-head" style="margin-top:4px;"><div class="section-title" id="log-date-title">Today's Log</div></div>
    <div id="prod-log"><div class="state-msg">No entries yet</div></div>`;

  // Team tabs
  const tabsEl = document.getElementById('team-tabs');
  tabsEl.innerHTML = teams.map(t =>
    `<button class="team-tab ${t.id === currentTeamId ? 'active' : ''}" data-id="${t.id}">${t.name || 'Team ' + t.team_number}</button>`
  ).join('');
  tabsEl.querySelectorAll('.team-tab').forEach(btn =>
    btn.addEventListener('click', () => {
      currentTeamId = btn.dataset.id;
      tabsEl.querySelectorAll('.team-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateRosterNote();
    })
  );

  let prodRosters = await fetchRosterRows(supabase);
  function updateRosterNote() {
    const d = SEL;
    const t = teams.find(x => x.id === currentTeamId);
    const m = t ? membersOn(rosterIndex(prodRosters), t.id, d) : [];
    const note = document.getElementById('roster-note');
    if (!note) return;
    note.innerHTML = m.length
      ? `👷 ${m.length} workers on ${d === TODAY ? 'today' : d}: ${m.join(', ')}`
      : `<span style="color:#dc2626;">⚠ No workers set for this team on ${d === TODAY ? 'today' : d} — set them in Teams first.</span>`;
  }
  updateRosterNote();

  // Product search
  const sel = document.getElementById('prod-select');
  function fillProducts(filter = '') {
    const list = filter ? products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())) : products;
    sel.innerHTML = '<option value="">Select product…</option>' +
      list.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
  fillProducts();
  document.getElementById('prod-search').addEventListener('input', e => fillProducts(e.target.value));

  updateKPIs();
  renderTodayLog();

  // Save
  document.getElementById('btn-save').addEventListener('click', async () => {
    const productId = sel.value;
    const qty = parseFloat(document.getElementById('prod-qty').value);
    const wt = parseFloat(document.getElementById('prod-wt').value);
    if (!currentTeamId) { toast('No team selected', 'error'); return; }
    if (!productId) { toast('Select a product', 'error'); return; }
    if (!qty || qty <= 0) { toast('Enter quantity', 'error'); return; }
    if (!wt || wt <= 0) { toast('Enter weight', 'error'); return; }
    const dateForRoster = SEL;
    const idx = rosterIndex(prodRosters);
    const dayMembers = membersOn(idx, currentTeamId, dateForRoster);
    if (!dayMembers.length) { toast('Set this team’s workers for this date in Teams first', 'error'); return; }
    if (!hasExact(idx, currentTeamId, dateForRoster)) {
      try { await saveRoster(supabase, currentTeamId, dateForRoster, dayMembers); prodRosters = withRoster(prodRosters, currentTeamId, dateForRoster, dayMembers); }
      catch (e) { toast('Could not save team for this day: ' + e.message, 'error'); return; }
    }
    const btn = document.getElementById('btn-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    const now = new Date();
    const selectedDate = SEL;
    const { data, error } = await supabase.from('production_log').insert([{
      team_id: currentTeamId, product_id: productId, quantity: qty, weight: wt,
      production_date: selectedDate, production_time: now.toTimeString().slice(0, 5),
    }]).select().single();
    btn.disabled = false; btn.textContent = 'Save Entry';
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    if (selectedDate < TODAY) closeDays(supabase, [selectedDate]).catch(() => {});
    todayLogs.unshift(data);
    document.getElementById('prod-qty').value = '';
    document.getElementById('prod-wt').value = '';
    sel.value = '';
    document.getElementById('prod-search').value = '';
    fillProducts();
    // Reload log for selected date
    await loadLogsForDate(SEL);
    updateKPIs();
    renderTodayLog();
    toast('Saved ✓');
  });

  const title = document.getElementById('log-date-title');
  if (title) title.textContent = SEL === TODAY ? "Today's Log" : `Log for ${fmtD(SEL)}`;
}

function updateKPIs() {
  const u = document.getElementById('kpi-units');
  const w = document.getElementById('kpi-weight');
  const e = document.getElementById('kpi-entries');
  if (u) u.textContent = todayLogs.reduce((s, l) => s + Number(l.quantity || 0), 0);
  if (w) w.textContent = todayLogs.reduce((s, l) => s + Number(l.weight || 0), 0).toFixed(1);
  if (e) e.textContent = todayLogs.length;
}

function renderTodayLog() {
  const el = document.getElementById('prod-log');
  if (!el) return;
  const prodMap = Object.fromEntries(products.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  if (!todayLogs.length) { el.innerHTML = '<div class="state-msg">No entries yet today</div>'; return; }
  el.innerHTML = todayLogs.map(l => `
    <div class="log-item">
      <div>
        <div class="log-prod-name">${prodMap[l.product_id]?.name || '—'}</div>
        <div class="log-prod-meta">${teamMap[l.team_id]?.name || 'Team ' + (teamMap[l.team_id]?.team_number || '—')} · ${l.production_time || ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="text-align:right;">
          <div class="log-prod-qty">${l.quantity}</div>
          <div class="log-prod-wt">${l.weight} kg</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <button onclick="editEntry('${l.id}')" style="border:1px solid #d0d5dd;background:#fff;border-radius:6px;padding:4px 8px;font-size:13px;cursor:pointer;">✏️</button>
          <button onclick="deleteEntry('${l.id}')" style="border:1px solid #fecaca;background:#fff;border-radius:6px;padding:4px 8px;font-size:13px;cursor:pointer;">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}

// ── Teams (fixed per day) ──
let rosterRows = [];

async function renderTeams() {
  const el = document.getElementById('teams-content');
  el.innerHTML = '<div class="state-msg">Loading…</div>';
  const { data } = await supabase.from('teams').select('*').order('team_number');
  teams = data || [];
  rosterRows = await fetchRosterRows(supabase);

  const membersOf = t => membersOn(rosterIndex(rosterRows), t.id, SEL);

  async function saveMembers(t, members) {
    await saveRoster(supabase, t.id, SEL, members);
    rosterRows = withRoster(rosterRows, t.id, SEL, members);
  }

  async function addTeam() {
    const next = teams.length + 1;
    const { data: t } = await supabase.from('teams').insert([{
      team_number: next, name: `Team ${next}`, members: [],
      supervisor_id: '00000000-0000-0000-0000-000000000000'
    }]).select().single();
    if (t) { teams.push(t); renderCards(); toast('Team added'); }
    else {
      const { data: t2 } = await supabase.from('teams').insert([{
        team_number: next, name: `Team ${next}`, members: []
      }]).select().single();
      if (t2) { teams.push(t2); renderCards(); toast('Team added'); }
    }
  }

  async function renameTeam(id, name) {
    if (!name.trim()) return;
    await supabase.from('teams').update({ name: name.trim() }).eq('id', id);
    const t = teams.find(x => x.id === id); if (t) t.name = name.trim();
    renderCards(); toast('Renamed');
  }

  async function addMember(id, name) {
    name = (name || '').trim();
    if (!name) return;
    const t = teams.find(x => x.id === id); if (!t) return;
    const w = workers.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!w) { toast('Pick a worker from the list', 'error'); return; }
    const current = membersOf(t);
    if (current.includes(w.name)) { toast('Already in this team today', 'error'); return; }
    const other = conflictTeam(rosterIndex(rosterRows), teams, t.id, SEL, w.name);
    if (other) { toast(`${w.name} is already in ${other} on this day — remove him there first`, 'error'); return; }
    try { await saveMembers(t, [...current, w.name]); } catch (e) { toast('Save failed: ' + e.message, 'error'); return; }
    renderCards(); toast(`${w.name} added`);
  }

  async function removeMember(id, name) {
    const t = teams.find(x => x.id === id); if (!t) return;
    try { await saveMembers(t, membersOf(t).filter(m => m !== name)); } catch (e) { toast('Save failed: ' + e.message, 'error'); return; }
    renderCards();
  }

  function renderCards() {
    const label = SEL === TODAY ? 'today' : SEL;
    el.innerHTML = `
      <div class="team-setup-card" style="border-left:4px solid #1967D2;">
        <div style="font-weight:700;margin-bottom:6px;">📅 Teams for ${fmtD(SEL)}</div>
        <div style="font-size:12px;color:#667085;">Teams are fixed for <b>${label}</b> only. Changes here never affect other days. A new day starts as a copy of the previous day's teams.</div>
      </div>` +
      teams.map(t => {
        const members = membersOf(t);
        return `
      <div class="team-setup-card">
        <div class="team-head">
          <span class="team-badge">👷 ${t.name || 'Team ' + t.team_number}</span>
          <span style="font-size:12px;color:#667085;">${members.length} members</span>
        </div>
        <div class="rename-row">
          <input type="text" id="rename-${t.id}" value="${t.name || 'Team ' + t.team_number}" placeholder="Team name" />
          <button class="btn-rename" onclick="renameTeam('${t.id}',document.getElementById('rename-${t.id}').value)">Rename</button>
        </div>
        <div class="member-chips">
          ${members.map(m => `
            <span class="chip">${m}<span class="chip-remove" onclick="removeMember('${t.id}','${m.replace(/'/g, "\\'")}')">×</span></span>
          `).join('') || '<span style="font-size:12px;color:#98a2b3;">No members for this day</span>'}
        </div>
        <div class="add-member-row">
          <input type="text" id="wsearch-${t.id}" placeholder="Search worker…" oninput="filterW('${t.id}',this.value)" />
          <select id="wsel-${t.id}">
            <option value="">Pick worker…</option>
            ${workers.map(w => `<option value="${w.name}">${w.name} (₹${w.daily_rate || 0}/day)</option>`).join('')}
          </select>
          <button class="btn-add" onclick="addMember('${t.id}',document.getElementById('wsel-${t.id}').value||document.getElementById('wsearch-${t.id}').value)">Add</button>
        </div>
      </div>`;
      }).join('') +
      `<button class="btn-ghost" onclick="addTeam()">+ Add Team ${teams.length + 1}</button>`;

    window.renameTeam = renameTeam;
    window.addMember = addMember;
    window.removeMember = removeMember;
    window.addTeam = addTeam;
    window.filterW = (id, val) => {
      const s = document.getElementById(`wsel-${id}`); if (!s) return;
      const f = val ? workers.filter(w => w.name.toLowerCase().includes(val.toLowerCase())) : workers;
      s.innerHTML = '<option value="">Pick worker…</option>' + f.map(w => `<option value="${w.name}">${w.name} (₹${w.daily_rate || 0}/day)</option>`).join('');
    };
  }
  renderCards();
}

// ── History ──
async function renderLog(days) {
  logDays = days;
  const el = document.getElementById('log-content');
  el.innerHTML = '<div class="state-msg">Loading…</div>';
  const from = new Date(SEL + 'T12:00:00Z'); if (days > 0) from.setUTCDate(from.getUTCDate() - days);
  const fromStr = days === 365 ? '2020-01-01' : from.toISOString().slice(0, 10);
  const [lr, pr, tr] = await Promise.all([
    supabase.from('production_log').select('*').gte('production_date', fromStr).lte('production_date', SEL).order('production_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('products').select('*'),
    supabase.from('teams').select('*'),
  ]);
  const logs = lr.data || [], prods = pr.data || [], allTeams = tr.data || [];
  const prodMap = Object.fromEntries(prods.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t]));
  const totalU = logs.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalW = logs.reduce((s, l) => s + Number(l.weight || 0), 0);
  const rows = logs.map(l => `<tr>
    <td>${l.production_date}</td>
    <td>${teamMap[l.team_id]?.name || 'Team ' + (teamMap[l.team_id]?.team_number || '—')}</td>
    <td class="bold">${prodMap[l.product_id]?.name || '—'}</td>
    <td class="num">${l.quantity}</td>
    <td class="num">${Number(l.weight).toFixed(1)}</td>
 <td style="color:#667085;font-size:12px;">${l.production_time || ''}</td>
    <td style="white-space:nowrap;"><button onclick="editEntry('${l.id}')" style="border:1px solid #d0d5dd;background:#fff;border-radius:6px;padding:4px 8px;font-size:13px;cursor:pointer;">✏️</button> <button onclick="deleteEntry('${l.id}')" style="border:1px solid #fecaca;background:#fff;border-radius:6px;padding:4px 8px;font-size:13px;cursor:pointer;">🗑️</button></td>
  </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#667085;">No entries</td></tr>';
  el.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi-card"><div class="kpi-label">Total Units</div><div class="kpi-value">${totalU}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Weight</div><div class="kpi-value">${totalW.toFixed(1)} kg</div></div>
      <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${logs.length}</div></div>
    </div>
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Date</th><th>Team</th><th>Product</th><th class="num">Qty</th><th class="num">Weight</th><th>Time</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ── Edit / delete a logged entry ──
async function refreshAfterEntryChange(date) {
  if (date < TODAY) { try { await closeDays(supabase, [date]); } catch (e) { console.warn(e.message); } }
  if (currentPage === 'log') { await renderLog(logDays); }
  else if (currentPage === 'production') {
    const d = SEL;
    await loadLogsForDate(d); updateKPIs(); renderTodayLog();
  }
}

window.editEntry = async (id) => {
  const { data: e, error } = await supabase.from('production_log').select('*').eq('id', id).single();
  if (error || !e) { toast('Could not load entry', 'error'); return; }
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  const opts = products.map(p => `<option value="${p.id}" ${String(p.id) === String(e.product_id) ? 'selected' : ''}>${p.name}</option>`).join('');
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:18px;width:100%;max-width:380px;">
      <div style="font-weight:700;font-size:16px;margin-bottom:4px;">Edit entry</div>
      <div style="font-size:12px;color:#667085;margin-bottom:14px;">${e.production_date} · ${e.production_time || ''}</div>
      <div class="field"><label>Product</label><select id="ee-prod">${opts}</select></div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0;"><label>Quantity (pcs)</label><input type="number" id="ee-qty" inputmode="numeric" value="${e.quantity}" min="1" /></div>
        <div class="field" style="margin-bottom:0;"><label>Weight (kg)</label><input type="number" id="ee-wt" inputmode="decimal" step="0.1" value="${e.weight}" /></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button id="ee-cancel" style="flex:1;border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:12px;font-size:14px;cursor:pointer;">Cancel</button>
        <button id="ee-save" class="btn-primary" style="flex:1;">Save</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#ee-cancel').onclick = () => ov.remove();
  ov.addEventListener('click', ev => { if (ev.target === ov) ov.remove(); });
  ov.querySelector('#ee-save').onclick = async () => {
    const qty = parseFloat(ov.querySelector('#ee-qty').value);
    const wt = parseFloat(ov.querySelector('#ee-wt').value);
    if (!qty || qty <= 0) { toast('Enter quantity', 'error'); return; }
    if (!wt || wt <= 0) { toast('Enter weight', 'error'); return; }
    const btn = ov.querySelector('#ee-save'); btn.disabled = true; btn.textContent = 'Saving…';
    const { data: upd, error: err0 } = await supabase.from('production_log')
      .update({ product_id: ov.querySelector('#ee-prod').value, quantity: qty, weight: wt }).eq('id', id).select();
    const err = err0 || ((upd || []).length ? null : { message: 'not allowed yet — run production_edit.sql in Supabase' });
    if (err) { toast('Save failed: ' + err.message, 'error'); btn.disabled = false; btn.textContent = 'Save'; return; }
    ov.remove();
    await refreshAfterEntryChange(e.production_date);
    toast('Entry updated ✓');
  };
};

window.deleteEntry = async (id) => {
  const { data: e } = await supabase.from('production_log').select('production_date').eq('id', id).single();
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  const { data: del, error: err0 } = await supabase.from('production_log').delete().eq('id', id).select();
  const error = err0 || ((del || []).length ? null : { message: 'not allowed yet — run production_edit.sql in Supabase' });
  if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
  await refreshAfterEntryChange(e?.production_date || TODAY);
  toast('Entry deleted');
};

// ── Inventory ──
async function renderInventory() {
  const el = document.getElementById('inv-content');
  el.innerHTML = '<div class="state-msg">Loading…</div>';
  const TODAY_STR = TODAY;
  const monthStart = TODAY_STR.slice(0, 7) + '-01';
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().slice(0, 10);

  const [lr, pr, tr, wr, rosterRows, summaries] = await Promise.all([
    supabase.from('production_log').select('*').order('production_date').limit(50000),
    supabase.from('products').select('*'),
    supabase.from('teams').select('*'),
    supabase.from('workers').select('name, daily_rate'),
    fetchRosterRows(supabase),
    fetchSummaries(supabase),
  ]);
  const logs = lr.data || [], prods = pr.data || [], allTeams = tr.data || [];
  const teamDays = buildTeamDays(logs, allTeams, wr.data || [], rosterRows, summaries);
  const overall = sumDays(teamDays);
  const prodMap = Object.fromEntries(prods.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t]));

  // Overall KPIs
  const totalAll = logs.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalToday = logs.filter(l => l.production_date === SEL).reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalMonth = logs.filter(l => l.production_date >= monthStart).reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalWeight = logs.reduce((s, l) => s + Number(l.weight || 0), 0);

  // By product
  const byProd = {};
  logs.forEach(l => {
    const p = prodMap[l.product_id];
    const n = p?.name || 'Unknown';
    if (!byProd[n]) byProd[n] = { qty: 0, month: 0, today: 0, wt: 0, price: Number(p?.selling_price || 0) };
    byProd[n].qty += Number(l.quantity || 0);
    byProd[n].wt += Number(l.weight || 0);
    if (l.production_date >= monthStart) byProd[n].month += Number(l.quantity || 0);
    if (l.production_date === SEL) byProd[n].today += Number(l.quantity || 0);
  });

  // By team — cost per kg for the SELECTED DAY only (wage of that day's team ÷ that day's weight)
  const byTeam = {};
  teamDays.filter(r => r.date === SEL).forEach(td => {
    byTeam[td.team] = { qty: td.units, wt: td.weight, wage: td.wage, value: 0 };
  });
  logs.filter(l => l.production_date === SEL).forEach(l => {
    const t = teamMap[l.team_id];
    const tName = t?.name || 'Team ' + (t?.team_number || '—');
    if (byTeam[tName]) byTeam[tName].value += Number(l.quantity || 0) * Number(prodMap[l.product_id]?.selling_price || 0);
  });

  // Product chart data
  const prodLabels = Object.keys(byProd).slice(0, 10);
  const prodData = prodLabels.map(n => byProd[n].qty);

  // Team cost/kg chart data
  const teamLabels = Object.keys(byTeam);
  const cpkgData = teamLabels.map(t => byTeam[t].wt > 0 ? +(byTeam[t].wage / byTeam[t].wt).toFixed(2) : 0);

  // Product table rows
  const prodRows = Object.entries(byProd).sort((a, b) => b[1].qty - a[1].qty)
    .map(([n, v]) => `<tr>
      <td class="bold">${n}</td>
      <td class="num">${v.today}</td>
      <td class="num">${v.month}</td>
      <td class="num">${v.qty}</td>
      <td class="num">${v.wt.toFixed(1)}</td>
      <td class="num">${v.price > 0 ? '₹' + (v.qty * v.price).toLocaleString('en-IN') : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#667085;">No data</td></tr>';

  // Team cost cards
  const teamCards = Object.entries(byTeam).map(([name, v]) => {
    const cpkg = v.wt > 0 ? (v.wage / v.wt).toFixed(2) : 0;
    return `<div class="team-cost-card">
      <h4>${name}</h4>
      <div class="tcstat"><span class="l">Units Produced</span><span class="v">${v.qty}</span></div>
      <div class="tcstat"><span class="l">Total Weight</span><span class="v">${v.wt.toFixed(1)} kg</span></div>
      <div class="tcstat"><span class="l">Total Value</span><span class="v">₹${v.value.toLocaleString('en-IN')}</span></div>
      <div class="tcstat"><span class="l">Total Wage (${OVERTIME_MULTIPLIER}x)</span><span class="v">₹${Math.round(v.wage).toLocaleString('en-IN')}</span></div>
      <div class="tcstat"><span class="l">Cost per kg</span><span class="v cpkg">${cpkg > 0 ? '₹' + Number(cpkg).toLocaleString('en-IN') : '—'}</span></div>
    </div>`;
  }).join('') || '<div class="state-msg">No team produced anything on this date</div>';

  el.innerHTML = `
    <div class="inv-hero">
      <h2>📦 Inventory Overview</h2>
      <p>All production logged — data persists permanently</p>
      <div class="inv-hero-kpis">
        <div class="inv-hero-kpi"><div class="val">${totalToday}</div><div class="lbl">${fmtD(SEL)}</div></div>
        <div class="inv-hero-kpi"><div class="val">${totalMonth}</div><div class="lbl">This Month</div></div>
        <div class="inv-hero-kpi"><div class="val">${totalAll}</div><div class="lbl">All Time</div></div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card" style="--ac:#1967D2"><div class="kpi-label">Total Units</div><div class="kpi-value">${totalAll}</div><div class="kpi-sub">all time</div></div>
      <div class="kpi-card" style="--ac:#16a34a"><div class="kpi-label">Total Weight</div><div class="kpi-value">${totalWeight.toFixed(0)} kg</div><div class="kpi-sub">all time</div></div>
      <div class="kpi-card" style="--ac:#d97706"><div class="kpi-label">Products</div><div class="kpi-value">${Object.keys(byProd).length}</div><div class="kpi-sub">types made</div></div>
      <div class="kpi-card" style="--ac:#7c3aed"><div class="kpi-label">Teams</div><div class="kpi-value">${allTeams.length}</div><div class="kpi-sub">active teams</div></div>
      <div class="kpi-card" style="--ac:#dc2626"><div class="kpi-label">Cost per kg</div><div class="kpi-value">${overall.cpk > 0 ? '₹' + overall.cpk.toFixed(2) : '—'}</div><div class="kpi-sub">wage ÷ weight, all time</div></div>
    </div>

    <div class="section-head"><div class="section-title">Team Cost per Kg — ${fmtD(SEL)}</div><div class="section-sub">That day's wage ÷ that day's weight · wage = daily rate × ${OVERTIME_MULTIPLIER} (overtime)</div></div>
        <div class="team-cost-grid">${teamCards}</div>

    <div class="section-head"><div class="section-title">Charts</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;" id="chart-grid">
      <div class="chart-card">
        <h3>Production by Product (Top 10)</h3>
        <canvas id="chart-prod"></canvas>
      </div>
      <div class="chart-card">
        <h3>Cost per Kg by Team (₹) — ${SEL === TODAY ? 'today' : SEL}</h3>
        <canvas id="chart-cpkg"></canvas>
      </div>
    </div>

    <div class="chart-card" style="margin-bottom:20px;">
      <h3>Cost per Kg vs Weight Produced (each dot = one team's day)</h3>
      <canvas id="chart-cpk-weight"></canvas>
    </div>

    <div class="section-head"><div><div class="section-title">Monthly Record</div><div class="section-sub">Each day is saved automatically after 12:00 am and added to its month</div></div></div>
    <div id="month-record"><div class="state-msg">Loading…</div></div>

    <div class="section-head"><div class="section-title">Product Breakdown</div></div>
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Product</th><th class="num">${fmtD(SEL)}</th><th class="num">This Month</th><th class="num">All Time</th><th class="num">Weight (kg)</th><th class="num">Total Value</th></tr></thead>
      <tbody>${prodRows}</tbody>
    </table></div>`;

  loadMonthly(supabase).then(r => { const m = document.getElementById('month-record'); if (m) m.innerHTML = monthlyTableHTML(r, 'dt'); }).catch(() => {});

  // Charts
  requestAnimationFrame(() => {
    const colors = ['#1967D2','#16a34a','#d97706','#7c3aed','#dc2626','#0d9488','#db2777','#ea580c','#65a30d','#0284c7'];
    if (prodLabels.length) {
      new Chart(document.getElementById('chart-prod'), {
        type: 'bar',
        data: { labels: prodLabels, datasets: [{ data: prodData, backgroundColor: colors, borderRadius: 6 }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true } }, responsive: true }
      });
    }
    if (teamLabels.length) {
      new Chart(document.getElementById('chart-cpkg'), {
        type: 'bar',
        data: { labels: teamLabels, datasets: [{ data: cpkgData, backgroundColor: '#1967D2', borderRadius: 6 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + v } } }, responsive: true }
      });
    }
    if (teamDays.length) new Chart(document.getElementById('chart-cpk-weight'), costVsWeightChart(teamDays));
    // Make charts stack on mobile
    if (window.innerWidth < 600) {
      document.getElementById('chart-grid').style.gridTemplateColumns = '1fr';
    }
  });
}

// ── Init ──
async function rerender() {
  await loadLogsForDate(SEL);
  if (currentPage === 'log') await renderLog(logDays);
  else showPage(currentPage);
}
function wireGlobalDate() {
  const inp = document.getElementById('global-date');
  const btn = document.getElementById('date-today');
  inp.value = SEL; inp.max = TODAY;
  const sync = () => { inp.value = SEL; btn.style.display = SEL === TODAY ? 'none' : ''; document.getElementById('date-note').textContent = SEL === TODAY ? 'Showing today' : 'Showing ' + fmtD(SEL); };
  inp.addEventListener('change', () => { if (!inp.value) return; SEL = inp.value > TODAY ? TODAY : inp.value; try { sessionStorage.setItem('ml_date', SEL); } catch {} sync(); rerender(); });
  btn.addEventListener('click', () => { SEL = TODAY; try { sessionStorage.removeItem('ml_date'); } catch {} sync(); rerender(); });
  sync();
}
async function init() {
  try { const d = sessionStorage.getItem('ml_date'); if (d && d <= TODAY) SEL = d; } catch {}
  await requireLogin();
  wireGlobalDate();
  startAutoClose(supabase);
  await loadData();
  showPage('dashboard');
}
init();
