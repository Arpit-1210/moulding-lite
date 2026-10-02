import { supabase } from './supabaseClient.js';
import { fetchTeamDailyWageTotals } from './teams.js';
import { summarize, groupByProduct, groupByTeam } from './calculations.js';

/**
 * Production rows for a factory-local date range (inclusive), with team,
 * supervisor and product pricing joined in — everything the profit
 * calculations need, in one query.
 */
export async function fetchProductionRows({ from, to }) {
  const { data, error } = await supabase
    .from('production_log')
    .select(
      `
      id, quantity, weight, production_date, production_time, created_at,
      teams ( id, team_number, supervisor_id, supervisors ( id, name ) ),
      products ( id, name, selling_price, rm_cost )
    `
    )
    .gte('production_date', from)
    .lte('production_date', to)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Everything a Dashboard / Profit & Loss page needs for a date range:
 * the raw rows, the overall summary, and the product/team breakdowns.
 */
export async function fetchAnalytics({ from, to }) {
  const [rows, teamDailyWageTotals] = await Promise.all([
    fetchProductionRows({ from, to }),
    fetchTeamDailyWageTotals(),
  ]);

  return {
    rows,
    summary: summarize(rows, teamDailyWageTotals),
    byProduct: groupByProduct(rows),
    byTeam: groupByTeam(rows, teamDailyWageTotals),
  };
}

/** Subscribe to new production entries — callers should refetch on change. */
export function subscribeToProductionChanges(onChange) {
  const channel = supabase
    .channel('production_log_changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_log' }, () =>
      onChange()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
