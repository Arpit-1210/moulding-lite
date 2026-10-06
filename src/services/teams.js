import { supabase } from './supabaseClient.js';

export async function fetchTeamsForSupervisor(supervisorId) {
  const { data, error } = await supabase.from('teams').select('*').eq('supervisor_id', supervisorId).order('team_number');
  if (error) throw error;
  return data || [];
}

export async function fetchTeamsAll() {
  const { data, error } = await supabase.from('teams').select('*').order('team_number');
  if (error) throw error;
  return data || [];
}

export async function saveTeam(team) {
  if (team.id) {
    const { data, error } = await supabase.from('teams').update({ members: team.members }).eq('id', team.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('teams').insert([{
      supervisor_id: team.supervisor_id,
      team_number: team.team_number,
      members: team.members || [],
    }]).select().single();
    if (error) throw error;
    return data;
  }
}
