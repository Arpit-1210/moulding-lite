import { fetchAnalytics, subscribeToProductionChanges } from '../../services/analytics.js';
import { renderKpiRow, formatRupees, formatNumber } from '../../components/kpiRow.js';
import { initRangeFilter } from '../../components/rangeFilter.js';
import { flashLivePill } from '../../components/livePill.js';

export async function render(container) {
  container.innerHTML = `
    <div id="range-filter"></div>
    <div id="kpi-root"></div>

    <div class="panel-grid">
      <div class="panel">
        <div class="panel-head"><h2>By product</h2></div>
        <div id="by-product-root"><p class="state-msg">Loading…</p></div>
        <p class="hint" style="margin-top: var(--space-3)">Profit here is before wage cost — wage is a team/day cost, not a per-product one.</p>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>By team</h2></div>
        <div id="by-team-root"><p class="state-msg">Loading…</p></div>
      </div>
    </div>
  `;

  const kpiRoot = container.querySelector('#kpi-root');
  const byProductRoot = container.querySelector('#by-product-root');
  const byTeamRoot = container.querySelector('#by-team-root');

  let currentRange = null;
  let isFirstLoad = true;

  function renderProductTable(byProduct) {
    if (byProduct.length === 0) {
      byProductRoot.innerHTML = '<p class="state-msg">No production in this range.</p>';
      return;
    }
    byProductRoot.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Product</th><th class="num">Units</th><th class="num">Value</th><th class="num">RM cost</th><th class="num">Profit*</th></tr></thead>
        <tbody>
          ${byProduct
            .map(
              (p) => `
            <tr>
              <td>${escapeHtml(p.name)}</td>
              <td class="num">${formatNumber(p.units)}</td>
              <td class="num">${formatRupees(p.value)}</td>
              <td class="num">${formatRupees(p.rmCost)}</td>
              <td class="num">${formatRupees(p.profit)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  function renderTeamTable(byTeam) {
    if (byTeam.length === 0) {
      byTeamRoot.innerHTML = '<p class="state-msg">No production in this range.</p>';
      return;
    }
    byTeamRoot.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Team</th><th>Supervisor</th><th class="num">Value</th><th class="num">Wage</th><th class="num">Profit</th></tr></thead>
        <tbody>
          ${byTeam
            .map(
              (t) => `
            <tr>
              <td>${escapeHtml(t.label)}</td>
              <td>${escapeHtml(t.supervisorName)}</td>
              <td class="num">${formatRupees(t.value)}</td>
              <td class="num">${formatRupees(t.wageCost)}</td>
              <td class="num">${formatRupees(t.profit)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  async function load() {
    if (!currentRange) return;
    try {
      const { summary, byProduct, byTeam } = await fetchAnalytics(currentRange);

      kpiRoot.innerHTML = renderKpiRow([
        { label: 'Production value', value: formatRupees(summary.value), color: 'green' },
        { label: 'RM cost', value: formatRupees(summary.rmCost), color: 'orange' },
        { label: 'Wage cost', value: formatRupees(summary.wageCost), color: 'purple' },
        {
          label: 'Profit',
          value: formatRupees(summary.profit),
          color: summary.profit >= 0 ? 'green' : 'red',
        },
        { label: 'Margin', value: `${formatNumber(summary.margin)}%`, color: 'blue' },
      ]);

      renderProductTable(byProduct);
      renderTeamTable(byTeam);

      if (!isFirstLoad) flashLivePill('Updated just now');
      isFirstLoad = false;
    } catch (err) {
      console.error(err);
      kpiRoot.innerHTML = '<p class="error-text">Could not load profit &amp; loss data.</p>';
    }
  }

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
