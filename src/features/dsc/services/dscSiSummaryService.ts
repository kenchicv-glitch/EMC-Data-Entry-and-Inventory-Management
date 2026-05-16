import { supabase } from '../../../shared/lib/supabase';
import type { DscSiSummary } from '../types';

export async function getSiSummariesByDayId(dayId: string): Promise<DscSiSummary[]> {
  const { data, error } = await supabase
    .from('dsc_si_summaries')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function upsertSiSummary(
  item: Omit<DscSiSummary, 'created_at'> & { id?: string }
): Promise<DscSiSummary> {
  const { data, error } = await supabase
    .from('dsc_si_summaries')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSiSummary(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_si_summaries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertSiSummaries(
  dayId: string,
  items: Array<Omit<DscSiSummary, 'id' | 'day_id' | 'created_at'>>
): Promise<DscSiSummary[]> {
  const { error: delError } = await supabase
    .from('dsc_si_summaries')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_si_summaries')
    .insert(items.map((item, i) => ({ ...item, day_id: dayId, sort_order: i })))
    .select();
  if (error) throw error;
  return data ?? [];
}
