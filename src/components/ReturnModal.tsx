import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';

interface Product {
    id: string;
    sku: string;
    name: string;
    stock_available: number;
}

interface ReturnItem {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

interface ReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newReturn?: unknown[]) => void;
}

export default function ReturnModal({ isOpen, onClose, onSuccess }: ReturnModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [items, setItems] = useState<ReturnItem[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [reason, setReason] = useState('');
    const [isVatEnabled, setIsVatEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            setItems([]);
            setInvoiceNumber('');
            setReason('');
            setError(null);
        }
    }, [isOpen]);

    const fetchProducts = async () => {
        const { data, error } = await supabase.from('products').select('id, sku, name, stock_available').order('name');
        if (error) console.error('Error fetching products:', error);
        else setProducts(data || []);
    };

    const groupedByHierarchy = products.reduce((groups: Record<string, Product[]>, p) => {
        const hierarchy = p.name.includes(' > ') ? p.name.split(' > ').slice(0, -1).join(' > ') : 'Uncategorized';
        if (!groups[hierarchy]) groups[hierarchy] = [];
        groups[hierarchy].push(p);
        return groups;
    }, {});

    const sortedHierarchies = Object.keys(groupedByHierarchy).sort();

    const addItem = () => {
        setItems([...items, { productId: '', productName: '', sku: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    };

    const updateItem = (index: number, updates: Partial<ReturnItem>) => {
        const newItems = [...items];
        const item = { ...newItems[index], ...updates };
        if (updates.productId) {
            const product = products.find(p => p.id === updates.productId);
            if (product) {
                item.productName = product.name;
                item.sku = product.sku;
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
        if (items.length === 0) { setError('Please add at least one item'); return; }
        if (items.some(item => !item.productId)) { setError('Please select products for all items'); return; }

        for (const item of items) {
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
                vat_amount: isVatEnabled ? (item.totalPrice - (item.totalPrice / 1.12)) : 0
            }));

            const { data, error: insertError } = await supabase.from('supplier_returns').insert(returnRecords).select('*, products(name, sku)');
            if (insertError) throw insertError;

            for (const item of items) {
                const { data: p } = await supabase.from('products').select('stock_available').eq('id', item.productId).single();
                if (p) await supabase.from('products').update({ stock_available: p.stock_available - item.quantity }).eq('id', item.productId);
            }

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border flex flex-col max-h-[95vh] animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center"><RotateCcw size={16} /></div>
                        <h2 className="text-base font-bold">Return to Supplier</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
                    <form id="return-form" onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border">
                            <div><label className="block text-xs font-black uppercase text-slate-500 mb-2">Invoice #</label><input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="modal-input font-data" required /></div>
                            <div><label className="block text-xs font-black uppercase text-slate-500 mb-2">Reason</label><input type="text" value={reason} onChange={e => setReason(e.target.value)} className="modal-input" required /></div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center"><h3 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">Items</h3><button type="button" onClick={addItem} className="px-4 py-2 bg-brand-red text-white rounded-xl text-xs font-bold">Add Item</button></div>
                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={index} className="flex gap-4 p-4 border rounded-2xl bg-white hover:border-brand-red/30 transition-all">
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="md:col-span-2"><select required className="modal-input" value={item.productId} onChange={e => updateItem(index, { productId: e.target.value })}><option value="">Select product...</option>{sortedHierarchies.map(h => <optgroup key={h} label={h}>{groupedByHierarchy[h].map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name.split(' > ').pop()} ({p.stock_available})</option>)}</optgroup>)}</select></div>
                                            <div><input type="number" min="1" className="modal-input font-data text-center" value={item.quantity} onChange={e => updateItem(index, { quantity: parseInt(e.target.value) || 0 })} required /></div>
                                            <div><input type="number" step="0.01" className="modal-input font-data" value={item.unitPrice} onChange={e => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })} required /></div>
                                        </div>
                                        <button type="button" onClick={() => removeItem(index)} className="p-3 text-slate-300 hover:text-brand-red"><Trash2 size={18} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-8 py-6 bg-brand-charcoal flex flex-col md:flex-row items-end md:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-white/60 relative z-10">
                        <div><p className="text-[10px] font-black uppercase opacity-50">Total Return</p><p className="text-lg font-black font-data text-white">₱{subtotal.toLocaleString()}</p></div>
                        {isVatEnabled && <div><p className="text-[10px] font-black uppercase opacity-50">VAT Adjustment</p><p className="text-lg font-black font-data text-brand-red">- ₱{vatAmount.toLocaleString()}</p></div>}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase opacity-50">VAT</span>
                            <button type="button" onClick={() => setIsVatEnabled(!isVatEnabled)} className={`w-10 h-5 rounded-full relative transition-all ${isVatEnabled ? 'bg-brand-red' : 'bg-white/10'}`}><div className={`w-3 h-3 bg-white rounded-full transition-all absolute top-1 ${isVatEnabled ? 'right-1' : 'left-1'}`} /></button>
                        </div>
                    </div>
                    <div className="flex gap-4 relative z-10">
                        <button type="button" onClick={onClose} className="px-6 py-3 border border-white/20 text-white font-bold text-sm rounded-xl">Cancel</button>
                        <button type="submit" form="return-form" disabled={loading || items.length === 0} className="px-8 py-3 bg-brand-red text-white rounded-xl font-black text-sm shadow-red transition-all active:scale-95 disabled:opacity-50">{loading ? 'Logging...' : 'Submit Return'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
