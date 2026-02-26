import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Truck, AlertCircle, Plus, Trash2, ShieldCheck, Clock, Search, Building2, Store, ChevronDown } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    stock_available: number;
}

interface PurchaseItem {
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    name?: string;
    stock_available?: number;
    searchQuery?: string;
    isSearchOpen?: boolean;
    currentLevel?: 'master' | 'category' | 'subcategory' | 'product';
    selectedPath?: {
        master?: string;
        category?: string;
        subcategory?: string;
    };
}

interface PurchaseRecord {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string;
    invoice_number: string;
    supplier: string;
    status: 'pending' | 'received';
    payment_status?: 'unpaid' | 'partial' | 'paid';
    payment_date?: string | null;
    purchase_type: 'supplier' | 'transfer';
}

interface PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newPurchases?: unknown[]) => void;
    editData?: {
        invoiceNumber: string;
        supplier: string;
        items: PurchaseItem[];
        status: 'pending' | 'received';
        payment_status?: 'unpaid' | 'partial' | 'paid';
        payment_date?: string | null;
        received_date?: string | null;
        date?: string;
        isVatEnabled: boolean;
        isDiscountEnabled: boolean;
        purchase_type?: 'supplier' | 'transfer';
    };
}

export default function PurchaseModal({ isOpen, onClose, onSuccess, editData }: PurchaseModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [purchaseType, setPurchaseType] = useState<'supplier' | 'transfer'>('supplier');
    const [items, setItems] = useState<PurchaseItem[]>([
        {
            product_id: '',
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            searchQuery: '',
            isSearchOpen: false,
            currentLevel: 'master',
            selectedPath: {}
        }
    ]);
    const [isVatEnabled, setIsVatEnabled] = useState(false);
    const [isDiscountEnabled, setIsDiscountEnabled] = useState(false);
    const [status, setStatus] = useState<'pending' | 'received'>('pending');
    const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
    const [paymentDate, setPaymentDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [savedData, setSavedData] = useState<(PurchaseRecord & { products?: { name: string } })[]>([]);
    const [showLowStock, setShowLowStock] = useState(false);

    const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

    const fetchProducts = useCallback(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, stock_available')
            .order('name');

        if (error) console.error('Error fetching products:', error);
        else setProducts(data || []);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            if (editData) {
                setInvoiceNumber(editData.invoiceNumber);
                setSupplier(editData.supplier);
                setPurchaseType(editData.purchase_type || 'supplier');
                setItems(editData.items.map(item => ({
                    ...item,
                    searchQuery: item.name || '',
                    isSearchOpen: false
                })));
                setStatus(editData.status);
                setPaymentStatus(editData.payment_status || 'unpaid');
                setPaymentDate(editData.payment_date || null);
                setIsVatEnabled(editData.isVatEnabled);
                setIsDiscountEnabled(editData.isDiscountEnabled);
            } else {
                setInvoiceNumber('PUR-' + Math.random().toString(36).substring(2, 8).toUpperCase());
                setItems([{
                    product_id: '',
                    quantity: 1,
                    unit_price: 0,
                    total_price: 0,
                    searchQuery: '',
                    isSearchOpen: false,
                    currentLevel: 'master',
                    selectedPath: {}
                }]);
                setSupplier('');
                setPurchaseType('supplier');
                setStatus('pending');
                setPaymentStatus('unpaid');
                setPaymentDate(null);
                setIsVatEnabled(false);
                setIsDiscountEnabled(false);
            }
            setError(null);
            setSuccess(false);
            setSavedData([]);
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen, editData, fetchProducts]);

    // Handle clicking outside of searchable dropdowns
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

    const handleAddItem = () => {
        setItems([...items, {
            product_id: '',
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            searchQuery: '',
            isSearchOpen: false,
            currentLevel: 'master',
            selectedPath: {}
        }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = <K extends keyof PurchaseItem>(index: number, field: K, value: PurchaseItem[K]) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        if (field === 'searchQuery') {
            item.isSearchOpen = true;
            if (!value) {
                item.product_id = '';
                item.name = '';
                item.stock_available = 0;
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

    const selectProduct = (index: number, product: Product) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            product_id: product.id,
            name: product.name,
            stock_available: product.stock_available,
            searchQuery: product.name,
            isSearchOpen: false
        };
        setItems(newItems);
    };

    const quickAddProduct = (product: Product) => {
        // If the last item is empty, use it. Otherwise add a new row.
        const lastItem = items[items.length - 1];
        if (!lastItem.product_id && !lastItem.searchQuery) {
            selectProduct(items.length - 1, product);
        } else {
            setItems([
                ...items,
                {
                    product_id: product.id,
                    name: product.name,
                    stock_available: product.stock_available,
                    searchQuery: product.name,
                    isSearchOpen: false,
                    quantity: 1,
                    unit_price: 0,
                    total_price: 0
                }
            ]);
        }
    };

    const lowStockProducts = products.filter(p => {
        const stk = Number(p.stock_available ?? 0);
        return stk <= 10;
    });

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const vatAmount = isVatEnabled ? (subtotal - (subtotal / 1.12)) : 0;
    const discountAmount = isDiscountEnabled ? (subtotal * 0.10) : 0;
    const grandTotal = subtotal - discountAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!invoiceNumber.trim()) throw new Error('Please enter a Reference/Invoice number');
            if (!supplier.trim()) throw new Error(`Please enter a ${purchaseType === 'supplier' ? 'supplier' : 'source branch'} name`);
            if (items.some(item => !item.product_id)) throw new Error('Please select a product for all rows');
            if (items.some(item => item.quantity <= 0)) throw new Error('Quantity must be greater than zero');

            const { data: { user } } = await supabase.auth.getUser();

            if (editData) {
                await supabase.from('purchases').delete().eq('invoice_number', editData.invoiceNumber);
            }

            const purchasesToInsert = items.map(item => {
                const itemRatio = subtotal > 0 ? (item.total_price / subtotal) : (1 / items.length);
                return {
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price,
                    invoice_number: invoiceNumber,
                    supplier: supplier,
                    status: status,
                    payment_status: paymentStatus,
                    payment_date: paymentStatus === 'paid' ? (paymentDate || new Date().toISOString()) : paymentDate,
                    user_id: user?.id,
                    vat_amount: isVatEnabled ? (vatAmount * itemRatio) : 0,
                    discount_amount: isDiscountEnabled ? (discountAmount * itemRatio) : 0,
                    is_discounted: isDiscountEnabled,
                    date: editData?.date || new Date().toISOString(),
                    received_date: status === 'received' ? (editData?.received_date || new Date().toISOString()) : null,
                    purchase_type: purchaseType
                };
            });

            const { data: insertedData, error: insertError } = await supabase.from('purchases').insert(purchasesToInsert).select('*, products(name)');
            if (insertError) throw insertError;

            setSavedData(insertedData as (PurchaseRecord & { products?: { name: string } })[]);
            setSuccess(true);
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Purchase Modal Error:', err);
            setError(error.message || 'An unexpected error occurred during sync.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
            <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white"><Truck size={16} /></div>
                        <h2 className="text-base font-bold text-white uppercase tracking-wider">{editData ? 'Edit Purchase' : 'Create Purchase'}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide overflow-x-visible">
                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                    <form id="purchase-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-4">
                                <div className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setPurchaseType('supplier')}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${purchaseType === 'supplier' ? 'bg-brand-red text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <Store size={14} /> SUPPLIER
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPurchaseType('transfer')}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${purchaseType === 'transfer' ? 'bg-brand-red text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <Building2 size={14} /> TRANSFER
                                    </button>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Truck size={12} /> {purchaseType === 'supplier' ? 'Supplier Name' : 'Source Branch'}
                                    </label>
                                    <input type="text" required placeholder={purchaseType === 'supplier' ? "Supplier" : "Branch Name"} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 outline-none shadow-sm font-medium" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                                </div>
                            </div>

                            <div className="md:col-span-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1.5 flex items-center gap-2">Ref #</label>
                                <input type="text" required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-data outline-none tracking-widest text-brand-charcoal focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/10" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                            </div>

                            <div className="md:col-span-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                                <div className="flex-1 space-y-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="col-span-2"><label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2">Order Status</label></div>
                                        <button type="button" onClick={() => setStatus('pending')} className={`flex-1 py-1.5 rounded-xl border text-[10px] font-black transition-all flex items-center justify-center gap-2 ${status === 'pending' ? 'bg-orange-500 text-white border-orange-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}><Clock size={12} /> PENDING</button>
                                        <button type="button" onClick={() => setStatus('received')} className={`flex-1 py-1.5 rounded-xl border text-[10px] font-black transition-all flex items-center justify-center gap-2 ${status === 'received' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}><ShieldCheck size={12} /> RECEIVED</button>
                                        <div className="col-span-2 mt-1">
                                            {status === 'received' ? (
                                                <p className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                                                    <ShieldCheck size={10} /> Live Inventory will be updated upon saving.
                                                </p>
                                            ) : (
                                                <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                                    <Clock size={10} /> No inventory changes will occur in Pending status.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-3"><label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2">Payment</label></div>
                                        <button type="button" onClick={() => setPaymentStatus('unpaid')} className={`py-1.5 rounded-xl border text-[9px] font-black transition-all ${paymentStatus === 'unpaid' ? 'bg-red-500 text-white border-red-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}>UNPAID</button>
                                        <button type="button" onClick={() => setPaymentStatus('partial')} className={`py-1.5 rounded-xl border text-[9px] font-black transition-all ${paymentStatus === 'partial' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}>PARTIAL</button>
                                        <button type="button" onClick={() => setPaymentStatus('paid')} className={`py-1.5 rounded-xl border text-[9px] font-black transition-all ${paymentStatus === 'paid' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}>FULL</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-xs font-black uppercase text-brand-charcoal tracking-widest">Stock Items</h3>
                                    {lowStockProducts.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowLowStock(!showLowStock)}
                                            className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all flex items-center gap-1.5 ${showLowStock ? 'bg-brand-red text-white' : 'bg-red-50 text-brand-red border border-red-100'}`}
                                        >
                                            <AlertCircle size={12} />
                                            {showLowStock ? 'HIDE LOW STOCK' : `${lowStockProducts.length} LOW STOCK ITEMS`}
                                        </button>
                                    )}
                                </div>
                                <button type="button" onClick={handleAddItem} className="bg-brand-red-light text-brand-red px-4 py-2 rounded-xl text-[10px] font-black hover:bg-brand-red hover:text-white transition-all">
                                    <Plus size={14} className="inline mr-1" /> ADD ITEM
                                </button>
                            </div>

                            {showLowStock && lowStockProducts.length > 0 && (
                                <div className="p-4 bg-red-50/30 border border-red-100 rounded-2xl animate-fade-in">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertCircle className="text-brand-red" size={14} />
                                        <h4 className="text-[10px] font-black text-brand-charcoal uppercase tracking-widest">Low Stock Alert</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {lowStockProducts.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => quickAddProduct(p)}
                                                className="flex items-center gap-3 px-3 py-2 bg-white border border-red-100 rounded-xl hover:border-brand-red transition-all group shadow-sm"
                                            >
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black text-brand-charcoal leading-none mb-1 uppercase">{p.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-brand-red font-data">STK: {p.stock_available}</span>
                                                    </div>
                                                </div>
                                                <div className="w-6 h-6 rounded-lg bg-red-50 text-brand-red flex items-center justify-center group-hover:bg-brand-red group-hover:text-white transition-colors">
                                                    <Plus size={14} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={index} className="flex flex-col lg:flex-row gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-brand-red/20 transition-all group/item overflow-visible relative">
                                        <div className="flex-[4] relative" ref={el => { dropdownRefs.current[index] = el; }}>
                                            <label className="block text-[9px] font-black text-slate-600 mb-1.5 uppercase">Product</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={14} /></div>
                                                <input
                                                    type="text"
                                                    placeholder="Focus to search product..."
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none"
                                                    value={item.searchQuery}
                                                    onChange={(e) => handleItemChange(index, 'searchQuery', e.target.value)}
                                                    onFocus={() => handleItemChange(index, 'isSearchOpen', true)}
                                                />
                                                {item.searchQuery && (
                                                    <button type="button" onClick={() => { const ni = [...items]; ni[index] = { ...ni[index], searchQuery: '', product_id: '', name: '', stock_available: 0, unit_price: 0, total_price: 0, currentLevel: 'master', selectedPath: {}, isSearchOpen: false }; setItems(ni); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-brand-red transition-colors">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            {item.isSearchOpen && (
                                                <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-h-[350px] overflow-hidden flex flex-col min-w-[400px] animate-fade-in">
                                                    {/* Back to Master Categories */}
                                                    {!item.searchQuery && item.currentLevel !== 'master' && (
                                                        <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleItemChange(index, 'currentLevel', 'master')}
                                                                className="flex items-center gap-1.5 text-[10px] font-black uppercase text-brand-red hover:text-brand-red-dark transition-colors"
                                                            >
                                                                <ChevronDown size={14} className="rotate-90" />
                                                                Back
                                                            </button>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                {item.selectedPath?.master}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                                                        {item.searchQuery ? (
                                                            // Global Search Mode
                                                            products.filter(p =>
                                                                p.name.toLowerCase().includes(item.searchQuery?.toLowerCase() || '')
                                                            ).length > 0 ? (
                                                                products.filter(p =>
                                                                    p.name.toLowerCase().includes(item.searchQuery?.toLowerCase() || '')
                                                                ).map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => selectProduct(index, p)}
                                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col gap-0.5"
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[11px] font-black text-brand-charcoal uppercase">{p.name}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                            <span className="text-slate-500 font-medium font-data">STK: <span className={p.stock_available <= 5 ? 'text-brand-red font-bold' : 'text-emerald-600'}>{p.stock_available}</span></span>
                                                                        </div>
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="p-8 text-center bg-slate-50 rounded-xl">
                                                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-2"><Search size={16} /></div>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No products found</p>
                                                                </div>
                                                            )
                                                        ) : item.currentLevel === 'master' ? (
                                                            // Level 1: Master Categories
                                                            Array.from(new Set(products.map(p => p.name.split(' > ')[0]))).sort().map(m => (
                                                                <button
                                                                    key={m}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newItems = [...items];
                                                                        newItems[index].selectedPath = { master: m };
                                                                        newItems[index].currentLevel = 'product';
                                                                        setItems(newItems);
                                                                    }}
                                                                    className="w-full text-left px-5 py-4 hover:bg-brand-red-light/10 border-b border-slate-50 last:border-0 flex items-center justify-between group"
                                                                >
                                                                    <span className="text-[11px] font-black text-brand-charcoal uppercase tracking-wider">{m}</span>
                                                                    <ChevronDown size={14} className="-rotate-90 text-slate-300 group-hover:text-brand-red transition-colors" />
                                                                </button>
                                                            ))
                                                        ) : (
                                                            // Level 2: All products under selected master
                                                            products
                                                                .filter(p => p.name.split(' > ')[0] === item.selectedPath?.master)
                                                                .map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => selectProduct(index, p)}
                                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col gap-0.5"
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[11px] font-black text-brand-charcoal uppercase">
                                                                                {p.name.split(' > ').slice(1).join(' > ')}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                            <span className="text-slate-500 font-medium font-data">STK: <span className={p.stock_available <= 5 ? 'text-brand-red font-bold' : 'text-emerald-600'}>{p.stock_available}</span></span>
                                                                        </div>
                                                                    </button>
                                                                ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-[2]">
                                            <label className="block text-[9px] font-black text-slate-600 mb-1.5 uppercase">Unit Cost</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">₱</span>
                                                <input type="number" step="0.01" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-3 py-2.5 text-xs font-data focus:border-brand-red outline-none shadow-inner" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)} />
                                            </div>
                                        </div>
                                        <div className="flex-[1.5]">
                                            <label className="block text-[9px] font-black text-slate-600 mb-1.5 uppercase">Qty</label>
                                            <input type="number" min="1" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-data focus:border-brand-red outline-none shadow-inner" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} />
                                        </div>
                                        <div className="flex-[2.5] text-right min-w-[120px]">
                                            <label className="block text-[9px] font-black text-slate-600 mb-1.5 uppercase">Sub-Total</label>
                                            <div className="py-2.5 font-black text-lg text-brand-charcoal font-data">₱{item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        <div className="flex items-center justify-center lg:pt-5">
                                            <button type="button" onClick={() => handleRemoveItem(index)} disabled={items.length === 1} className="p-2.5 text-slate-300 hover:text-brand-red hover:bg-brand-red/5 rounded-xl transition-all disabled:opacity-0"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-8 py-6 bg-brand-charcoal flex flex-col md:flex-row items-end md:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-white/60 relative z-10 w-full md:w-auto">
                        <div><p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Subtotal</p><p className="text-xl font-black font-data text-white">₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                        {isVatEnabled && <div><p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">VAT (12%)</p><p className="text-xl font-black font-data text-brand-red">- ₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>}
                        <div className={`transition-all ${isDiscountEnabled ? 'opacity-100' : 'opacity-20'}`}>
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Discount (10%)</p>
                            <p className="text-xl font-black font-data text-brand-orange">- ₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end relative z-10 w-full md:w-auto">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Total Payable</p>
                        <div className="flex items-center gap-6">
                            <p className="text-3xl lg:text-5xl font-black text-white font-data">₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <button form="purchase-form" type="submit" disabled={loading || success} className="px-8 py-4 bg-brand-red hover:bg-brand-red-dark text-white rounded-2xl font-black text-sm shadow-red active:scale-95 disabled:opacity-50 tracking-widest uppercase">
                                {loading ? 'SYNCING...' : success ? 'SAVED!' : 'SAVE PURCHASE'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Receipt Overlay */}
            {success && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-brand-charcoal/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-slide-up relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-brand-red" />

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Purchase Saved</h3>
                            <p className="text-slate-800 text-sm font-bold opacity-80">Check invoice details before saving</p>
                        </div>

                        <div className="border-2 border-dashed border-slate-100 rounded-2xl p-6 space-y-6 bg-slate-50/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-4">INVOICE #</h3>
                                    <p className="text-sm font-black text-brand-charcoal font-data">{invoiceNumber}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{purchaseType === 'supplier' ? 'Supplier' : 'Source'}</p>
                                    <p className="text-sm font-black text-brand-charcoal uppercase">{supplier}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Itemized List</p>
                                <div className="max-h-48 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                                    {savedData.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-[11px]">
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-700 leading-tight">{item.products?.name}</p>
                                                <p className="text-[9px] text-slate-400 font-data">x{item.quantity} @ ₱{item.unit_price.toLocaleString()}</p>
                                            </div>
                                            <p className="font-black text-brand-charcoal font-data">₱{item.total_price.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t-2 border-dashed border-slate-200 space-y-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="font-black text-slate-400 uppercase">Subtotal</span>
                                    <span className="font-black text-brand-charcoal font-data">₱{subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-[11px] font-black text-brand-charcoal uppercase tracking-widest">Total Cost</span>
                                    <span className="text-2xl font-black text-brand-charcoal font-data tracking-tighter">₱{grandTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-4 pt-2">
                                <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${status === 'received' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{status}</span>
                                <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${purchaseType === 'transfer' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-brand-red/10 text-brand-red border-brand-red/20'}`}>{purchaseType}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                onSuccess(savedData);
                                onClose();
                            }}
                            className="w-full mt-8 py-4 bg-brand-charcoal text-white rounded-2xl font-black text-sm hover:bg-black transition-all active:scale-[0.98] uppercase tracking-[0.2em] shadow-xl"
                        >
                            CLOSE RECEIPT
                        </button>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
