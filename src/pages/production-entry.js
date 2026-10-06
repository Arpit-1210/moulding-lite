import { fetchTeamsForSupervisor } from '../services/teams.js';
import { fetchProducts } from '../services/products.js';
import { insertProductionLog, fetchTodayLogForSupervisor } from '../services/production.js';
import { getSession, setSelectedTeam } from '../utils/session.js';
import { showToast } from '../components/toast.js';
import { today } from '../utils/date.js';

export function initProductionEntryView({ onManageTeams, onSwitchSupervisor }) {
  let currentSupervisor = null;
  let teams = [];
  let products = [];
  let logs = [];
  let selectedTeamId = null;

  const supNameEl = document.getElementById('prod-supervisor-name');
  const teamTabsEl = document.getElementById('team-tabs');
  const productSelect = document.getElementById('product-select');
  const qtyInput = document.getElementById('quantity-input');
  const weightInput = document.getElementById('weight-input');
  const saveBtn = document.getElementById('btn-save-production');
  const logListEl = document.getElementById('prod-log-list');
  const kpiUnits = document.getElementById('kpi-units');
  const kpiWeight = document.getElementById('kpi-weight');
  const kpiEntries = document.getElementById('kpi-entries');

  document.getElementById('btn-manage-teams').addEventListener('click', () => {
    if (currentSupervisor) onManageTeams(currentSupervisor);
  });
  document.getElementById('btn-switch-supervisor-2').addEventListener('click', onSwitchSupervisor);

  saveBtn.addEventListener('click', async () => {
    const productId = productSelect.value;
    const qty = parseFloat(qtyInput.value);
    const weight = parseFloat(weightInput.value);

    if (!selectedTeamId) { showToast('Select a team first', 'error'); return; }
    if (!productId) { showToast('Select a product', 'error'); return; }
    if (!qty || qty <= 0) { showToast('Enter valid quantity', 'error'); return; }
    if (!weight || weight <= 0) { showToast('Enter valid weight', 'error'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      const now = new Date();
      const entry = await insertProductionLog({
        team_id: selectedTeamId,
        product_id: productId,
        quantity: qty,
        weight: weight,
        production_date: today(),
        production_time: now.toTimeString().slice(0,5),
      });

      if (entry) {
        logs.unshift(entry);
        qtyInput.value = '';
        weightInput.value = '';
        productSelect.value = '';
        renderLog();
        updateKPIs();
        showToast('Production saved ✓', 'success');
      }
    } catch(e) {
      showToast('Save failed. Try again.', 'error');
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Entry';
  });

  function renderTeamTabs() {
    teamTabsEl.innerHTML = teams.map(t => `
      <button class="team-tab ${t.id === selectedTeamId ? 'active' : ''}" data-id="${t.id}">
        Team ${t.team_number}
      </button>
    `).join('');

    teamTabsEl.querySelectorAll('.team-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTeamId = btn.dataset.id;
        setSelectedTeam(selectedTeamId);
        renderTeamTabs();
      });
    });
  }

  function renderProducts() {
    productSelect.innerHTML = '<option value="">Select product…</option>' +
      products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  function renderLog() {
    if (!logs.length) {
      logListEl.innerHTML = '<div class="state-msg">No entries yet today</div>';
      return;
    }
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const prodMap = Object.fromEntries(products.map(p => [p.id, p]));
    logListEl.innerHTML = logs.map(l => {
      const team = teamMap[l.team_id];
      const prod = prodMap[l.product_id];
      return `
        <div class="prod-log-item">
          <div>
            <div class="prod-name">${prod ? prod.name : 'Unknown'}</div>
            <div class="prod-meta">${team ? 'Team '+team.team_number : ''} · ${l.production_time||''}</div>
          </div>
          <div style="text-align:right;">
            <div class="prod-qty">${l.quantity}</div>
            <div class="prod-qty-label">pcs · ${l.weight}kg</div>
          </div>
        </div>`;
    }).join('');
  }

  function updateKPIs() {
    const totalUnits = logs.reduce((s, l) => s + Number(l.quantity||0), 0);
    const totalWeight = logs.reduce((s, l) => s + Number(l.weight||0), 0);
    kpiUnits.textContent = totalUnits;
    kpiWeight.textContent = totalWeight.toFixed(1);
    kpiEntries.textContent = logs.length;
  }

  async function refresh(supervisor) {
    currentSupervisor = supervisor;
    supNameEl.textContent = `Supervisor: ${supervisor.name}`;

    const session = getSession();
    selectedTeamId = session.selectedTeamId || null;

    [teams, products, logs] = await Promise.all([
      fetchTeamsForSupervisor(supervisor.id).catch(() => []),
      fetchProducts().catch(() => []),
      fetchTodayLogForSupervisor(supervisor.id).catch(() => []),
    ]);

    if (!selectedTeamId && teams.length) selectedTeamId = teams[0].id;

    renderTeamTabs();
    renderProducts();
    renderLog();
    updateKPIs();
  }

  return { refresh };
}
