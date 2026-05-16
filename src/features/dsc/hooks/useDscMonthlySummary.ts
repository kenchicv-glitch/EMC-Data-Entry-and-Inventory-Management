import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../shared/lib/supabase';
import { dscKeys } from './useDscDay';
import type { DscMonthlySummaryRow } from '../types';

async function fetchMonthlySummary(
  year: number,
  month: number,
  branchId: string
): Promise<DscMonthlySummaryRow[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

  // Fetch all days in the month
  const { data: days, error: daysError } = await supabase
    .from('dsc_days')
    .select('id, date')
    .eq('branch_id', branchId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');
  if (daysError) throw daysError;
  if (!days || days.length === 0) return [];

  const dayIds = days.map((d) => d.id);

  // Fetch all child data in parallel
  const [
    { data: purchases },
    { data: invoices },
    { data: drItems },
    { data: otsItems },
    { data: arEntries },
    { data: collections },
  ] = await Promise.all([
    supabase.from('dsc_purchase_items').select('*').in('day_id', dayIds),
    supabase.from('dsc_invoice_items').select('*').in('day_id', dayIds),
    supabase.from('dsc_dr_items').select('*').in('day_id', dayIds),
    supabase.from('dsc_ots_items').select('*').in('day_id', dayIds),
    supabase.from('dsc_ar_entries').select('*').in('day_id', dayIds),
    supabase.from('dsc_collections').select('*').in('day_id', dayIds),
  ]);

  // Build summary rows per day
  return days.map((day) => {
    const dayPurchases = (purchases ?? []).filter((p) => p.day_id === day.id);
    const dayInvoices = (invoices ?? []).filter((i) => i.day_id === day.id);
    const dayDr = (drItems ?? []).filter((d) => d.day_id === day.id);
    const dayOts = (otsItems ?? []).filter((o) => o.day_id === day.id);
    const dayAr = (arEntries ?? []).filter((a) => a.day_id === day.id);
    const dayColl = (collections ?? []).filter((c) => c.day_id === day.id);

    const totalInvoiceA = dayInvoices
      .filter((i) => i.series === 'A' && !i.is_cancelled)
      .reduce((sum, i) => sum + Number(i.qty) * Number(i.unit_price), 0);
    const totalInvoiceB = dayInvoices
      .filter((i) => i.series === 'B' && !i.is_cancelled)
      .reduce((sum, i) => sum + Number(i.qty) * Number(i.unit_price), 0);
    const totalDr = dayDr.reduce((sum, d) => sum + Number(d.qty) * Number(d.unit_price), 0);
    const totalOts = dayOts.reduce((sum, o) => sum + Number(o.qty) * Number(o.unit_price), 0);
    const totalSales = totalInvoiceA + totalInvoiceB + totalDr + totalOts;

    const p1Total = dayPurchases.filter((p) => p.batch === 1).reduce((s, p) => s + Number(p.amount), 0);
    const p2Total = dayPurchases.filter((p) => p.batch === 2).reduce((s, p) => s + Number(p.amount), 0);
    const p3Total = dayPurchases.filter((p) => p.batch === 3).reduce((s, p) => s + Number(p.amount), 0);

    const arCash = dayAr.filter((a) => a.ar_type === 'cash').reduce((s, a) => s + Number(a.amount), 0);
    const arGcash = dayAr.filter((a) => a.ar_type === 'gcash').reduce((s, a) => s + Number(a.amount), 0);
    const arDr = dayAr.filter((a) => a.ar_type === 'dr').reduce((s, a) => s + Number(a.amount), 0);
    const ar2 = dayAr.filter((a) => a.ar_type === 'ar2').reduce((s, a) => s + Number(a.amount), 0);

    const collCash = dayColl.filter((c) => c.collection_type === 'cash').reduce((s, c) => s + Number(c.amount), 0);
    const collGcash = dayColl.filter((c) => c.collection_type === 'gcash').reduce((s, c) => s + Number(c.amount), 0);
    const collPsb = dayColl.filter((c) => c.collection_type === 'bank_psb').reduce((s, c) => s + Number(c.amount), 0);
    const collMbtc = dayColl.filter((c) => c.collection_type === 'bank_mbtc').reduce((s, c) => s + Number(c.amount), 0);
    const collCheque = dayColl.filter((c) => c.collection_type === 'cheque').reduce((s, c) => s + Number(c.amount), 0);
    const collZaldy = dayColl.filter((c) => c.collection_type === 'zaldy').reduce((s, c) => s + Number(c.amount), 0);
    const collCashplus = dayColl.filter((c) => c.collection_type === 'cashplus').reduce((s, c) => s + Number(c.amount), 0);
    const collMilcorp = dayColl.filter((c) => c.collection_type === 'milcorp').reduce((s, c) => s + Number(c.amount), 0);
    const totalDeposit = collCash + collGcash + collPsb + collMbtc + collCheque + collZaldy + collCashplus + collMilcorp;

    const netSales = totalSales - arDr;

    return {
      date: day.date,
      cash: collCash,
      cash_out: 0,
      chq_sales: collCheque,
      gcash: collGcash,
      bank_transfer: collPsb + collMbtc,
      p1_3rv1: 0, p1_3rv2: 0, p1_emc1: 0, p1_mc: 0, p1_repack: 0, p1_others: 0,
      total_purchases_1: p1Total,
      p2_3rv1: 0, p2_3rv2: 0, p2_emc1: 0, p2_emc2: 0,
      total_purchases_2: p2Total,
      total_purchases_3: p3Total,
      expenses: 0,
      mda: 0,
      sa_withdrawal: 0,
      bir_check: 0,
      salary_check: 0,
      ar_mc_salary: 0,
      ar_cash_3rv1: 0, ar_cash_3rv2: 0, ar_cash_emc1: 0, ar_cash_edna: 0, ar_cash_misc: 0,
      total_ar_cash: arCash,
      ar1_emc2: 0, ar1_emc1: 0, ar1_3rv1: 0, ar1_3rv2: 0, ar1_ate_edna: 0, ar1_others: 0,
      total_ar1: arDr,
      ar2: ar2,
      ar2_others: 0,
      total_sales: totalSales,
      net_sales: netSales,
      coll_cash: collCash,
      coll_gcash: collGcash,
      coll_bank_psb: collPsb,
      coll_bank_mbtc: collMbtc,
      coll_cheque: collCheque,
      coll_zaldy: collZaldy,
      coll_cashplus: collCashplus,
      coll_milcorp: collMilcorp,
      total_deposit: totalDeposit,
      receipt: 0,
      unrecorded_short: 0,
    } satisfies DscMonthlySummaryRow;
  });
}

export function useDscMonthlySummary(year: number, month: number, branchId: string) {
  return useQuery({
    queryKey: dscKeys.monthly(year, month, branchId),
    queryFn: () => fetchMonthlySummary(year, month, branchId),
    enabled: Boolean(year && month && branchId),
  });
}
