import { supabase } from './supabaseClient.js';

export async function fetchProducts() {
  const { data, error } = await supabase.from('products').select('*').eq('active', true).order('name');
  if (error) throw error;
  return data || [];
}

export async function upsertProduct(product) {
  const { data, error } = await supabase.from('products').update(product).eq('id', product.id).select().single();
  if (error) throw error;
  return data;
}
