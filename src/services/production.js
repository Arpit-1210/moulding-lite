import { supabase } from './supabaseClient.js';
import { today } from '../utils/date.js';

export async function insertProductionLog(entry) {
  const { data, error } = await supabase.from('production_log').insert([entry]).select().single();
  if (error) throw error;
  return data;
}

export async function fetchTodayProduction() {
  const { data, error } = await supabase.from('production_log').select('*').eq('production_date', today()).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTodayLogForSupervisor(supervisorId) {
  // Get team ids for this supervisor
  const { data: teams } = await supabase.from('teams').select('id').eq('supervisor_id', supervisorId);
  if (!teams || !teams.length) return [];
  const teamIds = teams.map(t => t.id);
  const { data, error } = await supabase.from('production_log').select('*').in('team_id', teamIds).eq('production_date', today()).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchProductionByRange(from, to) {
  const { data, error } = await supabase.from('production_log').select('*').gte('production_date', from).lte('production_date', to).order('production_date', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export function subscribeToProduction(date, callback) {
  const channel = supabase.channel('production-live')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'production_log',
      filter: `production_date=eq.${date}`,
    }, payload => callback(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
