import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, RotateCcw, Trash2, AlertTriangle, Search, ChevronDown } from 'lucide-react';

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
    searchQuery?: string;
    isSearchOpen?: boolean;
    currentLevel?: 'master' | 'category' | 'subcategory' | 'product';
    selectedPath?: {
        master?: string;
        category?: string;
        subcategory?: string;
    };
}

interface RefundModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newRefund?: unknown[]) => void;
}

export default function RefundModal({ isOpen, onClose, onSuccess }: RefundModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [items, setItems] = useState<RefundItem[]>([]);
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
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]);

    const fetchProducts = async () => {
        const { data, error } = await supabase.from('products').select('id, name, selling_price').order('name');
        if (error) console.error('Error fetching products:', error);
        else setProducts(data || []);
    };

    const addItem = () => {
        setItems([...items, {
            productId: '',
            productName: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            searchQuery: '',
            isSearchOpen: false,
            currentLevel: 'master',
            selectedPath: {}
        }]);
    };

    const dropdownRefs = React.useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            dropdownRefs.current.forEach((ref, index) => {
                if (ref && !ref.contains(event.target as Node)) {
                    setItems(prev => {
                        const next = [...prev];
                        if (next[index]) next[index].isSearchOpen = false;
                        return next;
                    });
                }
            });
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectProduct = (index: number, product: Product) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            productId: product.id,
            productName: product.name,
            unitPrice: product.selling_price,
            totalPrice: newItems[index].quantity * product.selling_price,
            searchQuery: product.name,
            isSearchOpen: false
        };
        setItems(newItems);
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

        if (updates.searchQuery !== undefined) {
            item.isSearchOpen = true;
            if (!updates.searchQuery) {
                item.productId = '';
                item.productName = '';
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
                user_id: user?.id
            }));

            const { data, error: insertError } = await supabase.from('customer_refunds').insert(refundRecords).select('*, products(name)');
            if (insertError) throw insertError;

            // Increment stock for each refunded item
            for (const item of items) {
                const { data: p } = await supabase.from('products').select('stock_available').eq('id', item.productId).single();
                if (p) {
                    await supabase.from('products').update({
                        stock_available: (p.stock_available || 0) + item.quantity
                    }).eq('id', item.productId);
                }
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

    const loadInvoiceItems = async () => {
        if (!invoiceNumber) {
            setError('Please enter an invoice number first');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('product_id, quantity, unit_price, products(name)')
                .eq('invoice_number', invoiceNumber);

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
                totalPrice: item.quantity * item.unit_price
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
            <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border flex flex-col max-h-[95vh] animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center"><RotateCcw size={16} /></div>
                        <h2 className="text-base font-bold">Log Refund</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
                    <form id="refund-form" onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border items-end">
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase text-slate-700">Invoice #</label>
                                <div className="flex gap-2">
                                    <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="modal-input font-data flex-1" placeholder="e.g. OS-1234" required />
                                    <button
                                        type="button"
                                        onClick={loadInvoiceItems}
                                        disabled={loading}
                                        className="bg-brand-charcoal text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-brand-red transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                                    >
                                        Import Items
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-700 mb-2">Reason</label>
                                <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="modal-input" placeholder="e.g. Defective, Wrong Item" required />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center"><h3 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">Items</h3><button type="button" onClick={addItem} className="px-4 py-2 bg-brand-red text-white rounded-xl text-xs font-bold">Add Item</button></div>
                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={index} className="flex gap-4 p-4 border rounded-2xl bg-white hover:border-brand-red/30 transition-all">
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="md:col-span-2 relative" ref={el => { dropdownRefs.current[index] = el; }}>
                                                <div className="relative">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={14} /></div>
                                                    <input
                                                        type="text"
                                                        placeholder="Focus to search product..."
                                                        className="modal-input pl-9 pr-8"
                                                        value={item.searchQuery}
                                                        onChange={(e) => updateItem(index, { searchQuery: e.target.value })}
                                                        onFocus={() => updateItem(index, { isSearchOpen: true })}
                                                        required
                                                    />
                                                    {item.searchQuery && (
                                                        <button type="button" onClick={() => updateItem(index, { searchQuery: '', productId: '', unitPrice: 0, currentLevel: 'master', selectedPath: {}, isSearchOpen: false })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-brand-red transition-colors">
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                {item.isSearchOpen && (
                                                    <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-h-[300px] overflow-hidden flex flex-col min-w-[350px] animate-fade-in">
                                                        {!item.searchQuery && item.currentLevel !== 'master' && (
                                                            <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateItem(index, { currentLevel: 'master' })}
                                                                    className="flex items-center gap-1.5 text-[10px] font-black uppercase text-brand-red hover:text-brand-red-dark transition-colors"
                                                                >
                                                                    <ChevronDown size={14} className="rotate-90" />
                                                                    Back
                                                                </button>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.selectedPath?.master}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex-1 overflow-y-auto">
                                                            {item.searchQuery ? (
                                                                products.filter(p => p.name.toLowerCase().includes(item.searchQuery?.toLowerCase() || '')).map(p => (
                                                                    <button key={p.id} type="button" onClick={() => selectProduct(index, p)} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col">
                                                                        <span className="text-[11px] font-black text-brand-charcoal uppercase">{p.name}</span>
                                                                        <span className="text-[9px] text-slate-400 font-data uppercase tracking-widest">₱{p.selling_price.toLocaleString()}</span>
                                                                    </button>
                                                                ))
                                                            ) : item.currentLevel === 'master' ? (
                                                                Array.from(new Set(products.map(p => p.name.split(' > ')[0]))).sort().map(m => (
                                                                    <button key={m} type="button" onClick={() => updateItem(index, { selectedPath: { master: m }, currentLevel: 'product' })} className="w-full text-left px-5 py-3 hover:bg-slate-50 border-b flex items-center justify-between group">
                                                                        <span className="text-[11px] font-black text-brand-charcoal uppercase">{m}</span>
                                                                        <ChevronDown size={14} className="-rotate-90 text-slate-300 group-hover:text-brand-red" />
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                products.filter(p => p.name.split(' > ')[0] === item.selectedPath?.master).map(p => (
                                                                    <button key={p.id} type="button" onClick={() => selectProduct(index, p)} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b flex flex-col">
                                                                        <span className="text-[11px] font-black text-brand-charcoal uppercase">{p.name.split(' > ').slice(1).join(' > ')}</span>
                                                                        <span className="text-[9px] text-slate-400 font-data">₱{p.selling_price.toLocaleString()}</span>
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div><input type="number" min="1" className="modal-input font-data text-center" value={item.quantity} onChange={e => updateItem(index, { quantity: parseInt(e.target.value) || 0 })} required /></div>
                                            <div className="modal-input bg-slate-50 font-data flex items-center justify-between text-slate-500"><span>₱</span><span>{item.unitPrice.toLocaleString()}</span></div>
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
                        <div><p className="text-[10px] font-black uppercase opacity-50">Total Refund</p><p className="text-lg font-black font-data text-white">₱{subtotal.toLocaleString()}</p></div>
                        {isVatEnabled && <div><p className="text-[10px] font-black uppercase opacity-50">VAT Adjustment</p><p className="text-lg font-black font-data text-brand-red">- ₱{vatAmount.toLocaleString()}</p></div>}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase opacity-50">VAT</span>
                            <button type="button" onClick={() => setIsVatEnabled(!isVatEnabled)} className={`w-10 h-5 rounded-full relative transition-all ${isVatEnabled ? 'bg-brand-red' : 'bg-white/10'}`}><div className={`w-3 h-3 bg-white rounded-full transition-all absolute top-1 ${isVatEnabled ? 'right-1' : 'left-1'}`} /></button>
                        </div>
                    </div>
                    <div className="flex gap-4 relative z-10">
                        <button type="button" onClick={onClose} className="px-6 py-3 border border-white/20 text-white font-bold text-sm rounded-xl">Cancel</button>
                        <button type="submit" form="refund-form" disabled={loading || items.length === 0} className="px-8 py-3 bg-brand-red text-white rounded-xl font-black text-sm shadow-red transition-all active:scale-95 disabled:opacity-50">{loading ? 'Logging...' : 'Complete Refund'}</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
