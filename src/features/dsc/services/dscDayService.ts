import { supabase } from '../../../shared/lib/supabase';
import type { DscDay } from '../types';

export async function getDscDay(date: string, branchId: string): Promise<DscDay | null> {
  const { data, error } = await supabase
    .from('dsc_days')
    .select('*')
    .eq('date', date)
    .eq('branch_id', branchId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDscDaysForMonth(
  year: number,
  month: number,
  branchId: string
): Promise<DscDay[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
  const { data, error } = await supabase
    .from('dsc_days')
    .select('*')
    .eq('branch_id', branchId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');
  if (error) throw error;
  return data ?? [];
}

export async function createDscDay(
  date: string,
  branchId: string,
  createdBy: string
): Promise<DscDay> {
  const { data, error } = await supabase
    .from('dsc_days')
    .insert({ date, branch_id: branchId, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDscDay(
  id: string,
  updates: Partial<Pick<DscDay, 'status' | 'notes'>>
): Promise<DscDay> {
  const { data, error } = await supabase
    .from('dsc_days')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
