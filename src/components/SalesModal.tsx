import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { X, ShoppingCart, AlertCircle, Plus, Trash2, Percent, ShieldCheck } from 'lucide-react';

interface Product {
    id: string;
    sku: string;
    name: string;
    stock_available: number;
    selling_price: number;
}

interface OrderItem {
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    sku?: string;
    name?: string;
    stock_available?: number;
}

interface SalesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newSales?: unknown[]) => void;
    editData?: {
        invoiceNumber: string;
        items: OrderItem[];
        isVatEnabled: boolean;
        isDiscountEnabled: boolean;
    };
}

export default function SalesModal({ isOpen, onClose, onSuccess, editData }: SalesModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [items, setItems] = useState<OrderItem[]>([
        { product_id: '', quantity: 1, unit_price: 0, total_price: 0 }
    ]);
    const [isVatEnabled, setIsVatEnabled] = useState(true);
    const [isDiscountEnabled, setIsDiscountEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const fetchProducts = useCallback(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('id, sku, name, stock_available, selling_price')
            .order('name');

        if (error) console.error('Error fetching products:', error);
        else setProducts(data || []);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            if (editData) {
                setInvoiceNumber(editData.invoiceNumber);
                setItems(editData.items);
                setIsVatEnabled(editData.isVatEnabled);
                setIsDiscountEnabled(editData.isDiscountEnabled);
            } else {
                setInvoiceNumber('INV-' + Math.random().toString(36).substring(2, 8).toUpperCase());
                setItems([{ product_id: '', quantity: 1, unit_price: 0, total_price: 0 }]);
                setIsVatEnabled(true);
                setIsDiscountEnabled(false);
            }
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, editData, fetchProducts]);

    const groupedProducts = products.reduce((groups: Record<string, Product[]>, p) => {
        const hierarchy = p.name.includes(' > ') ? p.name.split(' > ').slice(0, -1).join(' > ') : 'Uncategorized';
        if (!groups[hierarchy]) groups[hierarchy] = [];
        groups[hierarchy].push(p);
        return groups;
    }, {});

    const sortedHierarchies = Object.keys(groupedProducts).sort();

    const handleAddItem = () => {
        setItems([...items, { product_id: '', quantity: 1, unit_price: 0, total_price: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        if (field === 'product_id') {
            const product = products.find(p => p.id === value);
            if (product) {
                item.sku = product.sku;
                item.name = product.name;
                item.stock_available = product.stock_available;
                item.unit_price = product.selling_price || 0;
                item.total_price = item.quantity * item.unit_price;
            }
        }

        if (field === 'quantity' || field === 'unit_price') {
            const q = field === 'quantity' ? (value as number) : item.quantity;
            const u = field === 'unit_price' ? (value as number) : item.unit_price;
            item.total_price = q * u;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const vatAmount = isVatEnabled ? (subtotal - (subtotal / 1.12)) : 0;
    const discountAmount = isDiscountEnabled ? (subtotal * 0.10) : 0;
    const grandTotal = subtotal - discountAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!invoiceNumber.trim()) throw new Error('Please enter an invoice number');
            if (items.some(item => !item.product_id)) throw new Error('Please select a product for all rows');
            if (items.some(item => item.quantity <= 0)) throw new Error('Quantity must be greater than 0');

            const { data: { user } } = await supabase.auth.getUser();

            if (editData) {
                const { data: oldSales } = await supabase.from('sales').select('product_id, quantity').eq('invoice_number', editData.invoiceNumber);
                if (oldSales) {
                    for (const oldItem of oldSales) {
                        const { data: p } = await supabase.from('products').select('stock_available').eq('id', oldItem.product_id).single();
                        if (p) await supabase.from('products').update({ stock_available: p.stock_available + oldItem.quantity }).eq('id', oldItem.product_id);
                    }
                }
                await supabase.from('sales').delete().eq('invoice_number', editData.invoiceNumber);
            }

            const { data: latestProducts } = await supabase.from('products').select('id, name, stock_available');
            items.forEach(item => {
                const p = latestProducts?.find(prod => prod.id === item.product_id);
                if (p && item.quantity > (p.stock_available || 0)) throw new Error(`Insufficient stock for ${p.name}.`);
            });

            const salesToInsert = items.map(item => {
                const itemRatio = subtotal > 0 ? (item.total_price / subtotal) : (1 / items.length);
                return {
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price,
                    invoice_number: invoiceNumber,
                    user_id: user?.id,
                    vat_amount: isVatEnabled ? (vatAmount * itemRatio) : 0,
                    discount_amount: isDiscountEnabled ? (discountAmount * itemRatio) : 0,
                    is_discounted: isDiscountEnabled
                };
            });

            const { data: insertedData, error: insertError } = await supabase.from('sales').insert(salesToInsert).select('*, products(sku, name)');
            if (insertError) throw insertError;

            for (const item of items) {
                const { data: p } = await supabase.from('products').select('stock_available').eq('id', item.product_id).single();
                if (p) await supabase.from('products').update({ stock_available: p.stock_available - item.quantity }).eq('id', item.product_id);
            }

            setSuccess(true);
            setTimeout(() => {
                onSuccess(insertedData as unknown as unknown[]);
                onClose();
            }, 800);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white"><ShoppingCart size={16} /></div>
                        <h2 className="text-base font-bold text-white">{editData ? 'Edit Order' : 'New Order'}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                    <form id="order-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Invoice #</label>
                                <input type="text" required className="modal-input font-data text-sm" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                            </div>
                            <div className="md:col-span-2 flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 items-center">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Adjustments</label>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setIsVatEnabled(!isVatEnabled)} className={`flex-1 py-1.5 rounded-xl border text-[10px] font-black transition-all ${isVatEnabled ? 'bg-brand-red text-white' : 'bg-white text-slate-400'}`}><Percent size={12} className="inline mr-2" /> 12% VAT</button>
                                        <button type="button" onClick={() => setIsDiscountEnabled(!isDiscountEnabled)} className={`flex-1 py-1.5 rounded-xl border text-[10px] font-black transition-all ${isDiscountEnabled ? 'bg-brand-orange text-white' : 'bg-white text-slate-400'}`}><ShieldCheck size={12} className="inline mr-2" /> 10% DISCOUNT</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2"><h3 className="text-xs font-black uppercase text-brand-charcoal tracking-widest">Order Items</h3><button type="button" onClick={handleAddItem} className="bg-brand-red-light text-brand-red px-4 py-2 rounded-xl text-[10px] font-black hover:bg-brand-red hover:text-white transition-all"><Plus size={14} className="inline mr-1" /> ADD ITEM</button></div>
                            <div className="space-y-2">
                                {items.map((item, index) => (
                                    <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                        <div className="flex-[4]"><label className="block text-[9px] font-black text-slate-400 mb-1 uppercase">Product</label><select required className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs" value={item.product_id} onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}><option value="">Select product...</option>{sortedHierarchies.map(h => <optgroup key={h} label={h}>{groupedProducts[h].map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name} ({p.stock_available})</option>)}</optgroup>)}</select></div>
                                        <div className="flex-[2]"><label className="block text-[9px] font-black text-slate-400 mb-1 uppercase">Price</label><input type="number" readOnly className="w-full bg-slate-100 border rounded-xl px-3 py-2 text-xs font-data text-slate-500" value={item.unit_price} /></div>
                                        <div className="flex-[1]"><label className="block text-[9px] font-black text-slate-400 mb-1 uppercase">Qty</label><input type="number" min="1" className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-data" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} /></div>
                                        <div className="flex-[2] text-right"><label className="block text-[9px] font-black text-slate-400 mb-1 uppercase">Total</label><div className="py-2 font-black text-sm font-data">₱{item.total_price.toLocaleString()}</div></div>
                                        <div className="flex items-center pt-4"><button type="button" onClick={() => handleRemoveItem(index)} disabled={items.length === 1} className="p-2 text-slate-300 hover:text-red-500 disabled:opacity-0"><Trash2 size={16} /></button></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-8 py-6 bg-brand-charcoal flex flex-col md:flex-row items-end md:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-white/60 relative z-10">
                        <div><p className="text-[10px] font-black uppercase opacity-50">Subtotal</p><p className="text-lg font-black font-data text-white">₱{subtotal.toLocaleString()}</p></div>
                        {isVatEnabled && <div><p className="text-[10px] font-black uppercase opacity-50">VAT (12%)</p><p className="text-lg font-black font-data text-brand-red">- ₱{vatAmount.toLocaleString()}</p></div>}
                        <div><p className="text-[10px] font-black uppercase opacity-50">Discount</p><p className={`text-lg font-black font-data ${isDiscountEnabled ? 'text-brand-orange' : 'text-white/20'}`}>- ₱{discountAmount.toLocaleString()}</p></div>
                    </div>
                    <div className="flex flex-col items-end relative z-10">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Final Total</p>
                        <div className="flex items-center gap-4">
                            <p className="text-4xl font-black text-white font-data">₱{grandTotal.toLocaleString()}</p>
                            <button form="order-form" type="submit" disabled={loading || success} className="px-8 py-4 bg-brand-red hover:bg-brand-red-dark text-white rounded-2xl font-black text-sm shadow-red active:scale-95 disabled:opacity-50 tracking-widest">{loading ? 'SYNCING...' : success ? 'SAVED!' : 'FINALIZE'}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
