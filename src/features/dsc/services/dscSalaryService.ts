import { supabase } from '../../../shared/lib/supabase';
import type { DscSalaryEntry } from '../types';

export async function getSalaryEntriesByDayId(dayId: string): Promise<DscSalaryEntry[]> {
  const { data, error } = await supabase
    .from('dsc_salary_entries')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function upsertSalaryEntry(
  item: Omit<DscSalaryEntry, 'created_at'> & { id?: string }
): Promise<DscSalaryEntry> {
  const { data, error } = await supabase
    .from('dsc_salary_entries')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSalaryEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_salary_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertSalaryEntries(
  dayId: string,
  items: Array<Omit<DscSalaryEntry, 'id' | 'day_id' | 'created_at'>>
): Promise<DscSalaryEntry[]> {
  const { error: delError } = await supabase
    .from('dsc_salary_entries')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_salary_entries')
    .insert(items.map((item, i) => ({ ...item, day_id: dayId, sort_order: i })))
    .select();
  if (error) throw error;
  return data ?? [];
}
