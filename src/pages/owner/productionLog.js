import { fetchProductionByRange } from '../../services/production.js';
import { fetchProducts } from '../../services/products.js';
import { fetchTeamsAll } from '../../services/teams.js';

export async function renderProductionLog(root) {
  root.innerHTML = `
    <div class="range-bar">
      <button class="range-btn active" data-days="0">Today</button>
      <button class="range-btn" data-days="7">7 Days</button>
      <button class="range-btn" data-days="30">30 Days</button>
      <button class="range-btn" data-days="90">3 Months</button>
    </div>
    <div id="log-content"><div class="state-msg">Loading…</div></div>
  `;

  let currentDays = 0;

  async function loadLog(days) {
    const logContent = document.getElementById('log-content');
    logContent.innerHTML = '<div class="state-msg">Loading…</div>';

    const from = new Date();
    if (days > 0) from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().slice(0,10);
    const toStr = new Date().toISOString().slice(0,10);

    const [logs, products, teams] = await Promise.all([
      fetchProductionByRange(fromStr, toStr),
      fetchProducts(),
      fetchTeamsAll(),
    ]);

    const prodMap = Object.fromEntries(products.map(p => [p.id, p]));
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

    const totalUnits = logs.reduce((s,l)=>s+Number(l.quantity||0),0);
    const totalWeight = logs.reduce((s,l)=>s+Number(l.weight||0),0);

    const rows = logs.map(l => {
      const prod = prodMap[l.product_id];
      const team = teamMap[l.team_id];
      return `<tr>
        <td>${l.production_date}</td>
        <td>${team?.name||'Team '+(team?.team_number||'—')}</td>
        <td class="bold">${prod?.name||'—'}</td>
        <td class="num">${l.quantity}</td>
        <td class="num">${Number(l.weight).toFixed(1)} kg</td>
        <td style="color:var(--ink-dim);font-size:12px;">${l.production_time||''}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--ink-dim);">No entries in this period</td></tr>';

    logContent.innerHTML = `
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
        <div class="kpi-card"><div class="kpi-label">Total Units</div><div class="kpi-value">${totalUnits}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Weight</div><div class="kpi-value">${totalWeight.toFixed(1)} kg</div></div>
        <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${logs.length}</div></div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Team</th><th>Product</th><th class="num">Qty</th><th class="num">Weight</th><th>Time</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  root.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDays = parseInt(btn.dataset.days);
      loadLog(currentDays);
    });
  });

  loadLog(0);
}
