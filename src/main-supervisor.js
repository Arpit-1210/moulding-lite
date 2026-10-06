// v2.1 - date picker added
import './styles/base.css';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

// ── State ──
let currentTeamId = null;
let teams = [], products = [], workers = [], todayLogs = [];
let currentPage = 'dashboard';
const TODAY = new Date().toISOString().slice(0, 10);

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
  await loadLogsForDate(TODAY);
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
  const [lr, pr, tr] = await Promise.all([
    supabase.from('production_log').select('*').eq('production_date', TODAY),
    supabase.from('products').select('*'),
    supabase.from('teams').select('*'),
  ]);
  const logs = lr.data || [], prods = pr.data || [], allTeams = tr.data || [];
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
    return `<div class="team-card" style="border-left-color:${active ? '#16a34a' : '#e4e7ec'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3>${t.name || 'Team ' + t.team_number}</h3>
        <span class="badge ${active ? 'badge-green' : ''}" style="${!active ? 'background:#f8f9fb;color:#98a2b3;' : ''}">${active ? '● Active' : 'Idle'}</span>
      </div>
      <div class="tstat"><span class="l">Units</span><span class="v" style="color:#1967D2">${tUnits}</span></div>
      <div class="tstat"><span class="l">Weight</span><span class="v">${tWt.toFixed(1)} kg</span></div>
      <div class="tstat"><span class="l">Entries</span><span class="v">${tLogs.length}</span></div>
    </div>`;
  }).join('') || '<div class="state-msg">No teams yet</div>';

  const prodRows = Object.entries(byProd).sort((a, b) => b[1].qty - a[1].qty)
    .map(([n, v]) => `<tr><td class="bold">${n}</td><td class="num">${v.qty}</td><td class="num">${v.wt.toFixed(1)} kg</td></tr>`)
    .join('') || '<tr><td colspan="3" style="text-align:center;color:#667085;padding:20px;">No production today</td></tr>';

  el.innerHTML = `
    <div class="hero-banner">
      <div>
        <div class="hero-title">Good ${new Date().getHours() < 12 ? 'Morning' : 'Afternoon'} 👋</div>
        <div class="hero-sub">Moulding · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</div>
      </div>
      <button class="hero-action" onclick="showPage('production')">Log Production →</button>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card" style="--ac:#1967D2"><div class="kpi-icon">🏭</div><div class="kpi-label">Units Today</div><div class="kpi-value">${totalUnits}</div><div class="kpi-sub">${logs.length} entries</div></div>
      <div class="kpi-card" style="--ac:#16a34a"><div class="kpi-icon">⚖️</div><div class="kpi-label">Weight (kg)</div><div class="kpi-value">${totalWeight.toFixed(1)}</div><div class="kpi-sub">produced today</div></div>
      <div class="kpi-card" style="--ac:#d97706"><div class="kpi-icon">👷</div><div class="kpi-label">Active Teams</div><div class="kpi-value">${activeTeams}</div><div class="kpi-sub">of ${allTeams.length} total</div></div>
      <div class="kpi-card" style="--ac:#7c3aed"><div class="kpi-icon">📦</div><div class="kpi-label">Products</div><div class="kpi-value">${Object.keys(byProd).length}</div><div class="kpi-sub">made today</div></div>
    </div>
    <div class="section-head"><div><div class="section-title">Teams — Today</div></div></div>
    <div class="team-grid">${teamCards}</div>
    <div class="section-head"><div class="section-title">Today by Product</div></div>
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Product</th><th class="num">Units</th><th class="num">Weight</th></tr></thead>
      <tbody>${prodRows}</tbody>
    </table></div>`;

  supabase.channel(`dash-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_log', filter: `production_date=eq.${TODAY}` },
      () => renderDashboard())
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
      <div class="field">
        <label>📅 Production Date</label>
        <input type="date" id="prod-date" value="${TODAY}" max="${TODAY}" style="font-size:15px;padding:10px 12px;" />
      </div>
      <div class="team-tabs" id="team-tabs"></div>
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
    })
  );

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
    const btn = document.getElementById('btn-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    const now = new Date();
    const selectedDate = document.getElementById('prod-date')?.value || TODAY;
    const { data, error } = await supabase.from('production_log').insert([{
      team_id: currentTeamId, product_id: productId, quantity: qty, weight: wt,
      production_date: selectedDate, production_time: now.toTimeString().slice(0, 5),
    }]).select().single();
    btn.disabled = false; btn.textContent = 'Save Entry';
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    todayLogs.unshift(data);
    document.getElementById('prod-qty').value = '';
    document.getElementById('prod-wt').value = '';
    sel.value = '';
    document.getElementById('prod-search').value = '';
    fillProducts();
    // Reload log for selected date
    await loadLogsForDate(document.getElementById('prod-date')?.value || TODAY);
    updateKPIs();
    renderTodayLog();
    toast('Saved ✓');
  });

  // When date changes, reload log
  document.getElementById('prod-date').addEventListener('change', async (e) => {
    const d = e.target.value;
    const title = document.getElementById('log-date-title');
    if (title) title.textContent = d === TODAY ? "Today's Log" : `Log for ${d}`;
    await loadLogsForDate(d);
    updateKPIs();
    renderTodayLog();
  });
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
      <div style="text-align:right;">
        <div class="log-prod-qty">${l.quantity}</div>
        <div class="log-prod-wt">${l.weight} kg</div>
      </div>
    </div>`).join('');
}

// ── Teams ──
async function renderTeams() {
  const el = document.getElementById('teams-content');
  el.innerHTML = '<div class="state-msg">Loading…</div>';
  const { data } = await supabase.from('teams').select('*').order('team_number');
  teams = data || [];

  async function addTeam() {
    const next = teams.length + 1;
    const { data: t } = await supabase.from('teams').insert([{
      team_number: next, name: `Team ${next}`, members: [],
      supervisor_id: '00000000-0000-0000-0000-000000000000'
    }]).select().single();
    if (t) { teams.push(t); renderCards(); toast('Team added'); }
    else {
      // Try without supervisor_id if column is required
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
    if (!name.trim()) return;
    const t = teams.find(x => x.id === id); if (!t) return;
    if ((t.members || []).includes(name.trim())) { toast('Already in team', 'error'); return; }
    t.members = [...(t.members || []), name.trim()];
    await supabase.from('teams').update({ members: t.members }).eq('id', id);
    renderCards(); toast(`${name.trim()} added`);
  }

  async function removeMember(id, name) {
    const t = teams.find(x => x.id === id); if (!t) return;
    t.members = (t.members || []).filter(m => m !== name);
    await supabase.from('teams').update({ members: t.members }).eq('id', id);
    renderCards();
  }

  function renderCards() {
    el.innerHTML = teams.map(t => `
      <div class="team-setup-card">
        <div class="team-head">
          <span class="team-badge">👷 ${t.name || 'Team ' + t.team_number}</span>
          <span style="font-size:12px;color:#667085;">${(t.members || []).length} members</span>
        </div>
        <div class="rename-row">
          <input type="text" id="rename-${t.id}" value="${t.name || 'Team ' + t.team_number}" placeholder="Team name" />
          <button class="btn-rename" onclick="renameTeam('${t.id}',document.getElementById('rename-${t.id}').value)">Rename</button>
        </div>
        <div class="member-chips">
          ${(t.members || []).map(m => `
            <span class="chip">${m}<span class="chip-remove" onclick="removeMember('${t.id}','${m.replace(/'/g, "\\'")}')">×</span></span>
          `).join('') || '<span style="font-size:12px;color:#98a2b3;">No members yet</span>'}
        </div>
        <div class="add-member-row">
          <input type="text" id="wsearch-${t.id}" placeholder="Search worker…" oninput="filterW('${t.id}',this.value)" />
          <select id="wsel-${t.id}">
            <option value="">Pick worker…</option>
            ${workers.map(w => `<option value="${w.name}">${w.name} (₹${w.daily_rate || 0}/day)</option>`).join('')}
          </select>
          <button class="btn-add" onclick="addMember('${t.id}',document.getElementById('wsel-${t.id}').value||document.getElementById('wsearch-${t.id}').value)">Add</button>
        </div>
      </div>`).join('') +
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
  const el = document.getElementById('log-content');
  el.innerHTML = '<div class="state-msg">Loading…</div>';
  const from = new Date(); if (days > 0) from.setDate(from.getDate() - days);
  const fromStr = days === 365 ? '2020-01-01' : from.toISOString().slice(0, 10);
  const [lr, pr, tr] = await Promise.all([
    supabase.from('production_log').select('*').gte('production_date', fromStr).lte('production_date', TODAY).order('production_date', { ascending: false }).order('created_at', { ascending: false }),
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
  </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#667085;">No entries</td></tr>';
  el.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi-card"><div class="kpi-label">Total Units</div><div class="kpi-value">${totalU}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Weight</div><div class="kpi-value">${totalW.toFixed(1)} kg</div></div>
      <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${logs.length}</div></div>
    </div>
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Date</th><th>Team</th><th>Product</th><th class="num">Qty</th><th class="num">Weight</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ── Inventory ──
async function renderInventory() {
  const el = document.getElementById('inv-content');
  el.innerHTML = '<div class="state-msg">Loading…</div>';
  const TODAY_STR = new Date().toISOString().slice(0, 10);
  const monthStart = TODAY_STR.slice(0, 7) + '-01';
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().slice(0, 10);

  const [lr, pr, tr] = await Promise.all([
    supabase.from('production_log').select('*').order('production_date'),
    supabase.from('products').select('*'),
    supabase.from('teams').select('*'),
  ]);
  const logs = lr.data || [], prods = pr.data || [], allTeams = tr.data || [];
  const prodMap = Object.fromEntries(prods.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t]));

  // Overall KPIs
  const totalAll = logs.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalToday = logs.filter(l => l.production_date === TODAY_STR).reduce((s, l) => s + Number(l.quantity || 0), 0);
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
    if (l.production_date === TODAY_STR) byProd[n].today += Number(l.quantity || 0);
  });

  // By team — cost per kg
  const byTeam = {};
  logs.forEach(l => {
    const t = teamMap[l.team_id];
    const tName = t?.name || 'Team ' + (t?.team_number || '—');
    const p = prodMap[l.product_id];
    const price = Number(p?.selling_price || 0);
    const qty = Number(l.quantity || 0);
    const wt = Number(l.weight || 0);
    if (!byTeam[tName]) byTeam[tName] = { qty: 0, wt: 0, value: 0 };
    byTeam[tName].qty += qty;
    byTeam[tName].wt += wt;
    byTeam[tName].value += qty * price;
  });

  // Product chart data
  const prodLabels = Object.keys(byProd).slice(0, 10);
  const prodData = prodLabels.map(n => byProd[n].qty);

  // Team cost/kg chart data
  const teamLabels = Object.keys(byTeam);
  const cpkgData = teamLabels.map(t => byTeam[t].wt > 0 ? +(byTeam[t].value / byTeam[t].wt).toFixed(0) : 0);

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
    const cpkg = v.wt > 0 ? (v.value / v.wt).toFixed(0) : 0;
    return `<div class="team-cost-card">
      <h4>${name}</h4>
      <div class="tcstat"><span class="l">Units Produced</span><span class="v">${v.qty}</span></div>
      <div class="tcstat"><span class="l">Total Weight</span><span class="v">${v.wt.toFixed(1)} kg</span></div>
      <div class="tcstat"><span class="l">Total Value</span><span class="v">₹${v.value.toLocaleString('en-IN')}</span></div>
      <div class="tcstat"><span class="l">Cost per kg</span><span class="v cpkg">${cpkg > 0 ? '₹' + Number(cpkg).toLocaleString('en-IN') : '—'}</span></div>
    </div>`;
  }).join('') || '<div class="state-msg">No team data</div>';

  el.innerHTML = `
    <div class="inv-hero">
      <h2>📦 Inventory Overview</h2>
      <p>All production logged — data persists permanently</p>
      <div class="inv-hero-kpis">
        <div class="inv-hero-kpi"><div class="val">${totalToday}</div><div class="lbl">Today</div></div>
        <div class="inv-hero-kpi"><div class="val">${totalMonth}</div><div class="lbl">This Month</div></div>
        <div class="inv-hero-kpi"><div class="val">${totalAll}</div><div class="lbl">All Time</div></div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card" style="--ac:#1967D2"><div class="kpi-label">Total Units</div><div class="kpi-value">${totalAll}</div><div class="kpi-sub">all time</div></div>
      <div class="kpi-card" style="--ac:#16a34a"><div class="kpi-label">Total Weight</div><div class="kpi-value">${totalWeight.toFixed(0)} kg</div><div class="kpi-sub">all time</div></div>
      <div class="kpi-card" style="--ac:#d97706"><div class="kpi-label">Products</div><div class="kpi-value">${Object.keys(byProd).length}</div><div class="kpi-sub">types made</div></div>
      <div class="kpi-card" style="--ac:#7c3aed"><div class="kpi-label">Teams</div><div class="kpi-value">${allTeams.length}</div><div class="kpi-sub">active teams</div></div>
    </div>

    <div class="section-head"><div class="section-title">Team Performance & Cost per Kg</div><div class="section-sub">Value ÷ Weight produced</div></div>
    <div class="team-cost-grid">${teamCards}</div>

    <div class="section-head"><div class="section-title">Charts</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;" id="chart-grid">
      <div class="chart-card">
        <h3>Production by Product (Top 10)</h3>
        <canvas id="chart-prod"></canvas>
      </div>
      <div class="chart-card">
        <h3>Cost per Kg by Team (₹)</h3>
        <canvas id="chart-cpkg"></canvas>
      </div>
    </div>

    <div class="section-head"><div class="section-title">Product Breakdown</div></div>
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Product</th><th class="num">Today</th><th class="num">This Month</th><th class="num">All Time</th><th class="num">Weight (kg)</th><th class="num">Total Value</th></tr></thead>
      <tbody>${prodRows}</tbody>
    </table></div>`;

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
    // Make charts stack on mobile
    if (window.innerWidth < 600) {
      document.getElementById('chart-grid').style.gridTemplateColumns = '1fr';
    }
  });
}

// ── Init ──
async function init() {
  await loadData();
  showPage('dashboard');
}
init();
