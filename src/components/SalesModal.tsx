import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, ShoppingCart, AlertCircle, Plus, Trash2, Percent, ShieldCheck, User, Truck, PackageCheck, SendHorizonal, ChevronUp, ChevronDown, Check, Search } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    stock_available: number;
    selling_price: number;
    brand?: string;
    description?: string;
    buying_price?: number;
}

interface OrderItem {
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    name?: string;
    stock_available?: number;
    brand?: string;
    searchQuery?: string;
    isSearchOpen?: boolean;
    currentLevel?: 'master' | 'category' | 'subcategory' | 'product';
    selectedPath?: {
        master?: string;
        category?: string;
        subcategory?: string;
    };
}

interface SalesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newSales?: unknown[]) => void;
    editData?: {
        invoiceNumber: string;
        customerName?: string;
        fulfillmentStatus?: string;
        paymentMode?: string;
        items: OrderItem[];
        isVatEnabled: boolean;
        isDiscountEnabled: boolean;
        is_os?: boolean;
        date?: string;
        delivery_fee?: number;
    };
}

const PAYMENT_MODES = [
    { id: 'cash', label: 'Cash' },
    { id: 'gcash', label: 'GCash' },
    { id: 'cheque', label: 'Cheque' },
    { id: 'bank_transfer', label: 'Bank Transfer' },
    { id: 'others', label: 'Others' }
];

export default function SalesModal({ isOpen, onClose, onSuccess, editData }: SalesModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('000000');
    const [customerName, setCustomerName] = useState('');
    const [fulfillmentStatus, setFulfillmentStatus] = useState<'pickup' | 'delivered' | 'out'>('pickup');
    const [paymentMode, setPaymentMode] = useState('cash');
    const [isOs, setIsOs] = useState(false);
    const [originalDate, setOriginalDate] = useState<string | null>(null);
    const [items, setItems] = useState<OrderItem[]>([
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
    const [isVatEnabled, setIsVatEnabled] = useState(true);
    const [isDiscountEnabled, setIsDiscountEnabled] = useState(false);
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [showDeliveryPrompt, setShowDeliveryPrompt] = useState(false);
    const [promptStep, setPromptStep] = useState<'confirm' | 'input'>('confirm');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

    const fetchProducts = useCallback(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, stock_available, selling_price, brand, description, buying_price')
            .order('name');

        if (error) console.error('Error fetching products:', error);
        else setProducts(data || []);
    }, []);

    const fetchLatestInvoice = useCallback(async (osMode: boolean) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            let query = supabase.from('sales').select('invoice_number');

            if (osMode) {
                query = query.eq('is_os', true).gte('date', today);
            } else {
                query = query.eq('is_os', false);
            }

            const { data, error } = await query.order('date', { ascending: false }).limit(20);

            if (error) throw error;

            if (data && data.length > 0) {
                if (osMode) {
                    const nums = data.map(d => parseInt(d.invoice_number.replace(/OS-/g, ''))).filter(n => !isNaN(n));
                    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
                    setInvoiceNumber(`OS-${maxNum + 1}`);
                } else {
                    const lastInvoice = data[0].invoice_number;
                    const numericPart = lastInvoice.replace(/\D/g, '');
                    const nextNum = (parseInt(numericPart) || 0) + 1;
                    setInvoiceNumber(nextNum.toString().padStart(6, '0'));
                }
            } else {
                setInvoiceNumber(osMode ? 'OS-1' : '000001');
            }
        } catch (err) {
            console.error('Error fetching latest invoice:', err);
            setInvoiceNumber(osMode ? '1' : '000001');
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            if (editData) {
                setInvoiceNumber(editData.invoiceNumber);
                setCustomerName(editData.customerName || '');
                setFulfillmentStatus((editData.fulfillmentStatus as 'pickup' | 'delivered' | 'out') || 'pickup');
                setPaymentMode(editData.paymentMode || 'cash');
                setItems(editData.items.map(item => ({ ...item, searchQuery: item.name || '', isSearchOpen: false })));
                setIsVatEnabled(editData.isVatEnabled);
                setIsDiscountEnabled(editData.isDiscountEnabled);
                setIsOs(editData.is_os || false);
                setOriginalDate(editData.date || null);
                setDeliveryFee(0); // Reset fee so it's re-added via prompt
            } else {
                setCustomerName('');
                setFulfillmentStatus('pickup');
                setPaymentMode('cash');
                setIsOs(false);
                setOriginalDate(null);
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
                setIsVatEnabled(true);
                setIsDiscountEnabled(false);
            }
            setError(null);
            setSuccess(false);
            setShowDeliveryPrompt(false);
            setPromptStep('confirm');
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen, editData, fetchProducts]);

    useEffect(() => {
        if (isOpen && !editData) {
            fetchLatestInvoice(isOs);
        }
    }, [isOs, isOpen, editData, fetchLatestInvoice]);


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

    const handleInvoiceChange = (val: string) => {
        const num = val.replace(/\D/g, '');
        if (isOs) {
            setInvoiceNumber(num ? `OS-${num}` : 'OS-');
        } else {
            setInvoiceNumber(num.slice(0, 6).padStart(6, '0'));
        }
    };

    const stepInvoice = (dir: number) => {
        const current = parseInt(invoiceNumber) || 0;
        const next = Math.max(0, current + dir);
        setInvoiceNumber(next.toString().padStart(6, '0'));
    };

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

    const selectProduct = (index: number, product: Product) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            product_id: product.id,
            name: product.name,
            stock_available: product.stock_available,
            unit_price: product.selling_price || 0,
            total_price: newItems[index].quantity * (product.selling_price || 0),
            brand: product.brand,
            searchQuery: product.name,
            isSearchOpen: false
        };
        setItems(newItems);
    };

    const handleItemChange = <K extends keyof OrderItem>(index: number, field: K, value: OrderItem[K]) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        if (field === 'quantity' || field === 'unit_price') {
            const q = field === 'quantity' ? (value as number) : item.quantity;
            const u = field === 'unit_price' ? (value as number) : item.unit_price;
            item.total_price = q * u;
        }

        if (field === 'searchQuery') {
            item.isSearchOpen = true;
            if (!value) {
                item.product_id = '';
                item.name = '';
                item.unit_price = 0;
                item.total_price = 0;
            }
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const effectiveVatEnabled = isVatEnabled && !isOs;
    const vatAmount = effectiveVatEnabled ? (subtotal - (subtotal / 1.12)) : 0;
    const vatableSales = effectiveVatEnabled ? (subtotal / 1.12) : 0;
    const discountAmount = isDiscountEnabled ? (subtotal > 1300 ? 65 : subtotal * 0.05) : 0;
    const grandTotal = subtotal - discountAmount; // Calculate order WITHOUT delivery fee initially

    // Auto-switch to OS for orders <= 100 PHP (New Sales only)
    useEffect(() => {
        if (isOpen && !editData && grandTotal > 0) {
            const shouldBeOs = grandTotal <= 100;
            if (isOs !== shouldBeOs) {
                setIsOs(shouldBeOs);
            }
        }
    }, [grandTotal, isOpen, editData, isOs]);

    const validateAndSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (grandTotal > 100 && grandTotal <= 5000 && deliveryFee === 0 && !showDeliveryPrompt) {
            setPromptStep('confirm');
            setShowDeliveryPrompt(true);
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            if (!invoiceNumber.trim()) throw new Error('Please enter an invoice number');
            if (items.some(item => !item.product_id)) throw new Error('Please select a product for all rows');
            if (items.some(item => item.quantity <= 0)) throw new Error('Quantity must be greater than 0');

            const { data: { user } } = await supabase.auth.getUser();

            if (editData) {
                const { error: delError } = await supabase.from('sales').delete().eq('invoice_number', editData.invoiceNumber);
                if (delError) throw delError;
            }

            const { data: latestProducts } = await supabase.from('products').select('id, name, stock_available');
            for (const item of items) {
                const p = latestProducts?.find(prod => prod.id === item.product_id);
                if (p && item.quantity > (p.stock_available || 0)) throw new Error(`Insufficient stock for ${p.name}.`);
            }

            const salesToInsert = items.map(item => {
                const itemRatio = subtotal > 0 ? (item.total_price / subtotal) : (1 / items.length);
                const product = products.find(p => p.id === item.product_id);
                return {
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price,
                    invoice_number: invoiceNumber,
                    customer_name: customerName,
                    fulfillment_status: fulfillmentStatus,
                    payment_mode: paymentMode,
                    user_id: user?.id,
                    vat_amount: effectiveVatEnabled ? (vatAmount * itemRatio) : 0,
                    discount_amount: isDiscountEnabled ? (discountAmount * itemRatio) : 0,
                    is_discounted: isDiscountEnabled,
                    cost_price: product?.buying_price || 0,
                    is_os: isOs,
                    delivery_fee: deliveryFee,
                    ...(originalDate ? { date: originalDate, edited_at: new Date().toISOString() } : {})
                };
            });

            const { data: insertedData, error: insertError } = await supabase.from('sales').insert(salesToInsert).select('*, products(name, brand)');
            if (insertError) throw insertError;

            setSuccess(true);
            setTimeout(() => {
                onSuccess(insertedData as unknown as unknown[]);
                onClose();
            }, 800);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setShowDeliveryPrompt(false); // Close prompt on error so user can see/fix the issue
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 text-left">
            <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white"><ShoppingCart size={16} /></div>
                        <h2 className="text-base font-bold text-white uppercase tracking-wider">{editData ? 'Edit Sale' : 'New Sale'}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                    <form id="order-form" onSubmit={validateAndSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1.5 flex items-center gap-2"><PackageCheck size={12} /> Invoice #</label>
                                <div className="flex items-stretch gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            maxLength={isOs ? 15 : 6}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-sm font-data outline-none tracking-widest text-brand-charcoal focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/10 animate-fade-in"
                                            value={invoiceNumber}
                                            onChange={(e) => handleInvoiceChange(e.target.value)}
                                            placeholder={isOs ? 'OS-1' : '000001'}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsOs(!isOs);
                                            }}
                                            className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[10px] font-black transition-all ${isOs ? 'bg-brand-red text-white shadow-sm ring-2 ring-brand-red/20' : 'bg-white text-slate-300 border border-slate-100'}`}
                                        >
                                            OS
                                        </button>
                                    </div>
                                    {!isOs && (
                                        <div className="flex flex-col gap-1 shrink-0 animate-fade-in">
                                            <button type="button" onClick={() => stepInvoice(1)} title="Increment" className="flex items-center justify-center w-9 h-[calc(50%-2px)] bg-slate-100 hover:bg-brand-red hover:text-white text-slate-500 rounded-lg border border-slate-200 transition-all active:scale-95">
                                                <ChevronUp size={15} strokeWidth={2.5} />
                                            </button>
                                            <button type="button" onClick={() => stepInvoice(-1)} title="Decrement" className="flex items-center justify-center w-9 h-[calc(50%-2px)] bg-slate-100 hover:bg-brand-red hover:text-white text-slate-500 rounded-lg border border-slate-200 transition-all active:scale-95">
                                                <ChevronDown size={15} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="lg:col-span-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1.5 flex items-center gap-2"><User size={12} /> Customer Name</label>
                                <input type="text" placeholder="Optional" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-red/20 outline-none shadow-sm" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                            </div>
                            <div className="lg:col-span-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Truck size={12} /> Fulfillment</label>
                                <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none shadow-sm cursor-pointer" value={fulfillmentStatus} onChange={(e) => setFulfillmentStatus(e.target.value as 'pickup' | 'delivered' | 'out')}>
                                    <option value="pickup">Store Pickup</option>
                                    <option value="out">Product Out / For Delivery</option>
                                    <option value="delivered">Delivered Successfully</option>
                                </select>
                            </div>
                            <div className="lg:col-span-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest">Adjustments</label>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setIsVatEnabled(!isVatEnabled)} className={`flex-1 py-1.5 rounded-lg border text-[9px] font-black transition-all ${isVatEnabled ? 'bg-brand-red text-white border-brand-red shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}><Percent size={10} className="inline mr-1" /> VAT</button>
                                    <button type="button" onClick={() => setIsDiscountEnabled(!isDiscountEnabled)} className={`flex-1 py-1.5 rounded-lg border text-[9px] font-black transition-all ${isDiscountEnabled ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}><ShieldCheck size={10} className="inline mr-1" /> DSC</button>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-3">Settlement Mode</label>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {PAYMENT_MODES.map(mode => (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        onClick={() => setPaymentMode(mode.id)}
                                        className={`flex items-center justify-between px-4 py-2 rounded-xl border-2 transition-all ${paymentMode === mode.id ? 'border-brand-red bg-white shadow-sm' : 'border-white bg-white/50 text-slate-400 hover:border-slate-200'}`}
                                    >
                                        <span className={`text-[11px] font-black uppercase tracking-wider ${paymentMode === mode.id ? 'text-brand-charcoal' : ''}`}>{mode.label}</span>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${paymentMode === mode.id ? 'border-brand-red bg-brand-red' : 'border-slate-200'}`}>
                                            {paymentMode === mode.id && <Check size={10} className="text-white" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2"><h3 className="text-xs font-black uppercase text-brand-charcoal tracking-widest">Order Items</h3><button type="button" onClick={handleAddItem} className="bg-brand-red-light text-brand-red px-4 py-2 rounded-xl text-[10px] font-black hover:bg-brand-red hover:text-white transition-all"><Plus size={14} className="inline mr-1" /> ADD ITEM</button></div>
                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={index} className="flex flex-col lg:flex-row gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-brand-red/20 transition-all group/item overflow-visible">
                                        <div className="flex-[4] relative" ref={el => { dropdownRefs.current[index] = el; }}>
                                            <label className="block text-[9px] font-black text-brand-charcoal mb-1.5 uppercase">Product</label>
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
                                                    <button type="button" onClick={() => { const ni = [...items]; ni[index] = { ...ni[index], searchQuery: '', product_id: '', unit_price: 0, currentLevel: 'master', selectedPath: {}, isSearchOpen: false }; setItems(ni); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-brand-red transition-colors">
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
                                                                p.name.toLowerCase().includes(item.searchQuery?.toLowerCase() || '') ||
                                                                (p.brand?.toLowerCase().includes(item.searchQuery?.toLowerCase() || '') ?? false)
                                                            ).length > 0 ? (
                                                                products.filter(p =>
                                                                    p.name.toLowerCase().includes(item.searchQuery?.toLowerCase() || '') ||
                                                                    (p.brand?.toLowerCase().includes(item.searchQuery?.toLowerCase() || '') ?? false)
                                                                ).map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => selectProduct(index, p)}
                                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col gap-0.5"
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[11px] font-black text-brand-charcoal uppercase">{p.name} {p.brand ? <span className="text-brand-red">[{p.brand}]</span> : ''}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                            <span className="text-slate-500 font-medium font-data">STK: <span className={p.stock_available <= 5 ? 'text-brand-red font-bold' : 'text-emerald-600'}>{p.stock_available}</span></span>
                                                                            <span className="text-brand-charcoal font-black font-data">₱{p.selling_price.toLocaleString()}</span>
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
                                                            // Level 2: All products under the selected master
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
                                                                                {p.name.split(' > ').slice(1).join(' > ')} {p.brand ? <span className="text-brand-red">[{p.brand}]</span> : ''}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                            <span className="text-slate-500 font-medium font-data">STK: <span className={p.stock_available <= 5 ? 'text-brand-red font-bold' : 'text-emerald-600'}>{p.stock_available}</span></span>
                                                                            <span className="text-brand-charcoal font-black font-data">₱{p.selling_price.toLocaleString()}</span>
                                                                        </div>
                                                                    </button>
                                                                ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-[2]">
                                            <label className="block text-[9px] font-black text-brand-charcoal mb-1.5 uppercase">Unit Price (SRP)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">₱</span>
                                                <input readOnly type="number" step="0.01" className="w-full bg-slate-100/50 border border-slate-200 rounded-xl pl-6 pr-3 py-2.5 text-xs font-data text-slate-500 outline-none cursor-not-allowed" value={item.unit_price} />
                                            </div>
                                        </div>
                                        <div className="flex-[1.5]">
                                            <label className="block text-[9px] font-black text-brand-charcoal mb-1.5 uppercase">Qty</label>
                                            <input type="number" min="1" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-data focus:border-brand-red outline-none shadow-inner" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} />
                                        </div>
                                        <div className="flex-[2.5] text-right min-w-[120px]">
                                            <label className="block text-[9px] font-black text-brand-charcoal mb-1.5 uppercase">Sub-Total</label>
                                            <div className="py-2.5 font-black text-lg text-brand-charcoal font-data overflow-hidden text-ellipsis">₱{item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
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
                    <div className="flex flex-wrap items-center gap-x-10 gap-y-4 text-white/60 relative z-10 w-full md:w-auto">
                        <div className="min-w-[140px]">
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">VATable Sales</p>
                            <p className="text-base lg:text-xl font-black font-data text-white whitespace-nowrap">₱{vatableSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="min-w-[140px]">
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Tax (12%)</p>
                            <p className="text-base lg:text-xl font-black font-data text-brand-red whitespace-nowrap">₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className={`min-w-[140px] transition-all ${isDiscountEnabled ? 'opacity-100' : 'opacity-20'}`}>
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Discount</p>
                            <p className="text-base lg:text-xl font-black font-data text-brand-orange whitespace-nowrap">- ₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end relative z-10 w-full md:w-auto max-w-full overflow-hidden">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Items Total</p>
                        <div className="flex flex-wrap items-center justify-end gap-6 text-right">
                            <p className="text-3xl lg:text-5xl font-black text-white font-data shadow-sm whitespace-nowrap">₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <button form="order-form" type="submit" disabled={loading || success} className="px-8 lg:px-10 py-4 lg:py-5 bg-brand-red hover:bg-brand-red-dark text-white rounded-2xl font-black text-sm shadow-red active:scale-95 disabled:opacity-50 tracking-[0.2em] flex items-center gap-2 group shrink-0">
                                {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                <span>{loading ? 'PROCESSING' : success ? 'DONE!' : 'FINALIZE ORDER'}</span>
                                {!loading && !success && <SendHorizonal size={18} className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delivery Prompt Overlay */}
            {showDeliveryPrompt && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-brand-charcoal/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 animate-slide-up">
                        <div className="w-16 h-16 bg-brand-red-light rounded-2xl flex items-center justify-center text-brand-red mb-6 mx-auto">
                            <Truck size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-brand-charcoal text-center mb-1">Deliver</h3>
                        <p className="text-slate-400 text-center text-[10px] font-black uppercase tracking-[0.2em] mb-8">Order is Below 5,000</p>

                        <div className="space-y-3">
                            {promptStep === 'confirm' ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setPromptStep('input')}
                                        className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-sm shadow-red hover:bg-brand-red-dark transition-all active:scale-[0.98] uppercase tracking-widest ring-offset-2 focus:ring-2 focus:ring-brand-red"
                                    >
                                        YES
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeliveryFee(0);
                                            handleSubmit();
                                        }}
                                        className="w-full py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-bold text-xs hover:border-slate-200 hover:text-slate-500 transition-all uppercase tracking-widest"
                                    >
                                        NO
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeliveryPrompt(false)}
                                        className="w-full py-2 text-slate-300 hover:text-slate-400 transition-all text-[10px] font-black uppercase tracking-widest mt-2"
                                    >
                                        Back to Order
                                    </button>
                                </>
                            ) : (
                                <div className="animate-fade-in text-center">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">Delivery Fee (PHP)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                                            <input
                                                type="number"
                                                autoFocus
                                                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-lg font-data font-black text-brand-charcoal outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all text-center"
                                                placeholder="0.00"
                                                value={deliveryFee || ''}
                                                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSubmit()}
                                        className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-sm shadow-red hover:bg-brand-red-dark transition-all active:scale-[0.98] uppercase tracking-widest"
                                    >
                                        Save with Fee
                                    </button>
                                    <div className="flex flex-col gap-1 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setPromptStep('confirm')}
                                            className="w-full py-2 text-slate-400 hover:text-slate-500 transition-all text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowDeliveryPrompt(false)}
                                            className="w-full py-1 text-slate-300 hover:text-slate-400 transition-all text-[9px] font-bold uppercase tracking-widest"
                                        >
                                            Cancel & Edit Order
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
