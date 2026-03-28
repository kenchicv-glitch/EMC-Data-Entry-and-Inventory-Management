import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { X, FileText, Download, AlertTriangle, Loader2 } from 'lucide-react';
import Calendar from './Calendar';
import { exportToCSV } from '../../../shared/lib/exportUtils';
import { ReportService } from '../services/reportService';
import { formatDate } from '../../../shared/lib/formatUtils';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ReportModal({ isOpen, onClose }: ReportModalProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]);

    const generateReport = async () => {
        setLoading(true);
        setError(null);

        const dateStr = formatDate(selectedDate, 'yyyy-MM-dd');
        const displayDate = formatDate(selectedDate, 'MMMM dd, yyyy');

        try {
            // Fetch Sales
            const { data: sales, error: salesError } = await supabase
                .from('sales')
                .select('invoice_number, total_price, quantity, date, products(name)')
                .gte('date', `${dateStr}T00:00:00`)
                .lte('date', `${dateStr}T23:59:59`);

            if (salesError) throw salesError;

            // Fetch Expenses
            const { data: expenses, error: expensesError } = await supabase
                .from('expenses')
                .select('category, amount, description, date')
                .gte('date', `${dateStr}T00:00:00`)
                .lte('date', `${dateStr}T23:59:59`);

            if (expensesError) throw expensesError;

            // Fetch Purchases
            const { data: purchases, error: purchasesError } = await supabase
                .from('purchases')
                .select('total_price, quantity, date, products(name)')
                .gte('date', `${dateStr}T00:00:00`)
                .lte('date', `${dateStr}T23:59:59`);

            if (purchasesError) throw purchasesError;

            const reportData = ReportService.prepareDailyReport(
                displayDate,
                sales || [],
                purchases || [],
                expenses || []
            );

            exportToCSV(reportData, `Daily_Report_${dateStr}`);
        } catch (err) {
            console.error('Error generating report:', err);
            setError(err instanceof Error ? err.message : 'Error generating report');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
            <div className="w-full max-w-lg rounded-[32px] bg-surface shadow-2xl border border-border-default flex flex-col animate-slide-up overflow-hidden">
                <div className="flex items-center justify-between px-8 py-6 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center shadow-lg shadow-brand-red/20">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-widest">Daily Report</h2>
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Generate summary CSV</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-shake">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Select Report Date</label>
                        <div className="p-2 bg-subtle rounded-3xl border border-border-default">
                            <Calendar
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-brand-charcoal/5 rounded-3xl border border-brand-charcoal/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Report Focus</p>
                            <span className="px-3 py-1 bg-brand-red/10 text-brand-red text-[9px] font-black rounded-full uppercase">All Active Modules</span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed font-medium">
                            Generating a report will compile all <span className="font-bold text-text-primary">Sales</span>,
                            <span className="font-bold text-text-primary ml-1">Expenses</span>, and
                            <span className="font-bold text-text-primary ml-1">Purchases</span> for the selected date into a detailed CSV document.
                        </p>
                    </div>
                </div>

                <div className="p-8 bg-subtle border-t border-border-default flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-text-secondary font-bold text-xs uppercase tracking-widest hover:text-text-primary transition-colors bg-surface rounded-2xl border border-border-strong"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={generateReport}
                        disabled={loading}
                        className="flex-[2] py-4 bg-brand-charcoal text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand-charcoal/20 hover:bg-brand-red transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Download size={16} />
                        )}
                        {loading ? 'Compiling...' : 'Generate Report'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
