import { supabase } from '../../../shared/lib/supabase';
import type { DscReturnEntry } from '../types';

export async function getReturnsByDayId(dayId: string): Promise<DscReturnEntry[]> {
  const { data, error } = await supabase
    .from('dsc_returns')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function upsertReturn(
  item: Omit<DscReturnEntry, 'created_at'> & { id?: string }
): Promise<DscReturnEntry> {
  const { data, error } = await supabase
    .from('dsc_returns')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReturn(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_returns')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertReturns(
  dayId: string,
  items: Array<Omit<DscReturnEntry, 'id' | 'day_id' | 'created_at'>>
): Promise<DscReturnEntry[]> {
  const { error: delError } = await supabase
    .from('dsc_returns')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_returns')
    .insert(items.map((item) => ({ ...item, day_id: dayId })))
    .select();
  if (error) throw error;
  return data ?? [];
}
