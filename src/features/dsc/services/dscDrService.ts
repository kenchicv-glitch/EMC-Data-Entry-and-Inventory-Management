import { supabase } from '../../../shared/lib/supabase';
import type { DscDrItem } from '../types';

export async function getDrItemsByDayId(dayId: string): Promise<DscDrItem[]> {
  const { data, error } = await supabase
    .from('dsc_dr_items')
    .select('*')
    .eq('day_id', dayId)
    .order('account_name')
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function upsertDrItem(
  item: Omit<DscDrItem, 'created_at' | 'amount'> & { id?: string }
): Promise<DscDrItem> {
  const { data, error } = await supabase
    .from('dsc_dr_items')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDrItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_dr_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertDrItems(
  dayId: string,
  items: Array<Omit<DscDrItem, 'id' | 'day_id' | 'created_at' | 'amount'>>
): Promise<DscDrItem[]> {
  const { error: delError } = await supabase
    .from('dsc_dr_items')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_dr_items')
    .insert(items.map((item, i) => ({ ...item, day_id: dayId, sort_order: i })))
    .select();
  if (error) throw error;
  return data ?? [];
}
