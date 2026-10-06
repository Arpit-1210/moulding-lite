import { supabase } from './supabaseClient.js';
import { factoryDateToday, factoryTimeNow } from '../utils/date.js';

/**
 * Appends one production record. Production logging is append-only by design
 * (see README) — there is no edit/delete path from the supervisor interface.
 * Reading production data back (for the Dashboard, Production Log, and
 * Profit & Loss) goes through services/analytics.js instead, which joins in
 * team/supervisor/product data and the profit calculations in one place.
 */
export async function insertProduction({ teamId, productId, quantity, weight }) {
  const { error } = await supabase.from('production_log').insert({
    team_id: teamId,
    product_id: productId,
    quantity,
    weight,
    production_date: factoryDateToday(),
    production_time: factoryTimeNow(),
  });

  if (error) throw error;
}
