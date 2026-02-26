import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    RefreshCw,
    History, Search
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import Calendar from '../components/Calendar';
import { ShoppingCart, ArrowDownRight, RotateCcw, Package } from 'lucide-react';

interface InventorySnap {
    id: string;
    name: string;
    opening: number;
    inwards: number;
    outwards: number;
    returns: number;
    ending: number;
}

export default function DailyInventorySummary() {
    const [summary, setSummary] = useState<InventorySnap[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Get ALL products (current state)
            const { data: products } = await supabase
                .from('products')
                .select('id, name, stock_available');

            if (!products) return;

            const targetStart = startOfDay(selectedDate);
            const targetEnd = endOfDay(selectedDate);

            // 2. Fetch ALL movements after the target date
            // Movements include: Sales (-), Purchases (+), Returns (-), Refunds (+)
            const afterStr = targetEnd.toISOString();
            const { data: sales } = await supabase.from('sales').select('product_id, quantity, date').gt('date', afterStr);
            const { data: purchases } = await supabase.from('purchases').select('product_id, quantity, date').eq('status', 'received').gt('date', afterStr);
            const { data: returns } = await supabase.from('supplier_returns').select('product_id, quantity, date').gt('date', afterStr);
            const { data: refunds } = await supabase.from('customer_refunds').select('product_id, quantity, date').gt('date', afterStr);

            // 3. Fetch movements FOR THE TARGET DATE (to show inwards/outwards)
            const isoTargetStart = targetStart.toISOString();
            const isoTargetEnd = targetEnd.toISOString();

            const { data: dSales } = await supabase.from('sales').select('product_id, quantity').gte('date', isoTargetStart).lte('date', isoTargetEnd);
            const { data: dPurchases } = await supabase.from('purchases').select('product_id, quantity').eq('status', 'received').gte('date', isoTargetStart).lte('date', isoTargetEnd);
            const { data: dReturns } = await supabase.from('supplier_returns').select('product_id, quantity').gte('date', isoTargetStart).lte('date', isoTargetEnd);
            const { data: dRefunds } = await supabase.from('customer_refunds').select('product_id, quantity').gte('date', isoTargetStart).lte('date', isoTargetEnd);

            const snaps: InventorySnap[] = products.map(p => {
                // Determine real-time stock
                const current = p.stock_available;

                // Adjust for movements AFTER the target date to get "Ending Balance" of target date
                // To get PAST balance: Past = Current - (Purchases - Sales - Returns + Refunds) ?? No.
                // Logic: 
                // Stock(Today) = Stock(Target) + In(AfterTarget) - Out(AfterTarget)
                // Stock(Target) = Stock(Today) - In(AfterTarget) + Out(AfterTarget)

                const salesAfter = sales?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const purchasesAfter = purchases?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const returnsAfter = returns?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const refundsAfter = refunds?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;

                // Move from TODAY back to END OF TARGET DATE
                const endingBalance = current + salesAfter - purchasesAfter + returnsAfter - refundsAfter;

                // Movements ON Target Date
                const inwards = dPurchases?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const outwards = (dSales?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0) +
                    (dReturns?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0);
                const refundsTotal = dRefunds?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;

                // Opening = Ending - In + Out - Refunds
                const opening = endingBalance - inwards + outwards - refundsTotal;

                return {
                    id: p.id,
                    name: p.name,
                    opening,
                    inwards,
                    outwards,
                    returns: refundsTotal,
                    ending: endingBalance
                };
            });

            setSummary(snaps);
        } catch (err) {
            console.error('Error calculating history:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const filtered = summary.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totals = useMemo(() => {
        return {
            in: filtered.reduce((a, b) => a + b.inwards, 0),
            out: filtered.reduce((a, b) => a + b.outwards, 0),
            returns: filtered.reduce((a, b) => a + b.returns, 0)
        };
    }, [filtered]);

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Standard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-[24px] flex items-center justify-center shadow-xl border border-slate-100 group transition-all hover:scale-105 active:scale-95">
                        <History className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-brand-charcoal tracking-tight uppercase">Inventory History</h1>
                        <p className="text-sm text-slate-500 mt-1 font-medium italic-none">Reconstruct historical stock balances at any point in time</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Controls */}
                <div className="flex-shrink-0 w-full lg:w-80">
                    <div className="sticky top-6 space-y-6">
                        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} activeDates={[format(new Date(), 'yyyy-MM-dd')]} />

                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Logic Mode</h3>
                                <RefreshCw size={12} className="text-brand-orange animate-spin-slow" />
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                Reverse playback calculations start from real-time levels and mathematically undo every transaction back to <span className="text-brand-charcoal font-black">{format(selectedDate, 'MMM d')}</span>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 space-y-8">
                    {/* Summary Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[18px] bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShoppingCart size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inwards (Stock In)</p>
                                <p className="text-2xl font-black font-data text-brand-charcoal">+{totals.in}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[18px] bg-red-50 text-brand-red flex items-center justify-center"><ArrowDownRight size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Outwards (Stock Out)</p>
                                <p className="text-2xl font-black font-data text-brand-charcoal">-{totals.out}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[18px] bg-blue-50 text-blue-600 flex items-center justify-center"><RotateCcw size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Refunds (Returns)</p>
                                <p className="text-2xl font-black font-data text-brand-charcoal">+{totals.returns}</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                        <input type="text" placeholder="Search products in historical snapshot..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[28px] text-sm focus:ring-2 focus:border-brand-red outline-none shadow-sm transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Product Detail</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Opening</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] text-center bg-emerald-50/10">In (+)</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-brand-red uppercase tracking-[0.2em] text-center bg-red-50/10">Out (-)</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] text-center bg-blue-50/10">Return (+)</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-brand-charcoal uppercase tracking-[0.2em] text-center border-l bg-slate-50/30">Closing</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        [1, 2, 3, 4, 5].map(i => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-8 py-8"><div className="h-4 bg-slate-50 rounded-full w-48"></div></td></tr>)
                                    ) : filtered.length > 0 ? filtered.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-all font-data group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-brand-red transition-colors"><Package size={14} /></div>
                                                    <p className="text-xs font-black text-brand-charcoal leading-tight">{item.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center font-bold text-slate-400">{item.opening}</td>
                                            <td className="px-6 py-5 text-center font-black text-emerald-600 bg-emerald-50/5">+{item.inwards}</td>
                                            <td className="px-6 py-5 text-center font-black text-brand-red bg-red-50/5">-{item.outwards}</td>
                                            <td className="px-6 py-5 text-center font-black text-blue-600 bg-blue-50/5">+{item.returns}</td>
                                            <td className="px-8 py-5 text-center font-black text-brand-charcoal border-l bg-slate-50/20 text-sm">{item.ending}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No matching product history found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
