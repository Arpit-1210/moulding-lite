import { fetchAnalytics } from '../../services/analytics.js';
import { fetchProductionRows } from '../../services/analytics.js';
import { renderKpiRow, formatRupees, formatNumber } from '../../components/kpiRow.js';
import { initRangeFilter } from '../../components/rangeFilter.js';
import { flashLivePill } from '../../components/livePill.js';
import { supabase } from '../../services/supabaseClient.js';

export async function render(container) {
  container.innerHTML = `
    <div id="range-filter"></div>
    <div id="kpi-root"></div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head">
        <h2>Day-wise Production</h2>
      </div>
      <div id="daywise-root"><p class="state-msg">Loading…</p></div>
    </div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Recent entries</h2></div>
      <div id="recent-root"><p class="state-msg">Loading…</p></div>
    </div>
  `;

  const kpiRoot      = container.querySelector('#kpi-root');
  const daywiseRoot  = container.querySelector('#daywise-root');
  const recentRoot   = container.querySelector('#recent-root');
  let currentRange   = null;
  let isFirstLoad    = true;

  async function load() {
    if (!currentRange) return;
    try {
      const { summary, rows } = await fetchAnalytics(currentRange);

      // KPI cards — no profit, no margin, no wage cost shown
      kpiRoot.innerHTML = renderKpiRow([
        { label: 'Units produced',    value: formatNumber(summary.units),          color: 'blue'   },
        { label: 'Total weight',      value: `${formatNumber(summary.weight)} kg`, color: 'slate'  },
        { label: 'Production value',  value: formatRupees(summary.value),          color: 'green'  },
      ]);

      renderDaywise(rows);
      renderRecent(rows.slice(0, 10));

      if (!isFirstLoad) flashLivePill('Updated just now');
      isFirstLoad = false;
    } catch (err) {
      console.error(err);
      kpiRoot.innerHTML = '<p class="error-text">Could not load dashboard data.</p>';
    }
  }

  // Group rows by production_date, show units + value per day
  function renderDaywise(rows) {
    if (rows.length === 0) {
      daywiseRoot.innerHTML = '<p class="state-msg">No production logged in this range yet.</p>';
      return;
    }

    // Build day map
    const dayMap = new Map();
    for (const row of rows) {
      const d = row.production_date; // 'YYYY-MM-DD'
      if (!dayMap.has(d)) dayMap.set(d, { units: 0, weight: 0, value: 0 });
      const e = dayMap.get(d);
      const qty = Number(row.quantity) || 0;
      e.units  += qty;
      e.weight += Number(row.weight) || 0;
      e.value  += qty * Number(row.products?.selling_price || 0);
    }

    // Sort newest first
    const sorted = Array.from(dayMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    // Find max value for bar width
    const maxValue = Math.max(...sorted.map(([, e]) => e.value), 1);

    daywiseRoot.innerHTML = `
      <div class="daywise-table">
        ${sorted.map(([date, e]) => {
          const pct = Math.round((e.value / maxValue) * 100);
          const label = formatDate(date);
          return `
            <div class="day-row">
              <div class="day-meta">
                <span class="day-label">${label}</span>
                <span class="day-stats">
                  <strong>${formatNumber(e.units)}</strong> units
                  &nbsp;·&nbsp;
                  <strong>${formatNumber(e.weight)} kg</strong>
                  &nbsp;·&nbsp;
                  <strong class="day-value">${formatRupees(e.value)}</strong>
                </span>
              </div>
              <div class="day-bar-wrap">
                <div class="day-bar" style="width:${pct}%"></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function renderRecent(rows) {
    if (rows.length === 0) {
      recentRoot.innerHTML = '<p class="state-msg">No production logged in this range yet.</p>';
      return;
    }
    recentRoot.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Team</th>
            <th>Product</th>
            <th class="num">Qty</th>
            <th class="num">Weight</th>
            <th class="num">Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const qty   = Number(r.quantity) || 0;
            const val   = qty * Number(r.products?.selling_price || 0);
            return `
              <tr>
                <td>${formatDate(r.production_date)}</td>
                <td>Team ${r.teams?.team_number ?? '—'}</td>
                <td>${r.products?.name ?? '—'}</td>
                <td class="num">${formatNumber(qty)}</td>
                <td class="num">${formatNumber(r.weight)} kg</td>
                <td class="num">${formatRupees(val)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
  }

  initRangeFilter(container.querySelector('#range-filter'), {
    initial: 'today',
    onChange: (range) => { currentRange = range; load(); },
  });

  // Realtime
  const channel = supabase
    .channel('owner_dashboard_' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_log' }, () => load())
    .subscribe();

  return () => supabase.removeChannel(channel);
}
