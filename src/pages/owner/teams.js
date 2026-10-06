import { fetchTeamsAll } from '../../services/teams.js';
import { fetchActiveSupervisors } from '../../services/supervisors.js';

export async function renderTeams(root) {
  const [teams, supervisors] = await Promise.all([fetchTeamsAll(), fetchActiveSupervisors()]);
  const supMap = Object.fromEntries(supervisors.map(s => [s.id, s]));

  const cards = supervisors.map(s => {
    const sTeams = teams.filter(t => t.supervisor_id === s.id);
    const teamCards = sTeams.map(t => `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;">
        <div style="font-weight:600;font-size:14px;margin-bottom:6px;">Team ${t.team_number}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${(t.members||[]).map(m => `<span class="badge badge-blue">${m}</span>`).join('') || '<span style="font-size:12px;color:var(--ink-faint);">No members</span>'}
        </div>
      </div>`).join('') || '<div style="font-size:12px;color:var(--ink-faint);">No teams yet</div>';

    return `
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#1967D2,#4285f4);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;">${s.name.charAt(0)}</div>
          <div>
            <div style="font-weight:700;font-size:15px;">${s.name}</div>
            <div style="font-size:12px;color:var(--ink-dim);">${sTeams.length} team${sTeams.length!==1?'s':''} · ${sTeams.reduce((a,t)=>a+(t.members||[]).length,0)} workers</div>
          </div>
        </div>
        ${teamCards}
      </div>`;
  }).join('') || '<div class="state-msg">No supervisors found</div>';

  root.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px;">
      <div class="kpi-card"><div class="kpi-label">Supervisors</div><div class="kpi-value">${supervisors.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Teams</div><div class="kpi-value">${teams.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Workers</div><div class="kpi-value">${teams.reduce((a,t)=>a+(t.members||[]).length,0)}</div></div>
    </div>
    <div class="section-head"><div class="section-title">All Teams</div></div>
    ${cards}
  `;
}
