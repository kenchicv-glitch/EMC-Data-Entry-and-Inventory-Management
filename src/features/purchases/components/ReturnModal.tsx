import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { X, RotateCcw, Trash2, AlertTriangle, Package } from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';

interface Product {
    id: string;
    name: string;
    selling_price: number;
    stock_available: number;
}

interface ReturnItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    maxQuantity?: number;
}

interface ReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newReturn?: unknown[]) => void;
}

export default function ReturnModal({ isOpen, onClose, onSuccess }: ReturnModalProps) {
    const { activeBranchId } = useBranch();
    const [products, setProducts] = useState<Product[]>([]);
    const [items, setItems] = useState<ReturnItem[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [reason, setReason] = useState('');
    const [isVatEnabled, setIsVatEnabled] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                (document.getElementById('return-form') as HTMLFormElement)?.requestSubmit();
            }

            if (e.altKey && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                loadInvoiceItems();
            }
        };

        if (isOpen) {
            fetchProducts();
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
            setItems([]);
            setInvoiceNumber('');
            setReason('');
            setDate(today);
            setError(null);
            document.body.classList.add('modal-open');
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, invoiceNumber]);

    const fetchProducts = async () => {
        let query = supabase.from('products').select('id, name, selling_price, stock_available').order('name');
        if (activeBranchId) {
            query = query.eq('branch_id', activeBranchId);
        }
        const { data, error } = await query;
        if (error) console.error('Error fetching products:', error);
        else setProducts(data || []);
    };

    const updateItem = (index: number, updates: Partial<ReturnItem>) => {
        const newItems = [...items];
        const item = { ...newItems[index], ...updates };

        if (updates.productId) {
            const product = products.find(p => p.id === updates.productId);
            if (product) {
                item.productName = product.name;
            }
        }

        item.totalPrice = item.quantity * item.unitPrice;
        newItems[index] = item;
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const vatAmount = isVatEnabled ? (subtotal - (subtotal / 1.12)) : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        if (items.length === 0) { setError('Please add at least one item'); return; }
        if (items.some(item => !item.productId)) { setError('Please select products for all items'); return; }

        for (const item of items) {
            if (item.maxQuantity && item.quantity > item.maxQuantity) {
                setError(`Quantity for ${item.productName} cannot exceed original purchase quantity (${item.maxQuantity})`);
                return;
            }

            const product = products.find(p => p.id === item.productId);
            if (product && item.quantity > product.stock_available) {
                setError(`Insufficient stock for ${product.name}. Available: ${product.stock_available}`);
                return;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const returnRecords = items.map(item => ({
                product_id: item.productId,
                quantity: item.quantity,
                reason: reason,
                invoice_number: invoiceNumber,
                unit_price: item.unitPrice,
                total_price: item.totalPrice,
                vat_amount: isVatEnabled ? (item.totalPrice - (item.totalPrice / 1.12)) : 0,
                date: date,
                branch_id: activeBranchId
            }));

            const { data, error: insertError } = await supabase.from('supplier_returns').insert(returnRecords).select('*, products(name)');
            if (insertError) throw insertError;

            setTimeout(() => {
                onSuccess(data as unknown as unknown[]);
                onClose();
            }, 500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const loadInvoiceItems = async () => {
        if (!invoiceNumber) {
            setError('Please enter an invoice number first');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('purchases')
                .select('product_id, quantity, unit_price, products(name)')
                .eq('invoice_number', invoiceNumber);

            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data || data.length === 0) {
                setError('No purchases found for this invoice number');
                return;
            }

            const newItems: ReturnItem[] = data.map(item => ({
                productId: item.product_id,
                productName: (item.products as any)?.name || 'Unknown Product',
                quantity: item.quantity,
                unitPrice: item.unit_price,
                totalPrice: item.quantity * item.unit_price,
                maxQuantity: item.quantity
            }));

            setItems(newItems);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load invoice items');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4 text-left">
            <div className="w-full max-w-5xl rounded-2xl bg-surface shadow-2xl border border-border-muted flex flex-col max-h-[95vh] animate-slide-up overflow-hidden">
                <div className="flex items-center justify-between px-6 py-3 bg-brand-charcoal">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white"><RotateCcw size={16} /></div>
                        <h2 className="text-base font-bold text-white uppercase tracking-wider">Return to Supplier</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide text-left">
                    {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
                    <form id="return-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-subtle rounded-xl border border-border-default items-end shadow-inner">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase text-text-secondary tracking-widest">Invoice #</label>
                                <div className="flex gap-2">
                                    <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-xs font-bold text-text-primary font-data focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none" placeholder="e.g. INV-1234" required />
                                    <button
                                        type="button"
                                        onClick={loadInvoiceItems}
                                        disabled={loading}
                                        className="bg-brand-charcoal text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-brand-red transition-all flex items-center gap-2 active:scale-95"
                                    >
                                        Import
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase text-text-secondary tracking-widest">Return Date</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-xs font-bold text-text-primary font-data focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none" required />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase text-text-secondary tracking-widest">Reason</label>
                                <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-xs font-bold text-text-primary focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none" placeholder="e.g. Defective" required />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-left border-b border-border-default pb-3">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-primary flex items-center gap-2">
                                    <Package size={14} className="text-brand-red" /> Items to Return
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={index} className="flex gap-3 p-3 border border-border-default rounded-xl bg-bg-subtle hover:border-brand-red/30 transition-all items-center group/item shadow-sm">
                                        <div className="flex-1 flex flex-col md:flex-row gap-4 items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="w-10 h-10 bg-bg-surface border border-border-default rounded-lg flex items-center justify-center text-text-muted transition-transform group-hover/item:scale-110"><Package size={16} /></div>
                                                <div className="flex-1 text-left">
                                                    <p className="text-xs font-black text-text-primary uppercase tracking-tight leading-tight mb-1">{item.productName}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-1.5 py-0.5 bg-base text-[9px] font-black text-text-muted rounded-md uppercase tracking-tighter">MAX QTY: {item.maxQuantity}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-8">
                                                <div className="space-y-1.5">
                                                    <label className="block text-[8px] font-black uppercase text-text-secondary tracking-widest">Qty</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={item.maxQuantity}
                                                        className={`w-20 bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-xs font-black text-text-primary text-center font-data focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none shadow-inner ${item.maxQuantity && item.quantity > item.maxQuantity ? 'border-brand-red text-brand-red' : ''}`}
                                                        value={item.quantity}
                                                        onChange={e => updateItem(index, { quantity: parseInt(e.target.value) || 0 })}
                                                        onFocus={e => e.target.select()}
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="block text-[8px] font-black uppercase text-text-secondary tracking-widest">Price</label>
                                                    <div className="relative">
                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-text-muted">₱</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-28 bg-bg-surface border border-border-default rounded-xl pl-6 pr-3 py-2 text-xs font-black text-text-primary font-data focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none shadow-inner"
                                                            value={item.unitPrice}
                                                            onChange={e => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                                                            onFocus={e => e.target.select()}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5 text-right min-w-[100px]">
                                                    <label className="block text-[9px] font-black uppercase text-text-secondary tracking-widest">Sub-Total</label>
                                                    <p className="text-lg font-black font-data text-text-primary">₱{item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => removeItem(index)} className="p-2.5 text-text-muted hover:text-brand-red hover:bg-brand-red/5 rounded-xl transition-all active:scale-95"><Trash2 size={18} /></button>
                                    </div>
                                ))}
                                {items.length === 0 && !loading && invoiceNumber && (
                                    <div className="p-16 text-center border-2 border-dashed border-border-default rounded-3xl bg-bg-subtle/50 group/empty hover:bg-bg-subtle transition-colors">
                                        <div className="w-16 h-16 bg-bg-surface border border-border-default rounded-2xl flex items-center justify-center text-text-muted mx-auto mb-4 group-hover/empty:scale-110 transition-transform"><Package size={32} /></div>
                                        <p className="text-text-secondary font-black text-sm uppercase tracking-widest mb-1">No items selected</p>
                                        <p className="text-text-muted text-xs font-medium">Import items from a purchase invoice to start</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 bg-bg-surface border-t border-border-default flex flex-col md:flex-row items-end md:items-center justify-between gap-6 relative overflow-hidden text-text-primary">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-brand-red/5 rounded-full blur-3xl -mr-24 -mt-24" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-text-primary relative z-10 text-left">
                        <div><p className="text-[10px] font-black uppercase text-text-muted tracking-widest mb-1">Total</p><p className="text-lg font-black font-data text-text-primary">₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                        {isVatEnabled && <div><p className="text-[10px] font-black uppercase text-text-muted tracking-widest mb-1">VAT Adj.</p><p className="text-lg font-black font-data text-brand-red">- ₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>}
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black uppercase text-text-muted tracking-widest">VAT Adj.</span>
                            <button type="button" onClick={() => setIsVatEnabled(!isVatEnabled)} className={`w-10 h-5 rounded-full relative transition-all shadow-inner ${isVatEnabled ? 'bg-brand-red' : 'bg-bg-subtle border border-border-default'}`}><div className={`w-3 h-3 rounded-full transition-all absolute top-1 shadow-sm ${isVatEnabled ? 'right-1 bg-white' : 'left-1 bg-text-muted'}`} /></button>
                        </div>
                    </div>
                    <div className="flex gap-3 relative z-10 w-full md:w-auto">
                        <button type="button" onClick={onClose} className="flex-1 md:flex-none px-4 py-2 bg-bg-subtle text-text-primary font-black text-[10px] rounded-lg hover:bg-bg-base border border-border-default transition-all uppercase tracking-widest">Cancel</button>
                        <button type="submit" form="return-form" disabled={loading || items.length === 0} className="flex-[2] md:flex-none px-8 py-2 bg-brand-red text-white rounded-lg font-black text-[10px] shadow-lg shadow-brand-red/20 transition-all hover:bg-brand-red-dark active:scale-95 disabled:opacity-50 uppercase tracking-widest">{loading ? 'LOGGING...' : 'SUBMIT RETURN'}</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
