import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { Wallet, Plus, Search, Filter, Trash2, Calendar as CalendarIcon, Edit3 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import ExpenseModal from './components/ExpenseModal';
import { useAuth } from '../../shared/hooks/useAuth';
import Calendar from '../../features/reports/components/Calendar';
import { useBranch } from '../../shared/hooks/useBranch';

import { type Expense } from '../../shared/types';

export default function Expenses() {
    const { role } = useAuth();
    const { activeBranchId } = useBranch();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [editExpense, setEditExpense] = useState<Expense>();

    const fetchExpenses = async (silent = false) => {
        if (!silent) setLoading(true);
        let query = supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });

        if (activeBranchId) {
            query = query.eq('branch_id', activeBranchId);
        }

        const { data, error } = await query;

        if (error) console.error('Error fetching expenses:', error);
        else setExpenses(data || []);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this expense record?')) return;
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else fetchExpenses();
    };

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await fetchExpenses();
        };
        load();

        const channel = supabase
            .channel('expense_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'expenses' },
                () => { if (mounted) fetchExpenses(true); }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [activeBranchId]);

    const filtered = expenses.filter(ex => {
        const matchesSearch =
            (ex.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ex.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            ex.category.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = categoryFilter === 'All' || ex.category === categoryFilter;
        const matchesDate = isSameDay(new Date(ex.date || ''), selectedDate);

        return matchesSearch && matchesCategory && matchesDate;
    });

    const activeDates = Array.from(new Set(expenses.map(ex => format(new Date(ex.date || ''), 'yyyy-MM-dd'))));
    const totalExpenses = filtered.reduce((sum, ex) => sum + ex.amount, 0);

    return (
        <div className="space-y-8 animate-fade-in pb-10 bg-base">
            {/* Standard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-surface rounded-[24px] flex items-center justify-center shadow-xl border border-border-default group transition-all hover:scale-105 active:scale-95">
                        <Wallet className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">Operating Expenses</h1>
                        <p className="text-sm text-text-secondary mt-1 font-medium">Track daily payouts, salaries, and donations</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-text-primary text-text-inverse px-6 py-3 rounded-2xl font-black text-sm hover:opacity-90 transition-all shadow-lg active:scale-95"
                    >
                        <Plus size={18} /> RECORD EXPENSE
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search description, category, or ref..."
                        className="w-full pl-12 pr-4 py-3 bg-surface border border-border-default rounded-2xl text-sm text-text-primary focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <select
                        className="w-full bg-surface border border-border-default rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-text-secondary appearance-none shadow-sm focus:ring-2 focus:ring-brand-red/20 outline-none"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="All">All Categories</option>
                        <option value="Salary">Salaries</option>
                        <option value="Donation">Donations</option>
                        <option value="Others">Others</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Calendar */}
                <div className="flex-shrink-0">
                    <div className="sticky top-6 space-y-4">
                        <Calendar
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                            activeDates={activeDates}
                        />
                        <div className="bg-surface p-6 rounded-3xl border border-border-default shadow-sm">
                            <h3 className="text-[10px] font-black text-text-muted border-b border-border-default pb-3 mb-4 uppercase tracking-[0.2em]">Summary Statistics</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Daily Total</p>
                                    <p className="text-xl font-black text-brand-red font-data">
                                        ₱{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Transaction Count</p>
                                    <p className="text-xl font-black text-text-primary font-data">{filtered.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main List */}
                <div className="flex-1 min-w-0">
                    <div className="bg-surface rounded-[32px] border border-border-default shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-subtle/50 border-b border-border-default">
                                        <th className="px-6 py-4 text-[11px] font-black text-text-primary uppercase tracking-widest w-10"></th>
                                        <th className="px-6 py-4 text-[11px] font-black text-text-primary uppercase tracking-widest">Time</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-text-primary uppercase tracking-widest">Category</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-text-primary uppercase tracking-widest">Description</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-text-primary uppercase tracking-widest text-right">Amount</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-text-primary uppercase tracking-widest w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-default">
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                {[...Array(6)].map((_, j) => (
                                                    <td key={j} className="px-6 py-8"><div className="h-4 bg-subtle rounded w-full"></div></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : filtered.length > 0 ? (
                                        filtered.map((ex) => (
                                            <tr key={ex.id} className="group hover:bg-subtle transition-colors">
                                                <td className="px-6 py-5">
                                                    <div className="w-8 h-8 bg-subtle rounded-lg flex items-center justify-center text-text-muted">
                                                        <Wallet size={14} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="text-[10px] font-black text-text-primary font-data uppercase">{format(new Date(ex.date || ''), 'hh:mm a')}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ex.category === 'Salary' ? 'bg-accent-subtle text-accent' :
                                                        ex.category === 'Donation' ? 'bg-purple-500/10 text-purple-600' :
                                                            'bg-subtle text-text-muted'
                                                        }`}>
                                                        {ex.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-sm font-bold text-text-secondary">
                                                    {ex.description}
                                                </td>
                                                <td className="px-6 py-5 text-right font-data font-black text-brand-red">
                                                    ₱{ex.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditExpense(ex);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="p-2 text-text-muted hover:text-brand-red hover:bg-subtle rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                        {role === 'owner' && (
                                                            <button
                                                                onClick={() => handleDelete(ex.id)}
                                                                className="p-2 text-text-muted hover:text-brand-red hover:bg-danger-subtle rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-16 h-16 bg-subtle rounded-full flex items-center justify-center">
                                                        <CalendarIcon size={32} className="text-text-muted" />
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-bold text-text-muted">No expenses recorded for this date.</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <ExpenseModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditExpense(undefined);
                }}
                onSuccess={() => fetchExpenses(true)}
                expense={editExpense}
            />
        </div>
    );
}
