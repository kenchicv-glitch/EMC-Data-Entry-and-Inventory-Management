import { supabase } from '../../../shared/lib/supabase';
import type { DscPurchaseItem } from '../types';

export async function getPurchasesByDayId(dayId: string): Promise<DscPurchaseItem[]> {
  const { data, error } = await supabase
    .from('dsc_purchase_items')
    .select('*')
    .eq('day_id', dayId)
    .order('batch')
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function upsertPurchaseItem(
  item: Omit<DscPurchaseItem, 'created_at'> & { id?: string }
): Promise<DscPurchaseItem> {
  const { data, error } = await supabase
    .from('dsc_purchase_items')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePurchaseItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_purchase_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertPurchases(
  dayId: string,
  items: Array<Omit<DscPurchaseItem, 'id' | 'day_id' | 'created_at'>>
): Promise<DscPurchaseItem[]> {
  if (items.length === 0) return [];

  const { error: delError } = await supabase
    .from('dsc_purchase_items')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  const { data, error } = await supabase
    .from('dsc_purchase_items')
    .insert(items.map((item, i) => ({ ...item, day_id: dayId, sort_order: i })))
    .select();
  if (error) throw error;
  return data ?? [];
}
