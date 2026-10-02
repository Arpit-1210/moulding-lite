const KEY = 'moulding_session';

export function getSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function setSupervisor(supervisor) {
  const s = getSession();
  s.supervisor = supervisor;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function setSelectedTeam(teamId) {
  const s = getSession();
  s.selectedTeamId = teamId;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
