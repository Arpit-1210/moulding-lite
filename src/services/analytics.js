import { supabase } from './supabaseClient.js';

/**
 * Production rows for a date range, with team and product joined.
 */
export async function fetchProductionRows({ from, to }) {
  const { data, error } = await supabase
    .from('production_log')
    .select(
      `id, quantity, weight, production_date, production_time, created_at,
      teams ( id, team_number, name ),
      products ( id, name, selling_price, cost_price )`
    )
    .gte('production_date', from)
    .lte('production_date', to)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Summary + rows for the dashboard.
 */
export async function fetchAnalytics({ from, to }) {
  const rows = await fetchProductionRows({ from, to });

  let units = 0, weight = 0, value = 0;
  for (const row of rows) {
    const qty = Number(row.quantity) || 0;
    units  += qty;
    weight += Number(row.weight) || 0;
    value  += qty * Number(row.products?.selling_price || 0);
  }

  return {
    rows,
    summary: { units, weight, value },
  };
}

/** Subscribe to new production entries — callers refetch on change. */
export function subscribeToProductionChanges(onChange) {
  const channel = supabase
    .channel('production_log_all_' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_log' }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
