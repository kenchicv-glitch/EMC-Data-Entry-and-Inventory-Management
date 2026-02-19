import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { X, FileText, Download, AlertTriangle, Loader2 } from 'lucide-react';
import Calendar from './Calendar';
import { exportToCSV } from '../lib/exportUtils';

interface ReportRow {
    Section?: string;
    Detail?: string;
    Amount?: string | number;
    Info?: string;
}

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ReportModal({ isOpen, onClose }: ReportModalProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateReport = async () => {
        setLoading(true);
        setError(null);

        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        try {
            // Fetch Sales
            const { data: sales, error: salesError } = await supabase
                .from('sales')
                .select('invoice_number, total_price, quantity, date, products(name, sku)')
                .gte('date', dateStr)
                .lte('date', dateStr);

            if (salesError) throw salesError;

            // Fetch Purchases
            const { data: purchases, error: purchasesError } = await supabase
                .from('purchases')
                .select('invoice_number, total_price, discount_amount, date')
                .gte('date', dateStr)
                .lte('date', dateStr);

            if (purchasesError) throw purchasesError;

            // Fetch Expenses
            const { data: expenses, error: expensesError } = await supabase
                .from('expenses')
                .select('invoice_number, category, description, amount, date')
                .gte('date', dateStr)
                .lte('date', dateStr);

            if (expensesError) throw expensesError;

            // Fetch Refunds & Returns
            const { data: refunds, error: refundsError } = await supabase
                .from('customer_refunds')
                .select('invoice_number, total_price, date')
                .gte('date', dateStr)
                .lte('date', dateStr);

            if (refundsError) throw refundsError;

            const { data: returns, error: returnsError } = await supabase
                .from('supplier_returns')
                .select('invoice_number, total_price, date')
                .gte('date', dateStr)
                .lte('date', dateStr);

            if (returnsError) throw returnsError;

            // Process report data
            const reportData: ReportRow[] = [];
            reportData.push({ Section: 'REPORT SUMMARY', Detail: `Generated on: ${format(new Date(), 'PPP p')}`, Amount: '', Info: '' });
            reportData.push({ Section: 'DATE RANGE', Detail: format(selectedDate, 'PPPP'), Amount: '', Info: '' });
            reportData.push({});

            // Sales
            reportData.push({ Section: 'SALES', Detail: 'Description', Amount: 'Value', Info: 'Invoice' });
            (sales || []).forEach((s: any) => {
                reportData.push({
                    Section: 'Sale',
                    Detail: s.products?.name || 'Unknown Item',
                    Amount: s.total_price,
                    Info: s.invoice_number
                });
            });
            const totalSalesValue = (sales || []).reduce((acc: number, cur: any) => acc + (cur.total_price || 0), 0);
            reportData.push({ Section: 'TOTAL SALES', Detail: '', Amount: totalSalesValue, Info: '' });
            reportData.push({});

            // Purchases
            reportData.push({ Section: 'PURCHASES', Detail: 'Source', Amount: 'Value', Info: 'Ref #' });
            (purchases || []).forEach((p: any) => {
                reportData.push({
                    Section: 'Purchase',
                    Detail: 'Stock Inward',
                    Amount: (p.total_price || 0) - (p.discount_amount || 0),
                    Info: p.invoice_number
                });
            });
            const totalPurchasesValue = (purchases || []).reduce((acc: number, cur: any) => acc + ((cur.total_price || 0) - (cur.discount_amount || 0)), 0);
            reportData.push({ Section: 'TOTAL PURCHASES', Detail: '', Amount: totalPurchasesValue, Info: '' });
            reportData.push({});

            // Expenses
            reportData.push({ Section: 'EXPENSES', Detail: 'Description', Amount: 'Value', Info: 'Voucher' });
            (expenses || []).forEach((e: any) => {
                reportData.push({
                    Section: 'Expense',
                    Detail: `${e.category}: ${e.description}`,
                    Amount: e.amount,
                    Info: e.invoice_number
                });
            });
            const totalExpensesValue = (expenses || []).reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0);
            reportData.push({ Section: 'TOTAL EXPENSES', Detail: '', Amount: totalExpensesValue, Info: '' });
            reportData.push({});

            // Refunds
            const totalRefundsValue = (refunds || []).reduce((acc: number, cur: any) => acc + (cur.total_price || 0), 0);
            if (totalRefundsValue > 0) {
                reportData.push({ Section: 'REFUNDS', Detail: 'Sales Returns', Amount: totalRefundsValue, Info: '' });
                reportData.push({});
            }

            // Returns
            const totalReturnsValue = (returns || []).reduce((acc: number, cur: any) => acc + (cur.total_price || 0), 0);
            if (totalReturnsValue > 0) {
                reportData.push({ Section: 'RETURNS', Detail: 'Supplier Returns', Amount: totalReturnsValue, Info: '' });
                reportData.push({});
            }

            // Final Calculation: Net = Sales - Purchases - Expenses - Refunds + Returns (Cost recovery on returns)
            // Simplified Net Cash Flow: (Sales - Refunds) - (Purchases - Returns) - Expenses
            const netCashFlow = (totalSalesValue - totalRefundsValue) - (totalPurchasesValue - totalReturnsValue) - totalExpensesValue;

            reportData.push({ Section: 'NET PERFORMANCE', Detail: '(Net Sales - Net Purchases - Expenses)', Amount: netCashFlow, Info: '' });

            exportToCSV(reportData, `Daily_Report_${dateStr}`);
            onClose();
        } catch (err: any) {
            console.error('Report Generation Error:', err);
            setError(err.message || String(err) || 'An error occurred while generating the report');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg rounded-[32px] bg-white shadow-2xl border border-slate-100 flex flex-col animate-slide-up overflow-hidden">
                <div className="flex items-center justify-between px-8 py-6 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-10 h-10 bg-brand-red rounded-2xl flex items-center justify-center shadow-lg"><FileText size={20} /></div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-tight">Generate Report</h2>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Custom Inventory Analysis</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>

                <div className="p-8 space-y-8 flex flex-col items-center">
                    {error && (
                        <div className="w-full p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-3">
                            <AlertTriangle size={18} /> {error}
                        </div>
                    )}

                    <div className="w-full flex justify-center">
                        <Calendar
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                        />
                    </div>

                    <div className="w-full text-center">
                        <p className="text-sm font-bold text-slate-700 mb-2">Selected Date</p>
                        <p className="text-2xl font-black text-brand-red font-data tracking-tight">{format(selectedDate, 'MMMM d, yyyy')}</p>
                    </div>
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button type="button" onClick={onClose} className="text-sm font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">Cancel</button>
                    <button
                        onClick={generateReport}
                        disabled={loading}
                        className="flex items-center gap-3 px-10 py-4 bg-brand-charcoal text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {loading ? 'Generating...' : 'Export XLS'}
                    </button>
                </div>
            </div>
        </div>
    );
}
