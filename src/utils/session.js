// Thin wrapper around sessionStorage so a supervisor doesn't have to re-select
// their name or re-pick a team every time they log a new production entry
// during their shift. Session-scoped (not localStorage) so the next shift
// starts clean on a shared factory-floor device.

const KEY = 'moulding-lite.session.v1';

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private browsing, quota) — degrade silently;
    // the supervisor just has to re-select on that device.
  }
}

export function getSession() {
  return read();
}

export function setSupervisor(supervisor) {
  write({ ...read(), supervisor });
}

export function setSelectedTeamId(teamId) {
  write({ ...read(), selectedTeamId: teamId });
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
