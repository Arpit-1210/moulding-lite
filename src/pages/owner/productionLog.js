import { fetchAnalytics, subscribeToProductionChanges } from '../../services/analytics.js';
import { initRangeFilter } from '../../components/rangeFilter.js';
import { formatRupees, formatNumber } from '../../components/kpiRow.js';
import { flashLivePill } from '../../components/livePill.js';
import { lineValue, lineRmCost, marginPct } from '../../services/calculations.js';
import { formatFactoryClock } from '../../utils/date.js';

export async function render(container) {
  container.innerHTML = `
    <div id="range-filter"></div>
    <div class="panel">
      <div class="panel-head">
        <h2>Production log</h2>
        <div class="form-grid" style="min-width: 360px">
          <select id="pl-team-filter"><option value="">All teams</option></select>
          <select id="pl-product-filter"><option value="">All products</option></select>
        </div>
      </div>
      <div id="pl-table-root"><p class="state-msg">Loading…</p></div>
    </div>
  `;

  const tableRoot = container.querySelector('#pl-table-root');
  const teamFilter = container.querySelector('#pl-team-filter');
  const productFilter = container.querySelector('#pl-product-filter');

  let currentRange = null;
  let allRows = [];
  let isFirstLoad = true;

  function populateFilters(rows) {
    const teams = new Map();
    const productNames = new Set();
    for (const r of rows) {
      if (r.teams) teams.set(r.teams.id, `Team ${r.teams.team_number}`);
      if (r.products) productNames.add(r.products.name);
    }
    const teamSelected = teamFilter.value;
    teamFilter.innerHTML =
      '<option value="">All teams</option>' +
      Array.from(teams.entries())
        .map(([id, label]) => `<option value="${id}"${id === teamSelected ? ' selected' : ''}>${label}</option>`)
        .join('');

    const productSelected = productFilter.value;
    productFilter.innerHTML =
      '<option value="">All products</option>' +
      Array.from(productNames)
        .sort()
        .map((name) => `<option value="${escapeHtml(name)}"${name === productSelected ? ' selected' : ''}>${escapeHtml(name)}</option>`)
        .join('');
  }

  function applyFiltersAndRender() {
    const teamId = teamFilter.value;
    const productName = productFilter.value;
    const filtered = allRows.filter((r) => {
      if (teamId && r.teams?.id !== teamId) return false;
      if (productName && r.products?.name !== productName) return false;
      return true;
    });
    renderTable(filtered);
  }

  function renderTable(rows) {
    if (rows.length === 0) {
      tableRoot.innerHTML = '<p class="state-msg">No production entries match this filter.</p>';
      return;
    }
    tableRoot.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th><th>Time</th><th>Supervisor</th><th>Team</th><th>Product</th>
            <th class="num">Qty</th><th class="num">Weight</th><th class="num">Value</th>
            <th class="num">RM cost</th><th class="num">Profit*</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const qty = Number(r.quantity) || 0;
              const value = lineValue(qty, r.products?.selling_price);
              const rmCost = lineRmCost(qty, r.products?.rm_cost);
              const profit = value - rmCost;
              return `
              <tr>
                <td>${r.production_date}</td>
                <td>${formatFactoryClock(r.created_at)}</td>
                <td>${r.teams?.supervisors?.name ?? '—'}</td>
                <td>Team ${r.teams?.team_number ?? '—'}</td>
                <td>${r.products?.name ?? '—'}</td>
                <td class="num">${formatNumber(qty)}</td>
                <td class="num">${formatNumber(r.weight)} kg</td>
                <td class="num">${formatRupees(value)}</td>
                <td class="num">${formatRupees(rmCost)}</td>
                <td class="num">${formatRupees(profit)}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <p class="hint" style="margin-top: var(--space-3)">* Before wage cost — see Profit &amp; Loss for the full picture including team wages.</p>
    `;
  }

  async function load() {
    if (!currentRange) return;
    try {
      const { rows } = await fetchAnalytics(currentRange);
      allRows = rows;
      populateFilters(rows);
      applyFiltersAndRender();
      if (!isFirstLoad) flashLivePill('Updated just now');
      isFirstLoad = false;
    } catch (err) {
      console.error(err);
      tableRoot.innerHTML = '<p class="error-text">Could not load the production log.</p>';
    }
  }

  teamFilter.addEventListener('change', applyFiltersAndRender);
  productFilter.addEventListener('change', applyFiltersAndRender);

  initRangeFilter(container.querySelector('#range-filter'), {
    initial: 'week',
    onChange: (range) => {
      currentRange = range;
      load();
    },
  });

  const unsubscribe = subscribeToProductionChanges(load);
  return unsubscribe;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
