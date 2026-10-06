import { supabase } from './supabaseClient.js';

/** Active products, for dropdowns/search (production entry). */
export async function fetchActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, selling_price, rm_cost')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** All products, active and inactive, for the Products catalogue page. */
export async function fetchAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, selling_price, rm_cost, active, created_at')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createProduct({ name, sellingPrice, rmCost }) {
  const { data, error } = await supabase
    .from('products')
    .insert({ name: name.trim(), selling_price: sellingPrice, rm_cost: rmCost, active: true })
    .select('id, name, selling_price, rm_cost, active, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(id, { name, sellingPrice, rmCost }) {
  const { error } = await supabase
    .from('products')
    .update({ name: name.trim(), selling_price: sellingPrice, rm_cost: rmCost })
    .eq('id', id);

  if (error) throw error;
}

export async function setProductActive(id, active) {
  const { error } = await supabase.from('products').update({ active }).eq('id', id);
  if (error) throw error;
}
