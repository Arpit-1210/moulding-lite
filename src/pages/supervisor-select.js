import { fetchActiveSupervisors } from '../services/supervisors.js';
import { escapeHtml } from '../utils/dom.js';

/** Screen 1 — Select supervisor. No login, just a name from a predefined, Supabase-backed list. */
export function initSupervisorSelectView({ onContinue }) {
  const select = document.getElementById('supervisor-select');
  const continueBtn = document.getElementById('btn-continue-to-teams');
  const errorEl = document.getElementById('supervisor-error');

  let supervisors = [];

  async function load() {
    select.innerHTML = '<option value="">Loading supervisors…</option>';
    errorEl.hidden = true;
    try {
      supervisors = await fetchActiveSupervisors();
      if (supervisors.length === 0) {
        select.innerHTML = '<option value="">No active supervisors</option>';
        errorEl.textContent = 'No active supervisors found. Add one in the supervisors table.';
        errorEl.hidden = false;
        return;
      }
      select.innerHTML =
        '<option value="">Select supervisor</option>' +
        supervisors.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    } catch (err) {
      console.error(err);
      select.innerHTML = '<option value="">Could not load</option>';
      errorEl.textContent = 'Could not reach the server. Check your connection and reload.';
      errorEl.hidden = false;
    }
  }

  select.addEventListener('change', () => {
    continueBtn.disabled = !select.value;
  });

  continueBtn.addEventListener('click', () => {
    const supervisor = supervisors.find((s) => String(s.id) === select.value);
    if (!supervisor) return;
    onContinue(supervisor);
  });

  function refresh() {
    select.value = '';
    continueBtn.disabled = true;
    load();
  }

  refresh();
  return { refresh };
}
