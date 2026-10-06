import { supabase } from './supabaseClient.js';

/** Active supervisors, for selection dropdowns. */
export async function fetchActiveSupervisors() {
  const { data, error } = await supabase
    .from('supervisors')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** All supervisors, active and inactive, for the Settings page. */
export async function fetchAllSupervisors() {
  const { data, error } = await supabase
    .from('supervisors')
    .select('id, name, active, created_at')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createSupervisor(name) {
  const { data, error } = await supabase
    .from('supervisors')
    .insert({ name: name.trim(), active: true })
    .select('id, name, active')
    .single();

  if (error) throw error;
  return data;
}

export async function setSupervisorActive(id, active) {
  const { error } = await supabase.from('supervisors').update({ active }).eq('id', id);
  if (error) throw error;
}
