import { supabase } from './supabaseClient.js';

/** All active workers not already on the given team — for the "add member" picker. */
export async function fetchAvailableWorkers(excludeTeamId) {
  const { data: allWorkers, error } = await supabase
    .from('workers')
    .select('id, name, daily_wage')
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;

  if (!excludeTeamId) return allWorkers ?? [];

  const { data: existingLinks, error: linkError } = await supabase
    .from('team_members')
    .select('worker_id')
    .eq('team_id', excludeTeamId);
  if (linkError) throw linkError;

  const existingIds = new Set((existingLinks ?? []).map((l) => l.worker_id));
  return (allWorkers ?? []).filter((w) => !existingIds.has(w.id));
}

/** Every worker, active and inactive, for the Settings/roster view. */
export async function fetchAllWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('id, name, daily_wage, active, created_at')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createWorker({ name, dailyWage }) {
  const { data, error } = await supabase
    .from('workers')
    .insert({ name: name.trim(), daily_wage: dailyWage, active: true })
    .select('id, name, daily_wage, active')
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id, { name, dailyWage }) {
  const { error } = await supabase
    .from('workers')
    .update({ name: name.trim(), daily_wage: dailyWage })
    .eq('id', id);
  if (error) throw error;
}

export async function setWorkerActive(id, active) {
  const { error } = await supabase.from('workers').update({ active }).eq('id', id);
  if (error) throw error;
}
