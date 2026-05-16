import { supabase } from '../../../shared/lib/supabase';
import type { DscInvoiceItem } from '../types';

export async function getInvoicesByDayId(
  dayId: string,
  series?: 'A' | 'B'
): Promise<DscInvoiceItem[]> {
  let query = supabase
    .from('dsc_invoice_items')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  if (series) {
    query = query.eq('series', series);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertInvoiceItem(
  item: Omit<DscInvoiceItem, 'created_at' | 'amount'> & { id?: string }
): Promise<DscInvoiceItem> {
  const { data, error } = await supabase
    .from('dsc_invoice_items')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInvoiceItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('dsc_invoice_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertInvoices(
  dayId: string,
  series: 'A' | 'B',
  items: Array<Omit<DscInvoiceItem, 'id' | 'day_id' | 'created_at' | 'amount'>>
): Promise<DscInvoiceItem[]> {
  const { error: delError } = await supabase
    .from('dsc_invoice_items')
    .delete()
    .eq('day_id', dayId)
    .eq('series', series);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('dsc_invoice_items')
    .insert(items.map((item, i) => ({ ...item, day_id: dayId, sort_order: i })))
    .select();
  if (error) throw error;
  return data ?? [];
}
