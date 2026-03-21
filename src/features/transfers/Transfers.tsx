import { useState, useMemo, Fragment } from 'react';
import { 
    ArrowRightLeft,
    Clock, History, Search,
    CheckCircle2, XCircle, Truck, Info,
    ChevronRight, PackageCheck, Calendar as CalendarIcon,
    ChevronDown, ChevronUp, Edit2, RotateCcw, Trash2
} from 'lucide-react';
import TransferRequestModal from '../inventory/components/TransferRequestModal';
import { useTransfers } from '../../shared/hooks/useTransfers';
import type { StockTransfer } from '../../shared/hooks/useTransfers';
import { useBranch } from '../../shared/hooks/useBranch';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../../shared/lib/supabase';
import { useAuth } from '../../shared/hooks/useAuth';
import Calendar from '../reports/components/Calendar';

export default function Transfers() {
    const { activeBranchId } = useBranch();
    const { user, role } = useAuth();
    const { transfers, loading, refresh } = useTransfers();
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [expandedTransferId, setExpandedTransferId] = useState<string | null>(null);
    const [editingTransfer, setEditingTransfer] = useState<StockTransfer | null>(null);

    const filteredTransfers = useMemo(() => {
        return transfers.filter(t => {
            const matchesTab = activeTab === 'pending' ? t.status === 'pending' : t.status !== 'pending';
            
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = 
                t.product_name.toLowerCase().includes(searchLower) ||
                t.product_sku.toLowerCase().includes(searchLower) ||
                t.source_branch_name?.toLowerCase().includes(searchLower) ||
                t.destination_branch_name?.toLowerCase().includes(searchLower) ||
                t.items?.some(item => 
                    item.name.toLowerCase().includes(searchLower) || 
                    item.sku.toLowerCase().includes(searchLower)
                );
            
            const matchesDate = !selectedDate || isSameDay(new Date(t.created_at), selectedDate);
                            
            return matchesTab && matchesSearch && matchesDate;
        });
    }, [transfers, activeTab, searchQuery, selectedDate]);

    const incomingPending = transfers.filter(t => 
        String(t.destination_branch_id) === String(activeBranchId) && 
        t.status === 'pending'
    );

    const handleAction = async (transfer: StockTransfer, newStatus: 'shipped' | 'cancelled' | 'received') => {
        try {
            const itemsToProcess = transfer.items && transfer.items.length > 0 
                ? transfer.items 
                : [{ 
                    sku: transfer.product_sku, 
                    name: transfer.product_name, 
                    quantity: transfer.quantity,
                    product_id: undefined // Legacy might not have it
                  }];

            if (newStatus === 'shipped') {
                if (String(transfer.source_branch_id) !== String(activeBranchId)) {
                    toast.error("Only the source branch can ship items.");
                    return;
                }
                // Bulk Stock Check & Deduction
                for (const item of itemsToProcess) {
                    const { data: product, error: productError } = await supabase
                        .from('products')
                        .select('stock_available, id')
                        .eq('sku', item.sku)
                        .eq('branch_id', activeBranchId)
                        .single();

                    if (productError || !product) {
                        toast.error(`Product ${item.sku} not found in inventory`);
                        return;
                    }

                    if (product.stock_available < item.quantity) {
                        toast.error(`Insufficient stock for ${item.sku}! Available: ${product.stock_available}`);
                        return;
                    }

                    const { error: updateStockError } = await supabase
                        .from('products')
                        .update({ stock_available: product.stock_available - item.quantity })
                        .eq('id', product.id);

                    if (updateStockError) throw updateStockError;
                }
            } else if (newStatus === 'received') {
                if (String(transfer.destination_branch_id) !== String(activeBranchId)) {
                    toast.error("Only the destination branch can receive items.");
                    return;
                }
                // Bulk Stock Addition
                for (const item of itemsToProcess) {
                    const { data: product, error: productError } = await supabase
                        .from('products')
                        .select('stock_available, id')
                        .eq('sku', item.sku)
                        .eq('branch_id', activeBranchId)
                        .single();

                    if (productError || !product) {
                        toast.error(`Product ${item.sku} not found in local inventory.`);
                        return;
                    }

                    const { error: updateStockError } = await supabase
                        .from('products')
                        .update({ stock_available: product.stock_available + item.quantity })
                        .eq('id', product.id);

                    if (updateStockError) throw updateStockError;
                }
            }

            // Update transfer status
            const { error: updateTransferError } = await supabase
                .from('stock_transfers')
                .update({ 
                    status: newStatus,
                    approved_by: newStatus === 'shipped' ? user?.id : undefined,
                    updated_at: new Date().toISOString(),
                    ...(newStatus === 'shipped' ? { shipped_at: new Date().toISOString() } : {}),
                    ...(newStatus === 'received' ? { received_at: new Date().toISOString() } : {})
                })
                .eq('id', transfer.id);

            if (updateTransferError) throw updateTransferError;

            toast.success(
                newStatus === 'shipped' ? 'Request approved and stock shipped!' : 
                newStatus === 'received' ? 'Stock received and inventory updated!' :
                'Request rejected'
            );
            refresh();
        } catch (error) {
            console.error('Error processing transfer:', error);
            toast.error('Failed to process request');
        }
    };

    const handleDelete = async (transfer: StockTransfer) => {
        if (role !== 'owner') {
            toast.error('Only owners can delete transfers with stock rollback');
            return;
        }

        const isCancelled = transfer.status?.toLowerCase() === 'cancelled';
        const confirmMsg = isCancelled 
            ? 'Are you sure you want to PERMANENTLY delete this cancelled transfer record?' 
            : 'Are you sure you want to void this transfer? Stock will be automatically balanced across branches.';

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            const itemsToProcess = transfer.items && transfer.items.length > 0 
                ? transfer.items 
                : [{ 
                    sku: transfer.product_sku, 
                    name: transfer.product_name, 
                    quantity: transfer.quantity 
                  }];

            // If already cancelled, just permanently delete the record
            if (isCancelled) {
                const { error: deleteError, count } = await supabase
                    .from('stock_transfers')
                    .delete({ count: 'exact' })
                    .eq('id', transfer.id);
                
                if (deleteError) throw deleteError;

                if (count === 0) {
                    toast.error('Record not found or permission denied (0 rows deleted)');
                    return;
                }

                toast.success('Transfer record deleted!');
                refresh();
                return;
            }

            // 1. Rollback Source Branch (Add stock back if shipped or received)
            if (transfer.status === 'shipped' || transfer.status === 'received') {
                for (const item of itemsToProcess) {
                    const { data: product, error: productError } = await supabase
                        .from('products')
                        .select('stock_available, id')
                        .eq('sku', item.sku)
                        .eq('branch_id', transfer.source_branch_id)
                        .single();

                    if (!productError && product) {
                        const { error: updErr } = await supabase
                            .from('products')
                            .update({ stock_available: product.stock_available + item.quantity })
                            .eq('id', product.id);
                        if (updErr) throw updErr;
                    }
                }
            }

            // 2. Rollback Destination Branch (Deduct stock if received)
            if (transfer.status === 'received') {
                for (const item of itemsToProcess) {
                    const { data: product, error: productError } = await supabase
                        .from('products')
                        .select('stock_available, id')
                        .eq('sku', item.sku)
                        .eq('branch_id', transfer.destination_branch_id)
                        .single();

                    if (!productError && product) {
                        const { error: updErr } = await supabase
                            .from('products')
                            .update({ stock_available: product.stock_available - item.quantity })
                            .eq('id', product.id);
                        if (updErr) throw updErr;
                    }
                }
            }

            // 3. Mark as cancelled
            const { error: updateError } = await supabase
                .from('stock_transfers')
                .update({ 
                    status: 'cancelled',
                    request_remarks: `VOIDED BY OWNER: ${transfer.request_remarks || ''}`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', transfer.id);

            if (updateError) throw updateError;

            toast.success('Transfer voided and stock balanced!');
            refresh();
        } catch (error: any) {
            console.error('Error deleting transfer:', error);
            toast.error(error.message || 'Failed to void transfer');
        }
    };

    const handleUndo = async (transfer: StockTransfer) => {
        if (role !== 'owner') {
            toast.error('Only owners can restore cancelled transfers');
            return;
        }

        if (!confirm('Restore this cancelled transfer to pending?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('stock_transfers')
                .update({ 
                    status: 'pending',
                    request_remarks: transfer.request_remarks?.replace('VOIDED BY OWNER: ', '') || '',
                    updated_at: new Date().toISOString()
                })
                .eq('id', transfer.id);

            if (error) throw error;
            toast.success('Transfer restored to pending!');
            refresh();
        } catch (error) {
            console.error('Error restoring transfer:', error);
            toast.error('Failed to restore transfer');
        }
    };

    return (
        <div className="space-y-8 animate-fade-in transition-colors duration-500">
            {/* Header section with cumulative stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-red rounded-2xl flex items-center justify-center shadow-red">
                            <ArrowRightLeft className="text-white" size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">
                            Stock <span className="text-brand-red">Transfers</span>
                        </h1>
                    </div>
                    <p className="text-sm text-text-secondary font-medium pl-15">
                        Coordinate inter-branch inventory movements with real-time tracking.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="px-5 py-3 bg-surface rounded-2xl border border-border-default shadow-sm flex flex-col items-center min-w-[120px]">
                        <span className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Incoming</span>
                        <span className="text-xl font-black text-text-primary">{incomingPending.length}</span>
                    </div>
                    <div className="px-5 py-3 bg-surface rounded-2xl border border-border-default shadow-sm flex flex-col items-center min-w-[120px]">
                        <span className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Active</span>
                        <span className="text-xl font-black text-text-primary">{transfers.filter(t => String(t.status) !== 'received' && String(t.status) !== 'cancelled').length}</span>
                    </div>
                </div>
            </div>

            {/* Navigation & Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="flex p-1 bg-surface rounded-2xl border border-border-default shadow-sm w-fit">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-6 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 ${
                                activeTab === 'pending' 
                                    ? 'bg-brand-red text-white shadow-red' 
                                    : 'text-text-secondary hover:bg-subtle'
                            }`}
                        >
                            <Clock size={14} />
                            Pending
                            {incomingPending.length > 0 && (
                                <span className="flex h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 ${
                                activeTab === 'history' 
                                    ? 'bg-brand-red text-white shadow-red' 
                                    : 'text-text-secondary hover:bg-subtle'
                            }`}
                        >
                            <History size={14} />
                            History
                        </button>
                    </div>

                    {/* Smart Calendar Toggle */}
                    <div className="relative">
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className={`flex items-center gap-2 px-6 py-2.5 bg-surface border rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${selectedDate ? 'border-brand-red text-brand-red shadow-red-sm' : 'border-border-default text-text-secondary hover:bg-subtle'}`}
                        >
                            <CalendarIcon size={14} />
                            {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'All Dates'}
                            {selectedDate && (
                                <XCircle 
                                    size={14} 
                                    className="ml-1 hover:text-brand-red-dark transition-colors" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDate(null);
                                        setShowCalendar(false);
                                    }}
                                />
                            )}
                        </button>
                        {showCalendar && (
                            <div className="absolute top-full left-0 mt-3 z-50 animate-slide-down origin-top shadow-2xl">
                                <Calendar 
                                    selectedDate={selectedDate || new Date()} 
                                    onDateSelect={(date) => {
                                        setSelectedDate(date);
                                        setShowCalendar(false);
                                    }}
                                    activeDates={transfers.map(t => format(new Date(t.created_at), 'yyyy-MM-dd'))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <input
                        type="text"
                        placeholder="Search SKU, Product or Branch..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-border-default rounded-2xl py-2.5 pl-11 pr-4 text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-brand-red/10 outline-none transition-all font-bold text-xs"
                    />
                </div>
            </div>

            {/* Main Table Content */}
            <div className="bg-surface rounded-3xl border border-border-default overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-subtle/30 border-b border-border-default">
                                <th className="px-4 py-3 text-left text-xs font-black text-text-muted uppercase tracking-[0.2em]">Transaction</th>
                                <th className="px-4 py-3 text-left text-xs font-black text-text-muted uppercase tracking-[0.2em]">Movement</th>
                                <th className="px-4 py-3 text-left text-xs font-black text-text-muted uppercase tracking-[0.2em]">Items</th>
                                <th className="px-4 py-3 text-left text-xs font-black text-text-muted uppercase tracking-[0.2em]">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-black text-text-muted uppercase tracking-[0.2em]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-muted/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-3 animate-pulse">
                                            <div className="w-10 h-10 bg-brand-red/10 rounded-full flex items-center justify-center animate-spin">
                                                <ArrowRightLeft className="text-brand-red" size={20} />
                                            </div>
                                            <span className="text-text-muted font-black text-[9px] uppercase tracking-widest">Synchronizing...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredTransfers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-24 text-center bg-subtle/20">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center">
                                                <Info className="text-text-muted" size={24} />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-text-primary font-black text-xs uppercase tracking-widest">No transfers found</h3>
                                                <p className="text-text-muted text-[9px] uppercase tracking-wider">Start a transfer from the Inventory dashboard</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTransfers.map((t) => (
                                    <Fragment key={t.id}>
                                        <tr className={`group transition-colors ${expandedTransferId === t.id ? 'bg-subtle/30' : 'hover:bg-subtle/30'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-text-primary font-bold text-sm uppercase tracking-tight group-hover:text-brand-red transition-colors line-clamp-1">
                                                        {t.items && t.items.length > 1 ? `${t.items.length} Products in Request` : t.product_name}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-text-muted uppercase font-bold">{format(new Date(t.created_at), 'MMM dd, h:mm a')}</span>
                                                        <span className="px-1.5 py-0.5 bg-subtle text-xs text-text-muted font-black rounded border border-border-default tracking-tighter uppercase">#{t.id.slice(0, 8)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-4 text-sm font-black uppercase">
                                                    <div className="flex flex-col text-xs text-text-muted">
                                                        <span className="leading-none mb-1 opacity-50 tracking-tighter text-[9px]">from</span>
                                                        <span className="text-text-primary tracking-tight font-bold">{t.source_branch_name}</span>
                                                    </div>
                                                    <ChevronRight className="text-text-muted" size={14} />
                                                    <div className="flex flex-col text-xs text-text-muted">
                                                        <span className="leading-none mb-1 opacity-50 tracking-tighter text-[9px]">to</span>
                                                        <span className="text-text-primary tracking-tight font-bold">{t.destination_branch_name}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button 
                                                    onClick={() => setExpandedTransferId(expandedTransferId === t.id ? null : t.id)}
                                                    className="flex items-center gap-3 group/btn"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-brand-red/5 rounded-lg flex items-center justify-center text-brand-red">
                                                            <PackageCheck size={18} />
                                                        </div>
                                                        <div className="flex flex-col items-start leading-none gap-0.5">
                                                            <span className="text-sm font-black text-text-primary uppercase tracking-tight">{t.items?.length || 1} Products</span>
                                                            <span className="text-[10px] text-brand-red font-bold uppercase tracking-widest flex items-center gap-0.5">
                                                                {expandedTransferId === t.id ? 'CLOSE LIST' : 'VIEW INVOICE'} 
                                                                {expandedTransferId === t.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-2.5 w-2.5 rounded-full ${
                                                            t.status === 'pending' ? 'bg-amber-500' :
                                                            t.status === 'shipped' ? 'bg-blue-500' :
                                                            t.status === 'received' ? 'bg-emerald-500' :
                                                            'bg-brand-red'
                                                        } shadow-sm`} />
                                                        <span className={`text-xs font-black uppercase tracking-widest ${
                                                            t.status === 'pending' ? 'text-amber-500' :
                                                            t.status === 'shipped' ? 'text-blue-500' :
                                                            t.status === 'received' ? 'text-emerald-500' :
                                                            'text-brand-red'
                                                        }`}>
                                                            {t.status}
                                                        </span>
                                                    </div>
                                                    {t.request_remarks && (
                                                        <span className="text-[10px] text-text-muted italic truncate max-w-[120px]">"{t.request_remarks}"</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-3">
                                                    {String(t.source_branch_id) === String(activeBranchId) && t.status === 'pending' && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleAction(t, 'shipped')}
                                                                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border-default hover:bg-subtle text-emerald-600 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95"
                                                            >
                                                                <Truck size={14} /> Ship
                                                            </button>
                                                            <button 
                                                                onClick={() => handleAction(t, 'cancelled')}
                                                                className="p-2 bg-surface border border-border-default hover:bg-danger-subtle text-text-muted hover:text-danger rounded-xl transition-all shadow-sm active:scale-95"
                                                            >
                                                                <XCircle size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {String(t.destination_branch_id) === String(activeBranchId) && t.status === 'shipped' && (
                                                        <button 
                                                            onClick={() => handleAction(t, 'received')}
                                                            className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white hover:bg-brand-red-dark rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-red active:scale-95"
                                                        >
                                                            <PackageCheck size={16} /> Receive
                                                        </button>
                                                    )}
                                                    {t.status === 'pending' && (
                                                        <button 
                                                            onClick={() => setEditingTransfer(t)}
                                                            className="p-2 bg-surface border border-border-default hover:bg-subtle text-text-muted hover:text-brand-red rounded-xl transition-all shadow-sm active:scale-95"
                                                            title="Edit Request"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                    )}
                                                    {t.status === 'cancelled' && role === 'owner' && (
                                                        <button 
                                                            onClick={() => handleUndo(t)}
                                                            className="p-2 bg-surface border border-border-default hover:bg-subtle text-text-muted hover:text-emerald-600 rounded-xl transition-all shadow-sm active:scale-95"
                                                            title="Undo Cancel (Restore)"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    )}
                                                    {t.status === 'shipped' && String(t.destination_branch_id) === String(activeBranchId) && (
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-subtle rounded-xl text-[10px] font-black text-text-muted uppercase tracking-tighter">
                                                            <Truck size={12} className="animate-bounce" /> In Transit
                                                        </div>
                                                    )}
                                                    {t.status === 'received' && (
                                                        <CheckCircle2 size={20} className="text-emerald-500/50" />
                                                    )}
                                                    {t.status === 'cancelled' && (
                                                        <XCircle size={20} className="text-brand-red/50" />
                                                    )}
                                                    {role === 'owner' && (
                                                        <button 
                                                            onClick={() => handleDelete(t)}
                                                            className="p-2 bg-surface border border-border-default hover:bg-danger-subtle text-text-muted hover:text-danger rounded-xl transition-all shadow-sm active:scale-95"
                                                            title={t.status === 'cancelled' ? 'Delete Record' : 'Delete & Rollback Stock'}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Expanded Details View */}
                                        {expandedTransferId === t.id && (
                                            <tr className="bg-subtle/5 border-b border-border-muted/20">
                                                <td colSpan={5} className="px-4 py-4">
                                                    <div className="max-w-4xl mx-auto bg-surface rounded-2xl border border-border-default shadow-sm overflow-hidden">
                                                        <div className="grid grid-cols-[100px,1fr,80px] px-6 py-3 bg-subtle/50 border-b border-border-default font-black text-[10px] text-text-muted uppercase tracking-widest">
                                                            <span>SKU</span>
                                                            <span>Item Description</span>
                                                            <span className="text-right">Qty</span>
                                                        </div>
                                                        <div className="divide-y divide-border-muted/30">
                                                            {(t.items && t.items.length > 0 ? t.items : [{ sku: t.product_sku, name: t.product_name, quantity: t.quantity }]).map((item, idx) => (
                                                                <div key={idx} className="grid grid-cols-[100px,1fr,80px] px-6 py-3 items-center hover:bg-subtle/10 transition-colors">
                                                                    <span className="text-xs font-bold text-text-muted tracking-tighter uppercase">{item.sku}</span>
                                                                    <span className="text-sm font-bold text-text-primary uppercase tracking-tight">{item.name}</span>
                                                                    <div className="text-right">
                                                                        <span className="text-sm font-black text-brand-red bg-brand-red/5 px-2.5 py-1 rounded-lg border border-brand-red/10">{item.quantity}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="px-6 py-3 bg-subtle/20 border-t border-border-default flex justify-between items-center">
                                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Transfer Manifest</span>
                                                            <span className="text-[10px] font-black text-text-primary uppercase">{t.items?.length || 1} SKUs Total</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Visual Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border-default opacity-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Outbound</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Inbound</span>
                    </div>
                </div>
                <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.4em]">Logistics Center v4.1</span>
            </div>
            {/* Transfer Request Modal for Editing */}
            <TransferRequestModal 
                isOpen={!!editingTransfer}
                onClose={() => setEditingTransfer(null)}
                transferToEdit={editingTransfer || undefined}
                onSuccess={() => {
                    setEditingTransfer(null);
                    refresh();
                }}
            />
        </div>
    );
}
