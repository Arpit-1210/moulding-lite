import { fetchActiveSupervisors } from '../../services/supervisors.js';
import { fetchTeamsForSupervisor } from '../../services/teams.js';
import { fetchActiveProducts } from '../../services/products.js';
import { insertProduction } from '../../services/production.js';
import { validatePositiveNumber } from '../../utils/validate.js';
import { createProductCombobox } from '../../components/productCombobox.js';
import { formatRupees } from '../../components/kpiRow.js';
import { lineValue, lineRmCost } from '../../services/calculations.js';

export async function render(container) {
  container.innerHTML = `
    <div class="panel" style="max-width: 640px">
      <div class="panel-head"><h2>Log production</h2></div>

      <div class="form-grid" style="margin-bottom: var(--space-4)">
        <div class="field">
          <label for="lp-supervisor">Supervisor</label>
          <select id="lp-supervisor"><option value="">Loading…</option></select>
        </div>
        <div class="field">
          <label for="lp-team">Team</label>
          <select id="lp-team"><option value="">Select supervisor first</option></select>
        </div>
      </div>

      <div class="field">
        <label>Product</label>
        <div id="lp-product-combobox"></div>
      </div>

      <div class="form-grid" style="margin-bottom: var(--space-4)">
        <div class="field">
          <label for="lp-qty">Quantity</label>
          <input type="number" id="lp-qty" min="0" step="1" placeholder="0" />
          <span class="hint error-text" id="lp-qty-error" hidden></span>
        </div>
        <div class="field">
          <label for="lp-weight">Weight (kg)</label>
          <input type="number" id="lp-weight" min="0" step="0.1" placeholder="0" />
          <span class="hint error-text" id="lp-weight-error" hidden></span>
        </div>
      </div>

      <div class="notice-banner" id="lp-preview" style="background: var(--primary-soft); border-color: #bfdbfe; color: var(--primary-dim); display:none;"></div>

      <button class="btn btn-primary" id="lp-save" style="width: auto; padding-left: var(--space-6); padding-right: var(--space-6)">
        Save production
      </button>
    </div>
  `;

  const supervisorSelect = container.querySelector('#lp-supervisor');
  const teamSelect = container.querySelector('#lp-team');
  const qtyInput = container.querySelector('#lp-qty');
  const weightInput = container.querySelector('#lp-weight');
  const qtyError = container.querySelector('#lp-qty-error');
  const weightError = container.querySelector('#lp-weight-error');
  const previewEl = container.querySelector('#lp-preview');
  const saveBtn = container.querySelector('#lp-save');

  let products = [];
  let saving = false;

  const combobox = createProductCombobox([], {
    onSelect: updatePreview,
    placeholder: 'Search products…',
  });
  container.querySelector('#lp-product-combobox').appendChild(combobox.element);

  function updatePreview() {
    const product = combobox.getSelectedProduct();
    const qty = Number(qtyInput.value) || 0;
    if (!product || qty <= 0) {
      previewEl.style.display = 'none';
      return;
    }
    const value = lineValue(qty, product.selling_price);
    const rmCost = lineRmCost(qty, product.rm_cost);
    previewEl.style.display = 'block';
    previewEl.textContent = `Estimated value ${formatRupees(value)} · RM cost ${formatRupees(rmCost)}`;
  }

  qtyInput.addEventListener('input', updatePreview);

  async function loadSupervisors() {
    try {
      const supervisors = await fetchActiveSupervisors();
      if (supervisors.length === 0) {
        supervisorSelect.innerHTML = '<option value="">No active supervisors</option>';
        return;
      }
      supervisorSelect.innerHTML =
        '<option value="">Select supervisor</option>' +
        supervisors.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    } catch (err) {
      console.error(err);
      supervisorSelect.innerHTML = '<option value="">Could not load</option>';
    }
  }

  async function loadTeams(supervisorId) {
    if (!supervisorId) {
      teamSelect.innerHTML = '<option value="">Select supervisor first</option>';
      return;
    }
    teamSelect.innerHTML = '<option value="">Loading…</option>';
    try {
      const teams = await fetchTeamsForSupervisor(supervisorId);
      if (teams.length === 0) {
        teamSelect.innerHTML = '<option value="">No teams for this supervisor</option>';
        return;
      }
      teamSelect.innerHTML = teams
        .map((t) => `<option value="${t.id}">Team ${t.team_number}</option>`)
        .join('');
    } catch (err) {
      console.error(err);
      teamSelect.innerHTML = '<option value="">Could not load teams</option>';
    }
  }

  async function loadProducts() {
    try {
      products = await fetchActiveProducts();
      combobox.setProducts(products);
    } catch (err) {
      console.error(err);
    }
  }

  supervisorSelect.addEventListener('change', () => loadTeams(supervisorSelect.value));

  saveBtn.addEventListener('click', async () => {
    if (saving) return;
    qtyError.hidden = true;
    weightError.hidden = true;

    const teamId = teamSelect.value;
    const product = combobox.getSelectedProduct();
    const qtyRaw = qtyInput.value;
    const weightRaw = weightInput.value;

    if (!supervisorSelect.value) return alert('Select a supervisor first.');
    if (!teamId) return alert('Select a team first.');
    if (!product) return alert('Select a product first.');

    const qtyMsg = validatePositiveNumber(qtyRaw, 'Quantity');
    if (qtyMsg) {
      qtyError.textContent = qtyMsg;
      qtyError.hidden = false;
      return;
    }
    const weightMsg = validatePositiveNumber(weightRaw, 'Weight');
    if (weightMsg) {
      weightError.textContent = weightMsg;
      weightError.hidden = false;
      return;
    }

    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      await insertProduction({
        teamId,
        productId: product.id,
        quantity: Number(qtyRaw),
        weight: Number(weightRaw),
      });
      qtyInput.value = '';
      weightInput.value = '';
      previewEl.style.display = 'none';
      saveBtn.textContent = '✓ Saved — log another';
      setTimeout(() => {
        saveBtn.textContent = 'Save production';
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Production could not be saved. Please try again.');
    } finally {
      saving = false;
      saveBtn.disabled = false;
    }
  });

  await Promise.all([loadSupervisors(), loadProducts()]);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
