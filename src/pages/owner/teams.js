import { fetchActiveSupervisors } from '../../services/supervisors.js';
import {
  fetchTeamsForSupervisor,
  createNextTeam,
  fetchTeamMembers,
  addTeamMember,
  removeTeamMember,
} from '../../services/teams.js';
import { fetchAvailableWorkers, createWorker } from '../../services/workers.js';
import { formatRupees } from '../../components/kpiRow.js';

export async function render(container) {
  container.innerHTML = `
    <div class="panel-head" style="margin-bottom: var(--space-5)">
      <div class="field" style="margin-bottom: 0; min-width: 260px">
        <label for="tm-supervisor">Supervisor</label>
        <select id="tm-supervisor"><option value="">Loading…</option></select>
      </div>
      <button class="btn btn-primary btn-compact" id="tm-add-team" disabled>+ Add team</button>
    </div>
    <div id="tm-teams-root"></div>
  `;

  const supervisorSelect = container.querySelector('#tm-supervisor');
  const addTeamBtn = container.querySelector('#tm-add-team');
  const teamsRoot = container.querySelector('#tm-teams-root');

  let teams = [];

  async function loadSupervisors() {
    try {
      const supervisors = await fetchActiveSupervisors();
      if (supervisors.length === 0) {
        supervisorSelect.innerHTML = '<option value="">No active supervisors — add one in Settings</option>';
        return;
      }
      supervisorSelect.innerHTML = supervisors
        .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
        .join('');
      addTeamBtn.disabled = false;
      await loadTeams();
    } catch (err) {
      console.error(err);
      supervisorSelect.innerHTML = '<option value="">Could not load supervisors</option>';
    }
  }

  async function loadTeams() {
    const supervisorId = supervisorSelect.value;
    if (!supervisorId) {
      teamsRoot.innerHTML = '';
      return;
    }
    teamsRoot.innerHTML = '<p class="state-msg">Loading teams…</p>';
    try {
      teams = await fetchTeamsForSupervisor(supervisorId);
      if (teams.length === 0) {
        teamsRoot.innerHTML = '<p class="state-msg">No teams yet for this supervisor — add one above.</p>';
        return;
      }
      teamsRoot.innerHTML = teams.map((t) => teamCardSkeleton(t)).join('');
      await Promise.all(teams.map((t) => loadTeamCard(t)));
    } catch (err) {
      console.error(err);
      teamsRoot.innerHTML = '<p class="error-text">Could not load teams.</p>';
    }
  }

  function teamCardSkeleton(team) {
    return `
      <div class="panel" data-team-id="${team.id}">
        <div class="panel-head">
          <h2>Team ${team.team_number}</h2>
          <span class="pill" data-wage-total>Loading wage total…</span>
        </div>
        <div class="worker-grid" data-members>
          <p class="state-msg">Loading members…</p>
        </div>
        <div class="form-grid" style="margin-top: var(--space-4)" data-add-member-form>
          <select data-worker-select><option value="">Loading workers…</option></select>
          <button class="btn btn-secondary btn-compact" data-action="add-existing">+ Add to team</button>
        </div>
        <details style="margin-top: var(--space-3)">
          <summary style="cursor:pointer; color: var(--ink-dim); font-size: var(--text-sm)">+ New worker</summary>
          <div class="form-grid" style="margin-top: var(--space-3)">
            <input type="text" placeholder="Worker name" data-new-worker-name />
            <input type="number" placeholder="Daily wage (₹)" min="0" step="1" data-new-worker-wage />
            <button class="btn btn-primary btn-compact" data-action="create-and-add">Create &amp; add</button>
          </div>
        </details>
      </div>`;
  }

  async function loadTeamCard(team) {
    const card = teamsRoot.querySelector(`[data-team-id="${team.id}"]`);
    if (!card) return;
    const membersEl = card.querySelector('[data-members]');
    const wageTotalEl = card.querySelector('[data-wage-total]');
    const workerSelect = card.querySelector('[data-worker-select]');

    async function refreshMembers() {
      const [members, available] = await Promise.all([
        fetchTeamMembers(team.id),
        fetchAvailableWorkers(team.id),
      ]);

      if (members.length === 0) {
        membersEl.innerHTML = '<p class="state-msg" style="padding: var(--space-3) 0">No members yet.</p>';
      } else {
        membersEl.innerHTML = members
          .map(
            (w) => `
            <div class="worker-tile">
              <div>
                <span class="name">${escapeHtml(w.name)}</span>
                <span class="wage">${formatRupees(w.daily_wage)}/day</span>
              </div>
              <button type="button" class="is-remove" data-remove-worker="${w.id}" aria-label="Remove">×</button>
            </div>`
          )
          .join('');
      }

      const wageTotal = members.reduce((sum, w) => sum + Number(w.daily_wage || 0), 0);
      wageTotalEl.textContent = `${members.length} member${members.length === 1 ? '' : 's'} · ${formatRupees(wageTotal)}/day`;

      workerSelect.innerHTML =
        available.length === 0
          ? '<option value="">No available workers — create one below</option>'
          : '<option value="">Select existing worker</option>' +
            available.map((w) => `<option value="${w.id}">${escapeHtml(w.name)} — ${formatRupees(w.daily_wage)}/day</option>`).join('');
    }

    membersEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-remove-worker]');
      if (!btn) return;
      btn.disabled = true;
      try {
        await removeTeamMember(team.id, btn.dataset.removeWorker);
        await refreshMembers();
      } catch (err) {
        console.error(err);
        alert('Could not remove that member. Please try again.');
        btn.disabled = false;
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
        alert('Could not add that worker. Please try again.');
      }
    });

    card.querySelector('[data-action="create-and-add"]').addEventListener('click', async (e) => {
      const nameInput = card.querySelector('[data-new-worker-name]');
      const wageInput = card.querySelector('[data-new-worker-wage]');
      const name = nameInput.value.trim();
      const wage = Number(wageInput.value);
      if (!name) return alert('Enter a worker name.');
      if (!wageInput.value || wage < 0 || Number.isNaN(wage)) return alert('Enter a daily wage (0 or more).');

      e.target.disabled = true;
      try {
        const worker = await createWorker({ name, dailyWage: wage });
        await addTeamMember(team.id, worker.id);
        nameInput.value = '';
        wageInput.value = '';
        await refreshMembers();
      } catch (err) {
        console.error(err);
        alert('Could not create that worker. Please try again.');
      } finally {
        e.target.disabled = false;
      }
    });

    await refreshMembers();
  }

  supervisorSelect.addEventListener('change', loadTeams);

  addTeamBtn.addEventListener('click', async () => {
    const supervisorId = supervisorSelect.value;
    if (!supervisorId) return;
    addTeamBtn.disabled = true;
    try {
      await createNextTeam(supervisorId, teams);
      await loadTeams();
    } catch (err) {
      console.error(err);
      alert('Could not create a new team. Please try again.');
    } finally {
      addTeamBtn.disabled = false;
    }
  });

  await loadSupervisors();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
