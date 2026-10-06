import {
  fetchTeamsForSupervisor,
  createNextTeam,
  fetchTeamMembers,
  addTeamMember,
  removeTeamMember,
} from '../services/teams.js';
import { fetchAvailableWorkers, createWorker } from '../services/workers.js';
import { showSuccess, showError } from '../components/toast.js';
import { escapeHtml } from '../utils/dom.js';

/** Screen 2 — Your Teams. Members are real worker records with a daily wage (used in Profit & Loss). */
export function initTeamSetupView({ onContinue, onSwitchSupervisor }) {
  const listEl = document.getElementById('teams-list');
  const addTeamBtn = document.getElementById('btn-add-team');
  const continueBtn = document.getElementById('btn-continue-to-production');
  const switchBtn = document.getElementById('btn-switch-supervisor-1');

  let supervisor = null;
  let teams = []; // [{ id, team_number }]

  function teamCardSkeleton(team) {
    return `
      <div class="card-team" data-team-id="${team.id}">
        <div class="card-team-head">
          <h3>Team ${team.team_number}</h3>
        </div>
        <div class="member-pills" data-members style="margin-bottom: var(--space-3)">
          <p class="state-msg" style="padding:0">Loading members…</p>
        </div>
        <select data-worker-select style="margin-bottom: var(--space-2)">
          <option value="">Loading workers…</option>
        </select>
        <button type="button" class="btn btn-secondary btn-small" data-action="add-existing" style="margin-bottom: var(--space-3)">
          + Add to team
        </button>
        <details>
          <summary style="cursor:pointer; color: var(--ink-dim); font-size: var(--text-sm)">+ New worker</summary>
          <div style="margin-top: var(--space-3)">
            <input type="text" placeholder="Worker name" data-new-name style="margin-bottom: var(--space-2)" />
            <input type="number" placeholder="Daily wage (₹)" min="0" step="1" data-new-wage style="margin-bottom: var(--space-2)" />
            <button type="button" class="btn btn-primary btn-small" data-action="create-and-add">Create &amp; add</button>
          </div>
        </details>
      </div>`;
  }

  function render() {
    if (teams.length === 0) {
      listEl.innerHTML = '<p class="state-msg">No teams yet — add your first team below.</p>';
      return;
    }
    listEl.innerHTML = teams.map(teamCardSkeleton).join('');
    teams.forEach(wireTeamCard);
  }

  function wireTeamCard(team) {
    const card = listEl.querySelector(`[data-team-id="${team.id}"]`);
    if (!card) return;
    const membersEl = card.querySelector('[data-members]');
    const workerSelect = card.querySelector('[data-worker-select]');

    async function refreshMembers() {
      const [members, available] = await Promise.all([
        fetchTeamMembers(team.id),
        fetchAvailableWorkers(team.id),
      ]);

      membersEl.innerHTML =
        members.length === 0
          ? '<p class="state-msg" style="padding:0">No members yet.</p>'
          : members
              .map(
                (w) => `
            <span class="pill" style="padding-right: var(--space-1)">
              ${escapeHtml(w.name)}
              <button type="button" data-remove="${w.id}" style="border:none;background:none;color:var(--ink-dim);cursor:pointer;font-size:1em;margin-left:4px">×</button>
            </span>`
              )
              .join('');

      workerSelect.innerHTML =
        available.length === 0
          ? '<option value="">No other workers available</option>'
          : '<option value="">Select existing worker</option>' +
            available.map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
    }

    membersEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      try {
        await removeTeamMember(team.id, btn.dataset.remove);
        await refreshMembers();
      } catch (err) {
        console.error(err);
        showError('Could not remove that member.');
      }
    });

    card.querySelector('[data-action="add-existing"]').addEventListener('click', async () => {
      const workerId = workerSelect.value;
      if (!workerId) return;
      try {
        await addTeamMember(team.id, workerId);
        await refreshMembers();
      } catch (err) {
        console.error(err);
        showError('Could not add that worker.');
      }
    });

    card.querySelector('[data-action="create-and-add"]').addEventListener('click', async (e) => {
      const nameInput = card.querySelector('[data-new-name]');
      const wageInput = card.querySelector('[data-new-wage]');
      const name = nameInput.value.trim();
      const wage = Number(wageInput.value);
      if (!name) return showError('Enter a worker name.');
      if (!wageInput.value || wage < 0 || Number.isNaN(wage)) return showError('Enter a daily wage.');

      e.target.disabled = true;
      try {
        const worker = await createWorker({ name, dailyWage: wage });
        await addTeamMember(team.id, worker.id);
        nameInput.value = '';
        wageInput.value = '';
        await refreshMembers();
        showSuccess(`${name} added to Team ${team.team_number}`);
      } catch (err) {
        console.error(err);
        showError('Could not create that worker.');
      } finally {
        e.target.disabled = false;
      }
    });

    refreshMembers();
  }

  addTeamBtn.addEventListener('click', async () => {
    if (!supervisor) return;
    addTeamBtn.disabled = true;
    try {
      const team = await createNextTeam(supervisor.id, teams);
      teams.push(team);
      render();
    } catch (err) {
      console.error(err);
      showError('Team could not be created. Please try again.');
    } finally {
      addTeamBtn.disabled = false;
    }
  });

  continueBtn.addEventListener('click', () => {
    if (!supervisor) return;
    if (teams.length === 0) {
      showError('Add at least one team before continuing.');
      return;
    }
    onContinue(supervisor);
  });

  switchBtn.addEventListener('click', () => onSwitchSupervisor());

  async function refresh(sup) {
    supervisor = sup;
    document.getElementById('team-setup-supervisor-name').textContent = sup.name;
    listEl.innerHTML = '<p class="state-msg">Loading teams…</p>';
    try {
      teams = await fetchTeamsForSupervisor(sup.id);
      render();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = '<p class="error-text">Could not load teams. Reload to try again.</p>';
    }
  }

  return { refresh };
}
