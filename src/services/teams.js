import { supabase } from './supabaseClient.js';

/** Teams belonging to one supervisor (for the floor Team Setup / Log Production screens). */
export async function fetchTeamsForSupervisor(supervisorId) {
  const { data, error } = await supabase
    .from('teams')
    .select('id, team_number, supervisor_id')
    .eq('supervisor_id', supervisorId)
    .order('team_number', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Every team, with its supervisor's name — for the Teams page and Profit & Loss. */
export async function fetchAllTeamsWithSupervisor() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, team_number, supervisor_id, supervisors ( id, name )')
    .order('team_number', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** A team's current members and their daily wage, via the team_members join table. */
export async function fetchTeamMembers(teamId) {
  const { data, error } = await supabase
    .from('team_members')
    .select('worker_id, workers ( id, name, daily_wage, active )')
    .eq('team_id', teamId);

  if (error) throw error;
  return (data ?? [])
    .map((row) => row.workers)
    .filter((w) => w && w.active);
}

/**
 * Every team's current total daily wage (sum of its members' daily_wage).
 * Used by the profit calculation — wage cost for a team on a day it logged
 * production is this total, once per day, not per entry.
 * Returns a Map<team_id, dailyWageTotal>.
 */
export async function fetchTeamDailyWageTotals() {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, workers ( daily_wage, active )');

  if (error) throw error;

  const totals = new Map();
  for (const row of data ?? []) {
    if (!row.workers?.active) continue;
    const current = totals.get(row.team_id) ?? 0;
    totals.set(row.team_id, current + Number(row.workers.daily_wage || 0));
  }
  return totals;
}

/** Creates the next numbered team for a supervisor. Team numbers are automatic. */
export async function createNextTeam(supervisorId, existingTeams) {
  const nextNumber = existingTeams.length
    ? Math.max(...existingTeams.map((t) => t.team_number)) + 1
    : 1;

  const { data, error } = await supabase
    .from('teams')
    .insert({ supervisor_id: supervisorId, team_number: nextNumber, members: [] })
    .select('id, team_number, supervisor_id')
    .single();

  if (error) throw error;
  return data;
}

export async function addTeamMember(teamId, workerId) {
  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, worker_id: workerId });
  if (error) throw error;
}

export async function removeTeamMember(teamId, workerId) {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('worker_id', workerId);
  if (error) throw error;
}
