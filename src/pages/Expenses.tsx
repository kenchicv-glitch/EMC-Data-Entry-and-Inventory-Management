import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Wallet, Plus, Search, Filter, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import ExpenseModal from '../components/ExpenseModal';
import { useAuth } from '../lib/AuthContext';
import Calendar from '../components/Calendar';

interface Expense {
    id: string;
    category: 'Salary' | 'Donation' | 'Others';
    description: string;
    amount: number;
    date: string;
    invoice_number: string;
}

export default function Expenses() {
    const { role } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const fetchExpenses = async (silent = false) => {
        if (!silent) setLoading(true);
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });

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
    }, []);

    const filtered = expenses.filter(ex => {
        const matchesSearch =
            ex.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ex.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ex.category.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = categoryFilter === 'All' || ex.category === categoryFilter;
        const matchesDate = isSameDay(new Date(ex.date), selectedDate);

        return matchesSearch && matchesCategory && matchesDate;
    });

    const activeDates = Array.from(new Set(expenses.map(ex => format(new Date(ex.date), 'yyyy-MM-dd'))));
    const totalExpenses = filtered.reduce((sum, ex) => sum + ex.amount, 0);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-brand-charcoal tracking-tight flex items-center gap-3 font-data uppercase">
                        <div className="w-12 h-12 bg-brand-charcoal rounded-2xl flex items-center justify-center shadow-sm">
                            <Wallet className="text-white" size={24} />
                        </div>
                        Operating Expenses
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Track daily payouts, salaries, and donations</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95"
                    >
                        <Plus size={18} /> RECORD EXPENSE
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search description, category, or ref..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-600 appearance-none shadow-sm focus:ring-2 focus:ring-brand-red/20 outline-none"
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
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 border-b border-slate-50 pb-3 mb-4 uppercase tracking-[0.2em]">Summary Statistics</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Total</p>
                                    <p className="text-xl font-black text-brand-red font-data">
                                        ₱{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaction Count</p>
                                    <p className="text-xl font-black text-brand-charcoal font-data">{filtered.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main List */}
                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest w-10"></th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Reference / Time</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                {[...Array(6)].map((_, j) => (
                                                    <td key={j} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : filtered.length > 0 ? (
                                        filtered.map((ex) => (
                                            <tr key={ex.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-5">
                                                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                                        <Wallet size={14} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="text-[10px] font-black text-brand-charcoal font-data uppercase">{ex.invoice_number || 'N/A'}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(ex.date), 'hh:mm a')}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ex.category === 'Salary' ? 'bg-blue-50 text-blue-600' :
                                                        ex.category === 'Donation' ? 'bg-purple-50 text-purple-600' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {ex.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-sm font-bold text-slate-600">
                                                    {ex.description}
                                                </td>
                                                <td className="px-6 py-5 text-right font-data font-black text-brand-red">
                                                    ₱{ex.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-5">
                                                    {role === 'admin' && (
                                                        <button
                                                            onClick={() => handleDelete(ex.id)}
                                                            className="p-2 text-slate-200 hover:text-brand-red hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                        <CalendarIcon size={32} className="text-slate-200" />
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-bold text-slate-400 italic">No expenses recorded for this date.</p>
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
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => fetchExpenses(true)}
            />
        </div>
    );
}
