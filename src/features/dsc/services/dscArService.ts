import { supabase } from '../../../shared/lib/supabase';
import type { DscArEntry, ArType } from '../types';

export async function getArEntriesByDayId(
  dayId: string,
  arType?: ArType
): Promise<DscArEntry[]> {
  let query = supabase
    .from('dsc_ar_entries')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  if (arType) {
    query = query.eq('ar_type', arType);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertArEntry(
  item: Omit<DscArEntry, 'created_at'> & { id?: string }
): Promise<DscArEntry> {
  const { data, error } = await supabase
    .from('dsc_ar_entries')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteArEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_ar_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertArEntries(
  dayId: string,
  items: Array<Omit<DscArEntry, 'id' | 'day_id' | 'created_at'>>
): Promise<DscArEntry[]> {
  const { error: delError } = await supabase
    .from('dsc_ar_entries')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_ar_entries')
    .insert(items.map((item, i) => ({ ...item, day_id: dayId, sort_order: i })))
    .select();
  if (error) throw error;
  return data ?? [];
}
