import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { X, RotateCcw, Trash2, AlertTriangle, Package } from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';

interface Product {
    id: string;
    name: string;
    selling_price: number;
}

interface RefundItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    maxQuantity?: number;
}

interface RefundModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newRefund?: unknown[]) => void;
}

export default function RefundModal({ isOpen, onClose, onSuccess }: RefundModalProps) {
    const { activeBranchId } = useBranch();
    const [products, setProducts] = useState<Product[]>([]);
    const [items, setItems] = useState<RefundItem[]>([]);
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
                (document.getElementById('refund-form') as HTMLFormElement)?.requestSubmit();
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
        let query = supabase.from('products').select('id, name, selling_price').order('name');
        if (activeBranchId) {
            query = query.eq('branch_id', activeBranchId);
        }
        const { data, error } = await query;
        if (error) console.error('Error fetching products:', error);
        else setProducts(data || []);
    };

    const updateItem = (index: number, updates: Partial<RefundItem>) => {
        const newItems = [...items];
        const item = { ...newItems[index], ...updates };

        if (updates.productId) {
            const product = products.find(p => p.id === updates.productId);
            if (product) {
                item.productName = product.name;
                item.unitPrice = product.selling_price;
            }
        }

        item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0);
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
                setError(`Quantity for ${item.productName} cannot exceed original invoice quantity (${item.maxQuantity})`);
                return;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const refundRecords = items.map(item => ({
                product_id: item.productId,
                quantity: item.quantity,
                reason: reason,
                invoice_number: invoiceNumber,
                unit_price: item.unitPrice,
                total_price: item.totalPrice,
                vat_amount: isVatEnabled ? (item.totalPrice - (item.totalPrice / 1.12)) : 0,
                user_id: user?.id,
                date: date,
                branch_id: activeBranchId
            }));

            const { data, error: insertError } = await supabase.from('customer_refunds').insert(refundRecords).select('*, products(name)');
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
                .from('sales')
                .select('product_id, quantity, unit_price, products(name)')
                .eq('invoice_number', invoiceNumber);

            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data || data.length === 0) {
                setError('No sales found for this invoice number');
                return;
            }

            const newItems: RefundItem[] = data.map(item => ({
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
            <div className="w-full max-w-5xl rounded-2xl bg-surface shadow-2xl border border-border-default flex flex-col max-h-[90vh] animate-slide-up overflow-hidden">
                <div className="flex items-center justify-between px-6 py-3 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white"><RotateCcw size={16} /></div>
                        <h2 className="text-base font-bold uppercase tracking-wider">Customer Refund</h2>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-all"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide text-left bg-surface">
                    {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
                    <form id="refund-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-subtle rounded-xl border border-border-default items-end">
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase text-text-secondary">Invoice #</label>
                                <div className="flex gap-2">
                                    <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="modal-input font-data flex-1" placeholder="e.g. 000001" required />
                                    <button
                                        type="button"
                                        onClick={loadInvoiceItems}
                                        disabled={loading}
                                        className="bg-brand-charcoal text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-brand-red transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                                    >
                                        Import
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase text-text-secondary">Refund Date</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="modal-input font-data" required />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase text-text-secondary">Reason</label>
                                <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="modal-input" placeholder="e.g. Defective" required />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-3 p-3 border border-border-default rounded-xl bg-surface hover:border-brand-red/30 transition-all items-center shadow-sm">
                                    <div className="flex-1 flex flex-col md:flex-row gap-4 items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-9 h-9 bg-brand-red/10 rounded-lg flex items-center justify-center text-brand-red"><Package size={16} /></div>
                                            <div className="flex-1 text-left">
                                                <p className="text-sm font-black text-text-primary uppercase">{item.productName}</p>
                                                <p className="text-[10px] text-text-muted font-data">INV QTY: {item.maxQuantity}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-black uppercase text-text-muted">Refund Qty</label>
                                                 <input
                                                     type="number"
                                                     min="1"
                                                     max={item.maxQuantity}
                                                     className={`modal-input font-data text-center w-24 ${item.maxQuantity && item.quantity > item.maxQuantity ? 'border-brand-red text-brand-red' : ''}`}
                                                     value={item.quantity}
                                                     onChange={e => updateItem(index, { quantity: parseInt(e.target.value) || 0 })}
                                                     onFocus={e => e.target.select()}
                                                     required
                                                 />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-black uppercase text-text-muted">Unit Price</label>
                                                <p className="text-sm font-black font-data text-text-secondary">₱{item.unitPrice.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-black uppercase text-text-muted">Total</label>
                                                <p className="text-sm font-black font-data text-text-primary">₱{item.totalPrice.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeItem(index)} className="p-3 text-text-muted hover:text-brand-red transition-colors" title="Remove Item"><Trash2 size={20} /></button>
                                </div>
                            ))}
                            {items.length === 0 && !loading && invoiceNumber && (
                                <div className="p-12 text-center border-2 border-dashed border-border-default rounded-3xl bg-subtle">
                                    <Package className="mx-auto text-text-muted mb-4" size={40} />
                                    <p className="text-text-secondary font-bold">Enter Invoice # and click Import to load items</p>
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 bg-brand-charcoal flex flex-col md:flex-row items-end md:items-center justify-between gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-brand-red/10 rounded-full blur-3xl -mr-24 -mt-24" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-white/60 relative z-10 text-left">
                        <div><p className="text-[10px] font-black uppercase opacity-50">Total</p><p className="text-base font-black font-data text-white">₱{subtotal.toLocaleString()}</p></div>
                        {isVatEnabled && <div><p className="text-[10px] font-black uppercase opacity-50">VAT Adj.</p><p className="text-base font-black font-data text-brand-red">- ₱{vatAmount.toLocaleString()}</p></div>}
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase opacity-50">VAT</span>
                            <button type="button" onClick={() => setIsVatEnabled(!isVatEnabled)} className={`w-10 h-5 rounded-full relative transition-all ${isVatEnabled ? 'bg-brand-red' : 'bg-white/10'}`}><div className={`w-3 h-3 bg-white rounded-full transition-all absolute top-1 ${isVatEnabled ? 'right-1' : 'left-1'}`} /></button>
                        </div>
                    </div>
                    <div className="flex gap-3 relative z-10">
                        <button type="button" onClick={onClose} className="px-4 py-2 border border-white/20 text-white font-bold text-[10px] rounded-lg hover:bg-white/10 transition-colors uppercase tracking-widest">Cancel</button>
                        <button type="submit" form="refund-form" disabled={loading || items.length === 0} className="px-6 py-2 bg-brand-red text-white rounded-lg font-black text-[10px] shadow-red transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest">{loading ? 'Logging...' : 'Complete Refund'}</button>
                    </div>
                </div>
            </div >
        </div >,
        document.body
    );
}
