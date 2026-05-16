import { supabase } from '../../../shared/lib/supabase';
import type { DscCollection } from '../types';

export async function getCollectionsByDayId(dayId: string): Promise<DscCollection[]> {
  const { data, error } = await supabase
    .from('dsc_collections')
    .select('*')
    .eq('day_id', dayId)
    .order('collection_type');
  if (error) throw error;
  return data ?? [];
}

export async function upsertCollection(
  item: Omit<DscCollection, 'created_at'> & { id?: string }
): Promise<DscCollection> {
  const { data, error } = await supabase
    .from('dsc_collections')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_collections')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertCollections(
  dayId: string,
  items: Array<Omit<DscCollection, 'id' | 'day_id' | 'created_at'>>
): Promise<DscCollection[]> {
  const { error: delError } = await supabase
    .from('dsc_collections')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_collections')
    .insert(items.map((item) => ({ ...item, day_id: dayId })))
    .select();
  if (error) throw error;
  return data ?? [];
}
