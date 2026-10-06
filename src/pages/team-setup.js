import { fetchTeamsForSupervisor, saveTeam } from '../services/teams.js';

export function initTeamSetupView({ onContinue, onSwitchSupervisor }) {
  const teamsList = document.getElementById('teams-list');
  const addTeamBtn = document.getElementById('btn-add-team');
  const continueBtn = document.getElementById('btn-continue-to-production');
  const supName = document.getElementById('team-setup-supervisor-name');
  const switchBtn = document.getElementById('btn-switch-supervisor-1');

  let currentSupervisor = null;
  let teams = [];

  async function load(supervisor) {
    supName.textContent = `Supervisor: ${supervisor.name}`;
    try {
      teams = await fetchTeamsForSupervisor(supervisor.id);
    } catch(e) { teams = []; }
    renderTeams();
  }

  function renderTeams() {
    if (!teams.length) {
      teamsList.innerHTML = '<div class="state-msg" style="padding:20px 0;">No teams yet. Add your first team.</div>';
      return;
    }
    teamsList.innerHTML = teams.map((t, i) => `
      <div class="team-card-new">
        <div class="team-card-head">
          <span class="team-badge">👷 Team ${t.team_number}</span>
          <span style="font-size:12px;color:var(--ink-dim);">${(t.members||[]).length} members</span>
        </div>
        <div class="member-chips">
          ${(t.members||[]).map(m => `<span class="member-chip">${m}</span>`).join('')}
        </div>
        <div style="height:10px;"></div>
        <div id="add-member-row-${t.id}" class="member-input-row">
          <input type="text" placeholder="Add member name" id="new-member-${t.id}" style="font-size:14px;" />
          <button onclick="addMember('${t.id}', '${i}')" class="btn btn-primary btn-small">Add</button>
        </div>
      </div>
    `).join('');

    // Expose addMember globally for inline onclick
    window.addMember = async (teamId, idx) => {
      const input = document.getElementById(`new-member-${teamId}`);
      const name = input.value.trim();
      if (!name) return;
      const team = teams.find(t => t.id === teamId);
      if (!team) return;
      team.members = [...(team.members||[]), name];
      input.value = '';
      await saveTeam(team);
      renderTeams();
    };
  }

  addTeamBtn.addEventListener('click', async () => {
    if (!currentSupervisor) return;
    const nextNum = teams.length + 1;
    const newTeam = await saveTeam({
      supervisor_id: currentSupervisor.id,
      team_number: nextNum,
      members: []
    });
    if (newTeam) { teams.push(newTeam); renderTeams(); }
  });

  continueBtn.addEventListener('click', () => {
    if (currentSupervisor) onContinue(currentSupervisor);
  });

  switchBtn.addEventListener('click', onSwitchSupervisor);

  function refresh(supervisor) {
    currentSupervisor = supervisor;
    teams = [];
    load(supervisor);
  }

  return { refresh };
}
