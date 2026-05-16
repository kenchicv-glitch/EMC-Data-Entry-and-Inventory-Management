import { supabase } from '../../../shared/lib/supabase';
import type { DscOtsItem } from '../types';

export async function getOtsItemsByDayId(dayId: string): Promise<DscOtsItem[]> {
  const { data, error } = await supabase
    .from('dsc_ots_items')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function upsertOtsItem(
  item: Omit<DscOtsItem, 'created_at' | 'amount'> & { id?: string }
): Promise<DscOtsItem> {
  const { data, error } = await supabase
    .from('dsc_ots_items')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOtsItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_ots_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertOtsItems(
  dayId: string,
  items: Array<Omit<DscOtsItem, 'id' | 'day_id' | 'created_at' | 'amount'>>
): Promise<DscOtsItem[]> {
  const { error: delError } = await supabase
    .from('dsc_ots_items')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_ots_items')
    .insert(items.map((item, i) => ({ ...item, day_id: dayId, sort_order: i })))
    .select();
  if (error) throw error;
  return data ?? [];
}
