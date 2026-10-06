import { supabase } from './supabaseClient.js';

export async function fetchActiveSupervisors() {
  const { data, error } = await supabase.from('supervisors').select('*').eq('active', true).order('name');
  if (error) throw error;
  return data || [];
}
