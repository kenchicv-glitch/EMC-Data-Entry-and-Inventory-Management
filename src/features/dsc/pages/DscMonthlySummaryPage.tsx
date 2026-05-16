import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, ArrowLeft, FileDown } from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useDscMonthlySummary } from '../hooks/useDscMonthlySummary';
import { exportDscMonthlyToExcel } from '../services/dscExportService';


export default function DscMonthlySummaryPage() {
  const navigate = useNavigate();
  const { activeBranchId } = useBranch();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;

  const { data: rows = [], isLoading } = useDscMonthlySummary(year, month, activeBranchId || '');

  const handleExport = async () => {
    if (rows.length > 0) {
      await exportDscMonthlyToExcel(rows, year, month);
    }
  };

  const fmt = (n: number) => n ? n.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-';

  // Compute totals
  const totals = rows.reduce(
    (acc, row) => {
      acc.total_purchases_1 += row.total_purchases_1;
      acc.total_purchases_2 += row.total_purchases_2;
      acc.total_purchases_3 += row.total_purchases_3;
      acc.total_ar_cash += row.total_ar_cash;
      acc.total_ar1 += row.total_ar1;
      acc.ar2 += row.ar2;
      acc.total_sales += row.total_sales;
      acc.net_sales += row.net_sales;
      acc.coll_cash += row.coll_cash;
      acc.coll_gcash += row.coll_gcash;
      acc.coll_bank_psb += row.coll_bank_psb;
      acc.coll_bank_mbtc += row.coll_bank_mbtc;
      acc.coll_cheque += row.coll_cheque;
      acc.coll_zaldy += row.coll_zaldy;
      acc.coll_cashplus += row.coll_cashplus;
      acc.coll_milcorp += row.coll_milcorp;
      acc.total_deposit += row.total_deposit;
      acc.cash += row.cash;
      acc.chq_sales += row.chq_sales;
      acc.gcash += row.gcash;
      acc.bank_transfer += row.bank_transfer;
      return acc;
    },
    {
      total_purchases_1: 0, total_purchases_2: 0, total_purchases_3: 0,
      total_ar_cash: 0, total_ar1: 0, ar2: 0,
      total_sales: 0, net_sales: 0,
      coll_cash: 0, coll_gcash: 0, coll_bank_psb: 0, coll_bank_mbtc: 0,
      coll_cheque: 0, coll_zaldy: 0, coll_cashplus: 0, coll_milcorp: 0,
      total_deposit: 0, cash: 0, chq_sales: 0, gcash: 0, bank_transfer: 0,
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dsc')} className="p-2.5 rounded-xl bg-bg-subtle hover:bg-bg-muted border border-border-default text-text-muted hover:text-text-primary transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-text-primary uppercase tracking-tight">Monthly Summary</h1>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-0.5">EMC3 DSC</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-2 rounded-xl hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-tight min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-2 rounded-xl hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
            <ChevronRight size={18} />
          </button>
          <button onClick={handleExport} disabled={rows.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors shadow-red disabled:opacity-50">
            <FileDown size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bento-card overflow-hidden">
        {isLoading ? (
          <div className="skeleton h-64 rounded-xl m-4" />
        ) : rows.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-12">No data for this month.</p>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-[11px] whitespace-nowrap">
              <thead>
                <tr className="bg-bg-subtle border-b border-border-default">
                  <th className="sticky left-0 z-10 bg-bg-subtle px-3 py-2 text-left font-black text-text-muted uppercase tracking-widest">Date</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest">Cash</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest">CHQ</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest">GCash</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest">Bank</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-brand-red/5">P1</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-brand-red/5">P2</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-brand-red/5">P3</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest">AR Cash</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest">AR DR</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest">AR2</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-green-50">Sales</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-green-50">Net</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">C.Cash</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">C.GC</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">PSB</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">MBTC</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">CHQ</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">Zaldy</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">Cash+</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">Milcorp</th>
                  <th className="px-2 py-2 text-right font-black text-text-muted uppercase tracking-widest bg-blue-50">Total Dep</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date} className="border-b border-border-default hover:bg-bg-subtle transition-colors cursor-pointer" onClick={() => navigate(`/dsc/${row.date}`)}>
                    <td className="sticky left-0 z-10 bg-bg-surface px-3 py-2 font-bold font-data">{row.date}</td>
                    <td className="px-2 py-2 text-right font-data">{fmt(row.cash)}</td>
                    <td className="px-2 py-2 text-right font-data">{fmt(row.chq_sales)}</td>
                    <td className="px-2 py-2 text-right font-data">{fmt(row.gcash)}</td>
                    <td className="px-2 py-2 text-right font-data">{fmt(row.bank_transfer)}</td>
                    <td className="px-2 py-2 text-right font-data bg-brand-red/5">{fmt(row.total_purchases_1)}</td>
                    <td className="px-2 py-2 text-right font-data bg-brand-red/5">{fmt(row.total_purchases_2)}</td>
                    <td className="px-2 py-2 text-right font-data bg-brand-red/5">{fmt(row.total_purchases_3)}</td>
                    <td className="px-2 py-2 text-right font-data">{fmt(row.total_ar_cash)}</td>
                    <td className="px-2 py-2 text-right font-data">{fmt(row.total_ar1)}</td>
                    <td className="px-2 py-2 text-right font-data">{fmt(row.ar2)}</td>
                    <td className="px-2 py-2 text-right font-data font-bold bg-green-50">{fmt(row.total_sales)}</td>
                    <td className="px-2 py-2 text-right font-data font-bold bg-green-50">{fmt(row.net_sales)}</td>
                    <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(row.coll_cash)}</td>
                    <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(row.coll_gcash)}</td>
                    <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(row.coll_bank_psb)}</td>
                    <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(row.coll_bank_mbtc)}</td>
                    <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(row.coll_cheque)}</td>
                    <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(row.coll_zaldy)}</td>
                    <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(row.coll_cashplus)}</td>
                    <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(row.coll_milcorp)}</td>
                    <td className="px-2 py-2 text-right font-data font-bold bg-blue-50">{fmt(row.total_deposit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-bg-muted border-t-2 border-border-strong font-bold">
                  <td className="sticky left-0 z-10 bg-bg-muted px-3 py-2 font-black uppercase tracking-widest text-text-primary">Total</td>
                  <td className="px-2 py-2 text-right font-data">{fmt(totals.cash)}</td>
                  <td className="px-2 py-2 text-right font-data">{fmt(totals.chq_sales)}</td>
                  <td className="px-2 py-2 text-right font-data">{fmt(totals.gcash)}</td>
                  <td className="px-2 py-2 text-right font-data">{fmt(totals.bank_transfer)}</td>
                  <td className="px-2 py-2 text-right font-data bg-brand-red/5">{fmt(totals.total_purchases_1)}</td>
                  <td className="px-2 py-2 text-right font-data bg-brand-red/5">{fmt(totals.total_purchases_2)}</td>
                  <td className="px-2 py-2 text-right font-data bg-brand-red/5">{fmt(totals.total_purchases_3)}</td>
                  <td className="px-2 py-2 text-right font-data">{fmt(totals.total_ar_cash)}</td>
                  <td className="px-2 py-2 text-right font-data">{fmt(totals.total_ar1)}</td>
                  <td className="px-2 py-2 text-right font-data">{fmt(totals.ar2)}</td>
                  <td className="px-2 py-2 text-right font-data bg-green-50">{fmt(totals.total_sales)}</td>
                  <td className="px-2 py-2 text-right font-data bg-green-50">{fmt(totals.net_sales)}</td>
                  <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(totals.coll_cash)}</td>
                  <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(totals.coll_gcash)}</td>
                  <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(totals.coll_bank_psb)}</td>
                  <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(totals.coll_bank_mbtc)}</td>
                  <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(totals.coll_cheque)}</td>
                  <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(totals.coll_zaldy)}</td>
                  <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(totals.coll_cashplus)}</td>
                  <td className="px-2 py-2 text-right font-data bg-blue-50">{fmt(totals.coll_milcorp)}</td>
                  <td className="px-2 py-2 text-right font-data font-bold bg-blue-50">{fmt(totals.total_deposit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
