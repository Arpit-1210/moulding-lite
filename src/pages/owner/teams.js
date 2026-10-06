import { fetchTeamsAll } from '../../services/teams.js';
import { supabase } from '../../services/supabaseClient.js';
import { istToday, fetchRosterRows, rosterIndex, membersOn } from '../../utils/roster.js';

let selectedDate = null;

export async function renderTeams(root) {
  const TODAY = istToday();
  if (!selectedDate) selectedDate = TODAY;
  const [teams, rosterRows] = await Promise.all([fetchTeamsAll(), fetchRosterRows(supabase)]);
  const idx = rosterIndex(rosterRows);

  function draw() {
    const day = teams.map(t => ({ t, members: membersOn(idx, t.id, selectedDate) }));
    const workers = day.reduce((a, x) => a + x.members.length, 0);
    const cards = day.map(({ t, members }) => `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;font-size:15px;">${t.name || 'Team ' + t.team_number}</div>
          <span style="font-size:12px;color:var(--ink-dim);">${members.length} workers</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${members.map(m => `<span class="badge badge-blue">${m}</span>`).join('') || '<span style="font-size:12px;color:var(--ink-faint);">No members for this day</span>'}
        </div>
      </div>`).join('') || '<div class="state-msg">No teams yet</div>';

    root.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">📅 Teams for date</label>
        <input type="date" id="roster-date" value="${selectedDate}" style="border:1px solid var(--border);border-radius:6px;padding:9px 10px;font-size:14px;">
        <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;">Teams are fixed per day. Supervisors set them in the supervisor app.</div>
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:24px;">
        <div class="kpi-card"><div class="kpi-label">Teams</div><div class="kpi-value">${teams.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">Workers on this day</div><div class="kpi-value">${workers}</div></div>
      </div>
      <div class="section-head"><div class="section-title">Teams — ${selectedDate === TODAY ? 'Today' : selectedDate}</div></div>
      ${cards}`;
    root.querySelector('#roster-date').addEventListener('change', e => { if (e.target.value) { selectedDate = e.target.value; draw(); } });
  }
  draw();
}
