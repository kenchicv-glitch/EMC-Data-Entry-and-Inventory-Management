import { supabase } from '../../../shared/lib/supabase';
import type { DscCashDenomination } from '../types';

const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.25];

export async function getCashDenomByDayId(dayId: string): Promise<DscCashDenomination[]> {
  const { data, error } = await supabase
    .from('dsc_cash_denominations')
    .select('*')
    .eq('day_id', dayId)
    .order('denomination', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertCashDenom(
  item: Omit<DscCashDenomination, 'id'> & { id?: string }
): Promise<DscCashDenomination> {
  const { data, error } = await supabase
    .from('dsc_cash_denominations')
    .upsert(item, { onConflict: 'day_id,denomination' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function batchUpsertCashDenoms(
  dayId: string,
  items: Array<{ denomination: number; count: number }>
): Promise<DscCashDenomination[]> {
  const { error: delError } = await supabase
    .from('dsc_cash_denominations')
    .delete()
    .eq('day_id', dayId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_cash_denominations')
    .insert(items.map((item) => ({ ...item, day_id: dayId })))
    .select();
  if (error) throw error;
  return data ?? [];
}

export function getDefaultDenominations(): Array<{ denomination: number; count: number }> {
  return DENOMINATIONS.map((d) => ({ denomination: d, count: 0 }));
}
