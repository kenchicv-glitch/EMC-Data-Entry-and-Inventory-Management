import { useState } from 'react';
import { useTaxData } from './hooks/useTaxData';
import {
    Calculator, Receipt, Download, FileText, TrendingUp,
    ArrowUpRight, ArrowDownRight, Calendar,
    Percent, ShieldCheck, AlertCircle, Loader2
} from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrency, formatDate } from '../../shared/lib/formatUtils';
import { exportBIRSalesJournal, exportBIRSummaryWorksheet } from '../../shared/lib/exportUtils';

/**
 * TaxDashboard: Pre-calculates BIR-required figures (Form 2550M/Q, 1701Q/1702Q)
 */
export default function TaxDashboard() {
    const [dateRange, setDateRange] = useState({
        start: formatDate(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: formatDate(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    const { sales, metrics, isLoading } = useTaxData(dateRange);

    if (isLoading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={40} className="text-brand-red animate-spin" />
                    <p className="text-sm text-text-muted font-black uppercase tracking-widest">Compiling Tax Records...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-10 bg-bg-base">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-bg-surface rounded-[24px] flex items-center justify-center shadow-xl border border-border-muted group">
                        <Calculator className="text-brand-red group-hover:scale-110 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">Tax Dashboard</h1>
                        <p className="text-sm text-text-secondary mt-1 font-medium">BIR Compliance Pre-calculations (VAT & Income Tax)</p>
                    </div>
                </div>

                <div className="bg-bg-surface p-2 rounded-2xl shadow-sm border border-border-muted flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3">
                        <Calendar size={14} className="text-text-muted" />
                        <input
                            type="date"
                            className="text-xs font-black uppercase outline-none bg-transparent text-text-primary"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <span className="text-text-muted/30">→</span>
                        <input
                            type="date"
                            className="text-xs font-black uppercase outline-none bg-transparent text-text-primary"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>
                </div>
            </div>

            {/* BIR Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* VAT Summary */}
                <div className="md:col-span-2 bg-bg-surface rounded-[32px] border border-border-muted shadow-sm p-8 space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center text-brand-red"><Percent size={20} /></div>
                            <h3 className="text-lg font-black text-text-primary uppercase tracking-tight">VAT Summary (Form 2550M/Q)</h3>
                        </div>
                        <button
                            onClick={() => metrics && exportBIRSalesJournal(sales || [])}
                            className="flex items-center gap-2 text-[10px] font-black text-brand-red uppercase tracking-widest hover:underline"
                        >
                            <Download size={14} /> Export Journal
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 bg-bg-subtle rounded-2xl border border-border-muted flex flex-col justify-between">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">Total Output VAT (Sales)</p>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-black text-text-primary font-data">{formatCurrency(metrics?.outputVat)}</p>
                                <ArrowUpRight className="text-emerald-500" size={24} />
                            </div>
                        </div>
                        <div className="p-6 bg-bg-subtle rounded-2xl border border-border-muted flex flex-col justify-between">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">Total Input VAT (Purchases)</p>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-black text-text-primary font-data">{formatCurrency(metrics?.inputVat)}</p>
                                <ArrowDownRight className="text-amber-500" size={24} />
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-text-primary rounded-[32px] text-bg-base flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-red/20 rounded-full blur-2xl -mr-16 -mt-16" />
                        <div>
                            <p className="text-[10px] font-black text-bg-base/40 uppercase tracking-[0.3em] mb-2">VAT PAYABLE / (REFUNDABLE)</p>
                            <p className="text-4xl font-black font-data">{formatCurrency(metrics?.vatPayable)}</p>
                        </div>
                        <div className="flex flex-col items-end text-right">
                            <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                <ShieldCheck size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">BIR-Ready Basis</span>
                            </div>
                            <p className="text-[9px] text-bg-base/50 font-medium max-w-[200px]">Exclude discounts from taxable base as per RR 7-2010 for Senior/PWD.</p>
                        </div>
                    </div>
                </div>

                {/* Sales Basis Card */}
                <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm p-8 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500"><TrendingUp size={20} /></div>
                        <h3 className="text-[12px] font-black text-text-primary uppercase tracking-tight text-center">Income Tax Basis (1701Q)</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-border-muted/50">
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Gross Sales</span>
                            <span className="text-sm font-black text-text-primary font-data">{formatCurrency(metrics?.grossSales)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border-muted/50 text-emerald-500">
                            <span className="text-[10px] font-black uppercase tracking-widest">VATable Sales (Net)</span>
                            <span className="text-sm font-black font-data">{formatCurrency((metrics?.vatableSales || 0) - (metrics?.outputVat || 0))}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border-muted/50 text-amber-500">
                            <span className="text-[10px] font-black uppercase tracking-widest">Exempt Sales</span>
                            <span className="text-sm font-black font-data">{formatCurrency(metrics?.exemptSales)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border-muted/50 text-blue-500">
                            <span className="text-[10px] font-black uppercase tracking-widest">Zero-Rated Sales</span>
                            <span className="text-sm font-black font-data">{formatCurrency(metrics?.zeroRatedSales)}</span>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            onClick={() => metrics && exportBIRSummaryWorksheet(metrics)}
                            className="w-full py-4 bg-bg-subtle border border-border-muted rounded-2xl text-[10px] font-black text-text-primary uppercase tracking-widest hover:opacity-80 transition-all flex items-center justify-center gap-2"
                        >
                            <FileText size={14} /> DOWNLOAD SUMMARY
                        </button>
                    </div>
                </div>
            </div>

            {/* OR Summary Table */}
            <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm overflow-hidden">
                <div className="px-8 py-6 bg-bg-subtle/50 border-b border-border-muted flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Receipt className="text-text-primary" size={18} />
                        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">Official Receipt Summary (Sales Journal)</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-bg-surface border border-border-muted rounded-full text-[9px] font-black text-brand-red uppercase tracking-widest">Audit Trail: ON</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-bg-surface border-b border-border-muted">
                                <th className="px-8 py-4 text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Date</th>
                                <th className="px-8 py-4 text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">OR #</th>
                                <th className="px-8 py-4 text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Classification</th>
                                <th className="px-8 py-4 text-[9px] font-black text-text-muted uppercase tracking-[0.2em] text-right">Gross</th>
                                <th className="px-8 py-4 text-[9px] font-black text-text-muted uppercase tracking-[0.2em] text-right">Output VAT</th>
                                <th className="px-8 py-4 text-[9px] font-black text-text-muted uppercase tracking-[0.2em] text-right">Net Sales</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-muted">
                             {sales?.map((sale) => (
                                 <tr key={sale.id} className="hover:bg-bg-subtle transition-all group">
                                     <td className="px-8 py-4 text-[11px] font-bold text-text-secondary font-data">{formatDate(sale.date, 'MM/dd/yyyy')}</td>
                                     <td className="px-8 py-4 text-[11px] font-black text-text-primary uppercase font-data">{sale.or_number || 'N/A'}</td>
                                     <td className="px-8 py-4">
                                         <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${sale.vat_classification === 'vatable' ? 'bg-emerald-500/10 text-emerald-500' :
                                             sale.vat_classification === 'exempt' ? 'bg-purple-500/10 text-purple-600' : 'bg-blue-500/10 text-blue-500'
                                             }`}>
                                             {sale.vat_classification}
                                         </span>
                                     </td>
                                     <td className="px-8 py-4 text-right text-[11px] font-bold text-text-primary font-data">{formatCurrency(sale.total_price)}</td>
                                     <td className="px-8 py-4 text-right text-[11px] font-bold text-brand-red font-data">{formatCurrency(sale.vat_amount)}</td>
                                     <td className="px-8 py-4 text-right text-[11px] font-black text-text-primary font-data">{formatCurrency(Number(sale.total_price) - Number(sale.vat_amount || 0))}</td>
                                 </tr>
                             ))}
                            {(!sales || sales.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <AlertCircle size={32} className="text-text-muted/30" />
                                            <p className="text-xs font-black text-text-muted uppercase tracking-widest">No sales records for this period.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
