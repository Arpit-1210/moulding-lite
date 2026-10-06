import { fetchTeamsForSupervisor } from '../services/teams.js';
import { fetchActiveProducts } from '../services/products.js';
import { insertProduction } from '../services/production.js';
import { validatePositiveNumber } from '../utils/validate.js';
import { showSuccess, showError } from '../components/toast.js';
import { getSession, setSelectedTeamId } from '../utils/session.js';
import { createProductCombobox } from '../components/productCombobox.js';

/**
 * Screen 3 — Production Entry. The whole app exists to make this screen fast:
 * pick team + product, type two numbers, save, and the form is ready for the
 * next entry without leaving the page.
 */
export function initProductionEntryView({ onManageTeams, onSwitchSupervisor }) {
  const teamSelect = document.getElementById('team-select');
  const comboboxMount = document.getElementById('product-combobox');
  const qtyInput = document.getElementById('quantity-input');
  const weightInput = document.getElementById('weight-input');
  const qtyError = document.getElementById('quantity-error');
  const weightError = document.getElementById('weight-error');
  const saveBtn = document.getElementById('btn-save-production');
  const manageBtn = document.getElementById('btn-manage-teams');
  const switchBtn = document.getElementById('btn-switch-supervisor-2');

  let supervisor = null;
  let products = [];
  let saving = false;

  const combobox = createProductCombobox([], { placeholder: 'Search products…' });
  comboboxMount.appendChild(combobox.element);

  async function loadProducts() {
    if (products.length) return; // catalogue doesn't change mid-shift; load once
    try {
      products = await fetchActiveProducts();
      combobox.setProducts(products);
      if (products.length === 0) showError('No active products found. Add one in Products.');
    } catch (err) {
      console.error(err);
      showError('Could not load products. Check your connection.');
    }
  }

  async function loadTeams() {
    teamSelect.innerHTML = '<option value="">Loading teams…</option>';
    try {
      const teams = await fetchTeamsForSupervisor(supervisor.id);
      if (teams.length === 0) {
        teamSelect.innerHTML = '<option value="">No teams yet — add one first</option>';
        return;
      }
      teamSelect.innerHTML = teams
        .map((t) => `<option value="${t.id}">Team ${t.team_number}</option>`)
        .join('');

      const session = getSession();
      if (
        session.selectedTeamId &&
        teams.some((t) => String(t.id) === String(session.selectedTeamId))
      ) {
        teamSelect.value = session.selectedTeamId;
      } else {
        setSelectedTeamId(teamSelect.value);
      }
    } catch (err) {
      console.error(err);
      teamSelect.innerHTML = '<option value="">Could not load teams</option>';
      showError('Could not load teams. Check your connection.');
    }
  }

  teamSelect.addEventListener('change', () => setSelectedTeamId(teamSelect.value));

  function clearFieldErrors() {
    qtyError.hidden = true;
    weightError.hidden = true;
  }

  async function handleSave() {
    if (saving) return;
    clearFieldErrors();

    const teamId = teamSelect.value;
    const product = combobox.getSelectedProduct();
    const quantityRaw = qtyInput.value;
    const weightRaw = weightInput.value;

    let hasError = false;

    if (!teamId) {
      showError('Select a team first.');
      hasError = true;
    }
    if (!product) {
      showError('Select a product first.');
      hasError = true;
    }

    const qtyMsg = validatePositiveNumber(quantityRaw, 'Quantity');
    if (qtyMsg) {
      qtyError.textContent = qtyMsg;
      qtyError.hidden = false;
      hasError = true;
    }

    const weightMsg = validatePositiveNumber(weightRaw, 'Weight');
    if (weightMsg) {
      weightError.textContent = weightMsg;
      weightError.hidden = false;
      hasError = true;
    }

    if (hasError) return;

    saving = true;
    saveBtn.disabled = true;
    try {
      await insertProduction({
        teamId,
        productId: product.id,
        quantity: Number(quantityRaw),
        weight: Number(weightRaw),
      });
      showSuccess('Production saved');
      // Reset only quantity/weight — team and product usually carry over to
      // the next entry on a factory floor, so leave them selected.
      qtyInput.value = '';
      weightInput.value = '';
      qtyInput.focus();
    } catch (err) {
      console.error(err);
      showError('Production could not be saved. Please try again.');
      // Do not clear the form on failure (see README — data safety).
    } finally {
      saving = false;
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener('click', handleSave);
  manageBtn.addEventListener('click', () => onManageTeams(supervisor));
  switchBtn.addEventListener('click', () => onSwitchSupervisor());

  async function refresh(sup) {
    supervisor = sup;
    document.getElementById('prod-supervisor-name').textContent = sup.name;
    clearFieldErrors();
    await Promise.all([loadTeams(), loadProducts()]);
  }

  return { refresh };
}
