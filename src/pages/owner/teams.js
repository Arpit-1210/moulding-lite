import { fetchTeamsAll } from '../../services/teams.js';

export async function renderTeams(root) {
  const teams = await fetchTeamsAll();
  const workers = teams.reduce((a, t) => a + (t.members || []).length, 0);

  const cards = teams.map(t => `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:700;font-size:15px;">${t.name || 'Team ' + t.team_number}</div>
        <span style="font-size:12px;color:var(--ink-dim);">${(t.members || []).length} workers</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${(t.members || []).map(m => `<span class="badge badge-blue">${m}</span>`).join('') || '<span style="font-size:12px;color:var(--ink-faint);">No members</span>'}
      </div>
    </div>`).join('') || '<div class="state-msg">No teams yet</div>';

  root.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:24px;">
      <div class="kpi-card"><div class="kpi-label">Total Teams</div><div class="kpi-value">${teams.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Workers</div><div class="kpi-value">${workers}</div></div>
    </div>
    <div class="section-head"><div class="section-title">All Teams</div></div>
    ${cards}`;
}
