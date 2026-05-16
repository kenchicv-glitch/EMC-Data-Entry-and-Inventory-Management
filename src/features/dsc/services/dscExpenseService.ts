import { supabase } from '../../../shared/lib/supabase';
import type { DscExpenseEntry } from '../types';

export async function getExpensesByDayId(dayId: string): Promise<DscExpenseEntry[]> {
  const { data, error } = await supabase
    .from('dsc_expenses')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function upsertExpense(
  item: Omit<DscExpenseEntry, 'created_at'> & { id?: string }
): Promise<DscExpenseEntry> {
  const { data, error } = await supabase
    .from('dsc_expenses')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_expenses')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertExpenses(
  dayId: string,
  items: Array<Omit<DscExpenseEntry, 'id' | 'day_id' | 'created_at'>>
): Promise<DscExpenseEntry[]> {
  // Sync logic: delete existing synced items or all? 
  // For simplicity and user control, we'll replace the full set linked to this day.
  const { error: delError } = await supabase
    .from('dsc_expenses')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_expenses')
    .insert(items.map((item) => ({ ...item, day_id: dayId })))
    .select();
  if (error) throw error;
  return data ?? [];
}
