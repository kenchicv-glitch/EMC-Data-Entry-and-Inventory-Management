import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { Truck, AlertCircle, Plus, Trash2, ShieldCheck, Clock, Search, Building2, Store, ChevronDown, User, X, Tag } from 'lucide-react';
import { supplierService } from '../../suppliers/services/supplierService';
import type { Supplier } from '../../suppliers/types/supplier';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useKeyboardNav } from '../../../shared/hooks/useKeyboardNav';
import { toast } from 'sonner';
import { isSmartMatch } from '../../../shared/lib/searchUtils';

interface Product {
    id: string;
    name: string;
    sku: string;
    stock_available: number;
    buying_price: number;
    price?: number;
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
    highlightedIndex?: number;
    currentLevel?: 'master' | 'category' | 'subcategory' | 'product';
    selectedPath?: {
        master?: string;
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
        paymentStatus?: 'unpaid' | 'partial' | 'paid';
        paymentDate?: string | null;
        receivedDate?: string | null;
        date?: string;
        isVatEnabled: boolean;
        isDiscountEnabled: boolean;
        purchaseType?: 'supplier' | 'transfer';
        supplierId?: string | null;
        sourceBranchId?: number | null;
        transactionLabel?: string | null;
    };
}

interface Branch {
    id: number;
    name: string;
    code: string | null;
}

const PURCHASE_LABELS = [
    { id: 'Purch1', label: 'Purch1 (Cash)' },
    { id: 'Purch2', label: 'Purch2 (Sister Co Debt)' },
    { id: 'Purch3', label: 'Purch3 (Supplier Credit)' }
];

export default function PurchaseModal({ isOpen, onClose, onSuccess, editData }: PurchaseModalProps) {
    const { activeBranchId } = useBranch();
    const [products, setProducts] = useState<Product[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [supplierId, setSupplierId] = useState<string | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
    const [isSupplierSearchOpen, setIsSupplierSearchOpen] = useState(false);
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
    const [transactionLabel, setTransactionLabel] = useState<string>('');
    const [supplierVatRegistered, setSupplierVatRegistered] = useState(false);
    const [supplierTin, setSupplierTin] = useState('');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [sourceBranchId, setSourceBranchId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [savedData, setSavedData] = useState<(PurchaseRecord & { products?: { name: string } })[]>([]);
    const [showLowStock, setShowLowStock] = useState(false);

    const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
    const searchInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const quantityInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const unitCostInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const supplierSearchInputRef = useRef<HTMLInputElement>(null);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);
    const saveButtonRef = useRef<HTMLButtonElement>(null);

    const handleAddItem = useCallback(() => {
        setItems(prev => [...prev, {
            product_id: '',
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            searchQuery: '',
            isSearchOpen: false,
            currentLevel: 'master',
            selectedPath: {}
        }]);

        // Auto-focus the new search input
        setTimeout(() => {
            if (searchInputRefs.current[items.length]) {
                searchInputRefs.current[items.length]?.focus();
            }
        }, 100);
    }, [items.length]);

    const handleRemoveItem = useCallback((index: number) => {
        setItems(prev => {
            if (prev.length === 1) return prev;
            return prev.filter((_, i) => i !== index);
        });
    }, []);

    // Keyboard navigation for line items
    const completedItems = items.filter(it => it.product_id);
    const {
        focusedIndex,
        deleteConfirmIndex,
        setEditingQtyIndex,
        handleListKeyDown,
        resetNav,
    } = useKeyboardNav({
        itemCount: completedItems.length,
        searchInputRef: { current: searchInputRefs.current[items.length - 1] || searchInputRefs.current[0] } as React.RefObject<HTMLInputElement | null>,
        saveButtonRef,
        onEditQuantity: (idx) => {
            const actualIdx = items.findIndex((_, i) => {
                let completedCount = 0;
                for (let j = 0; j <= i; j++) {
                    if (items[j].product_id) completedCount++;
                    if (completedCount === idx + 1) return true;
                }
                return false;
            });
            if (actualIdx !== -1) {
                quantityInputRefs.current[actualIdx]?.focus();
                quantityInputRefs.current[actualIdx]?.select();
                setEditingQtyIndex(idx);
            }
        },
        onRemoveItem: (idx) => {
            const actualIdx = items.findIndex((_, i) => {
                let completedCount = 0;
                for (let j = 0; j <= i; j++) {
                    if (items[j].product_id) completedCount++;
                    if (completedCount === idx + 1) return true;
                }
                return false;
            });
            if (actualIdx !== -1) handleRemoveItem(actualIdx);
        },
        onEmptySearchEnter: () => {
            saveButtonRef.current?.focus();
        },
    });

    const fetchProducts = useCallback(async () => {
        let query = supabase
            .from('products')
            .select('id, name, sku, stock_available, buying_price')
            .order('name');

        if (activeBranchId) {
            query = query.eq('branch_id', activeBranchId);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) console.error('Error fetching products:', fetchError);
        else setProducts(data || []);
    }, [activeBranchId]);

    const fetchSuppliers = useCallback(async () => {
        try {
            const data = await supplierService.getAll(activeBranchId);
            setSuppliers(data);
        } catch (err) {
            console.error('Error fetching suppliers:', err);
        }
    }, [activeBranchId]);

    const fetchBranches = useCallback(async () => {
        const { data, error } = await supabase
            .from('branches')
            .select('id, name, code')
            .order('name');
        
        if (error) console.error('Error fetching branches:', error);
        else setBranches(data || []);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            fetchSuppliers();
            fetchBranches();
            if (editData) {
                setInvoiceNumber(editData.invoiceNumber);
                setSupplier(editData.supplier);
                setPurchaseType(editData.purchaseType || 'supplier');
                setItems(editData.items.map(item => ({
                    ...item,
                    searchQuery: item.name || '',
                    isSearchOpen: false
                })));
                setStatus(editData.status);
                setPaymentStatus(editData.paymentStatus || 'unpaid');
                setPaymentDate(editData.paymentDate || null);
                setIsVatEnabled(editData.isVatEnabled);
                setIsDiscountEnabled(editData.isDiscountEnabled);
                setTransactionLabel(editData.transactionLabel || '');
                setSupplierId(editData.supplierId || null);
                setSourceBranchId(editData.sourceBranchId || null);
                setSupplierSearchQuery(editData.supplier || '');
                // Attempt to find supplier details if editing
                const s = suppliers.find(sup => sup.id === editData.supplierId);
                if (s) {
                    setSupplierVatRegistered(s.supplier_vat_registered || false);
                    setSupplierTin(s.supplier_tin || '');
                }
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
                setIsDiscountEnabled(false);
                setSupplierId(null);
                setSourceBranchId(null);
                setSupplierSearchQuery('');
                setTransactionLabel('');
            }
            setError(null);
            setSuccess(false);
            setSavedData([]);
            resetNav();
            document.body.classList.add('modal-open');

            // Auto-focus supplier search input
            setTimeout(() => {
                supplierSearchInputRef.current?.focus();
            }, 100);
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen, editData, fetchProducts, fetchSuppliers, fetchBranches, resetNav]);

    const handleItemChange = useCallback(<K extends keyof PurchaseItem>(index: number, field: K, value: PurchaseItem[K]) => {
        setItems(prev => {
            const newItems = [...prev];
            const item = { ...newItems[index], [field]: value };

            if (field === 'searchQuery') {
                item.isSearchOpen = true;
                if (!value) {
                    item.product_id = '';
                    item.name = '';
                    item.stock_available = 0;
                }
                item.highlightedIndex = 0;
            }

            if (field === 'quantity' || field === 'unit_price') {
                const q = field === 'quantity' ? (value as number) : item.quantity;
                const u = field === 'unit_price' ? (value as number) : item.unit_price;
                item.total_price = q * u;
            }

            newItems[index] = item;
            return newItems;
        });
    }, []);

    // Handle keyboard navigation for modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                (document.getElementById('purchase-form') as HTMLFormElement)?.requestSubmit();
            }

            if (e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 'a':
                        e.preventDefault();
                        handleAddItem();
                        break;
                    case 'backspace':
                        e.preventDefault();
                        if (items.length > 1) {
                            handleRemoveItem(items.length - 1);
                        }
                        break;
                }
            }
        };

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
            if (purchaseType === 'supplier' && isSupplierSearchOpen && 
                supplierSearchInputRef.current && !supplierSearchInputRef.current.contains(event.target as Node) &&
                supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
                setIsSupplierSearchOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, items.length, handleAddItem, handleRemoveItem, isSupplierSearchOpen, purchaseType]);

    const selectProduct = (index: number, product: Product) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            product_id: product.id,
            name: product.name,
            stock_available: product.stock_available,
            unit_price: product.buying_price || 0,
            total_price: (newItems[index].quantity || 1) * (product.buying_price || 0),
            searchQuery: product.name,
            isSearchOpen: false
        };
        setItems(newItems);

        // Auto-focus quantity input after selection
        setTimeout(() => {
            if (quantityInputRefs.current[index]) {
                quantityInputRefs.current[index]?.focus();
                quantityInputRefs.current[index]?.select();
            }
        }, 50);
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
                    unit_price: product.buying_price || 0,
                    total_price: product.buying_price || 0
                }
            ]);
        }
    };


    const selectSupplier = (selected: Supplier) => {
        setSupplier(selected.name);
        setSupplierId(selected.id);
        setSupplierSearchQuery(selected.name);
        setIsSupplierSearchOpen(false);
        setSupplierVatRegistered(selected.supplier_vat_registered || false);
        setSupplierTin(selected.supplier_tin || '');
        
        // Focus first product search input after selection
        setTimeout(() => {
            const firstInput = document.querySelector('input[placeholder="Search Product..."]') as HTMLInputElement;
            if (firstInput) firstInput.focus();
        }, 50);
    };

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const vatAmount = isVatEnabled ? (subtotal - (subtotal / 1.12)) : 0;
    const discountAmount = isDiscountEnabled ? (subtotal * 0.10) : 0;
    const grandTotal = subtotal - discountAmount;
    const lowStockProducts = products.filter(p => {
        const stk = Number(p.stock_available ?? 0);
        return stk <= 10;
    });
    const inputVatAmount = supplierVatRegistered ? (subtotal - (subtotal / 1.12)) : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || success) return;
        setLoading(true);
        setError(null);

        try {
            if (!invoiceNumber.trim()) throw new Error('Please enter a Reference/Invoice number');
            
            const currentSupplier = supplier;
            let currentSupplierId = supplierId;

            if (purchaseType === 'supplier') {
                if (!currentSupplier.trim()) throw new Error('Please enter a supplier name');
                
                // Handle new supplier creation
                if (!currentSupplierId) {
                    const existingSupplier = suppliers.find(s => s.name.toLowerCase() === currentSupplier.trim().toLowerCase());
                    if (existingSupplier) {
                        currentSupplierId = existingSupplier.id;
                    } else {
                        const { data: newSupplier, error: supplierError } = await supabase
                            .from('suppliers')
                            .insert({
                                name: currentSupplier.trim(),
                                branch_id: activeBranchId,
                                supplier_tin: supplierTin,
                                supplier_vat_registered: supplierVatRegistered
                            })
                            .select()
                            .single();
                        
                        if (supplierError) throw supplierError;
                        currentSupplierId = newSupplier.id;
                        // Refresh suppliers list
                        fetchSuppliers();
                    }
                }
            }

            if (purchaseType === 'transfer' && !sourceBranchId) throw new Error('Please select a source branch');
            if (purchaseType === 'transfer' && sourceBranchId === Number(activeBranchId)) throw new Error('Source branch cannot be the same as the current branch');
            
            if (items.some(item => !item.product_id)) throw new Error('Please select a product for all rows');
            if (items.some(item => item.quantity <= 0)) throw new Error('Quantity must be greater than zero');

            // Cross-branch validation if transfer
            if (purchaseType === 'transfer' && sourceBranchId) {
                const sourceBranchName = branches.find(b => b.id === sourceBranchId)?.name || 'Source Branch';
                for (const item of items) {
                    const destProduct = products.find(p => p.id === item.product_id);
                    if (!destProduct) continue;

                    // Check if product exists in source branch by SKU
                    // Since SKU might not be in our current 'products' list (which is filtered by branch),
                    // we need to check the database.
                    const { data: sourceProduct, error: productError } = await supabase
                        .from('products')
                        .select('id, stock_available')
                        .eq('sku', destProduct.sku || '')
                        .eq('branch_id', sourceBranchId)
                        .single();

                    if (productError || !sourceProduct) {
                        throw new Error(`Product "${destProduct.name}" does not exist in ${sourceBranchName}. Please create it there first.`);
                    }

                    if (sourceProduct.stock_available < item.quantity) {
                        throw new Error(`Insufficient stock for "${destProduct.name}" in ${sourceBranchName}. Available: ${sourceProduct.stock_available}`);
                    }
                }
            }

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
                    supplier: currentSupplier,
                    supplier_id: currentSupplierId,
                    status: status,
                    payment_status: paymentStatus,
                    payment_date: paymentStatus === 'paid' ? (paymentDate || new Date().toISOString()) : paymentDate,
                    user_id: user?.id,
                    vat_amount: isVatEnabled ? (vatAmount * itemRatio) : 0,
                    discount_amount: isDiscountEnabled ? (discountAmount * itemRatio) : 0,
                    is_discounted: isDiscountEnabled,
                    date: editData?.date || new Date().toISOString(),
                    received_date: status === 'received' ? (editData?.receivedDate || new Date().toISOString()) : null,
                    purchase_type: purchaseType,
                    source_branch_id: purchaseType === 'transfer' ? sourceBranchId : null,
                    supplier_tin: supplierTin,
                    supplier_vat_registered: supplierVatRegistered,
                    input_vat_amount: inputVatAmount * itemRatio,
                    branch_id: activeBranchId,
                    transaction_label: transactionLabel
                };
            });

            const { data: insertedData, error: insertError } = await supabase.from('purchases').insert(purchasesToInsert).select('*, products(name)');
            if (insertError) throw insertError;

            // Sync buying_price back to products table
            for (const item of items) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ buying_price: item.unit_price })
                    .eq('id', item.product_id);
                
                if (updateError) {
                    console.error(`Error updating buying_price for product ${item.product_id}:`, updateError);
                }
            }

            setSavedData(insertedData as (PurchaseRecord & { products?: { name: string } })[]);
            setSuccess(true);
            toast.success('Purchase saved successfully');
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4">
            <div className="w-full max-w-6xl rounded-3xl bg-surface shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[95vh] animate-slide-up text-left">
                <div className="flex items-center justify-between px-10 py-8 bg-brand-charcoal">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white shadow-brand-red/20 shadow-lg"><Truck size={16} /></div>
                        <h2 className="text-base font-black text-white uppercase tracking-widest">{editData ? 'Edit Purchase' : 'Create Purchase'}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-12 scrollbar-hide overflow-x-visible bg-surface">
                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                    <form id="purchase-form" onSubmit={handleSubmit} className="space-y-10 pb-24">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-3 p-2 bg-subtle rounded-xl border border-border-default flex flex-col gap-2 h-[68px]">
                                <div className="flex items-center justify-between p-1 bg-surface border border-border-default rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setPurchaseType('supplier')}
                                        className={`flex-1 py-1 rounded-md text-[9px] font-black transition-all flex items-center justify-center gap-1.5 ${purchaseType === 'supplier' ? 'bg-brand-red text-white shadow-sm' : 'text-text-muted hover:bg-subtle'}`}
                                    >
                                        <Store size={12} /> SUPP
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPurchaseType('transfer')}
                                        className={`flex-1 py-1 rounded-md text-[9px] font-black transition-all flex items-center justify-center gap-1.5 ${purchaseType === 'transfer' ? 'bg-brand-red text-white shadow-sm' : 'text-text-muted hover:bg-subtle'}`}
                                    >
                                        <Building2 size={12} /> TRAN
                                    </button>
                                </div>
                                <div className="relative">
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted">
                                        {purchaseType === 'supplier' ? <User size={12} /> : <Building2 size={12} />}
                                    </div>
                                     {purchaseType === 'supplier' ? (
                                         <>
                                             <input
                                                 ref={supplierSearchInputRef}
                                                 type="text"
                                                 required
                                                 placeholder="Search Supplier..."
                                                 className="w-full bg-surface border border-border-default rounded-lg pl-7 pr-6 py-1 text-[11px] focus:ring-2 focus:ring-brand-red/10 outline-none shadow-sm font-medium text-text-primary uppercase h-[24px]"
                                                 value={supplierSearchQuery}
                                                 onChange={(e) => {
                                                     setSupplierSearchQuery(e.target.value);
                                                     setSupplier(e.target.value);
                                                     setIsSupplierSearchOpen(true);
                                                     if (!e.target.value) setSupplierId(null);
                                                 }}
                                                 onFocus={() => setIsSupplierSearchOpen(true)}
                                             />
                                             {isSupplierSearchOpen && purchaseType === 'supplier' && (
                                                 <div ref={supplierDropdownRef} className="absolute z-[110] left-0 right-0 top-full mt-1 bg-surface border border-border-default rounded-xl shadow-2xl max-h-[300px] overflow-y-auto animate-fade-in">
                                                     {suppliers.filter(s => isSmartMatch(s.name, supplierSearchQuery)).map(s => (
                                                         <button
                                                             key={s.id}
                                                             type="button"
                                                             onClick={() => selectSupplier(s)}
                                                             className="w-full text-left px-3 py-2 hover:bg-bg-subtle border-b border-border-muted last:border-0 flex flex-col gap-0.5"
                                                         >
                                                             <span className="text-[10px] font-black text-text-primary uppercase">{s.name}</span>
                                                             <span className="text-[8px] text-text-secondary uppercase">VAT: {s.supplier_vat_registered ? 'YES' : 'NO'}</span>
                                                         </button>
                                                     ))}
                                                     {supplierSearchQuery.trim() && !suppliers.find(s => s.name.toLowerCase() === supplierSearchQuery.trim().toLowerCase()) && (
                                                         <button
                                                             type="button"
                                                             onClick={() => {
                                                                 setIsSupplierSearchOpen(false);
                                                                 toast.info(`New supplier "${supplierSearchQuery}" will be created on save`);
                                                             }}
                                                             className="w-full text-left px-3 py-3 hover:bg-brand-red-light/10 text-brand-red border-t border-brand-red/10 animate-pulse"
                                                         >
                                                             <div className="flex items-center gap-2">
                                                                 <Plus size={12} />
                                                                 <span className="text-[9px] font-black uppercase tracking-widest text-brand-red">Create New Supplier: {supplierSearchQuery.toUpperCase()}</span>
                                                             </div>
                                                         </button>
                                                     )}
                                                 </div>
                                             )}
                                         </>
                                    ) : (
                                        <select
                                            required
                                            className="w-full bg-surface border border-border-default rounded-lg pl-7 pr-4 py-1 text-[11px] focus:ring-2 focus:ring-brand-red/10 outline-none shadow-sm font-black text-text-primary appearance-none cursor-pointer uppercase h-[24px]"
                                            value={sourceBranchId || ''}
                                            onChange={(e) => {
                                                const bId = Number(e.target.value);
                                                setSourceBranchId(bId);
                                                const bName = branches.find(b => b.id === bId)?.name || '';
                                                setSupplier(bName);
                                            }}
                                        >
                                            <option value="" disabled>SELECT BRANCH</option>
                                            {branches.filter(branch => branch.id !== Number(activeBranchId)).map(branch => (<option key={branch.id} value={branch.id}>{branch.name.toUpperCase()}</option>))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-2 p-2 bg-subtle rounded-xl border border-border-default h-[68px]">
                                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1 flex items-center gap-2">Ref #</label>
                                <input type="text" required className="w-full bg-surface border border-border-default rounded-lg px-2 py-1 text-xs font-data outline-none tracking-widest text-text-primary focus:border-brand-red h-[32px]" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                            </div>

                            <div className="md:col-span-4 p-2 bg-subtle rounded-xl border border-border-default flex gap-3 h-[68px]">
                                <div className="flex-1 space-y-1">
                                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Status</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button type="button" onClick={() => setStatus('pending')} className={`py-1 rounded-lg border text-[9px] font-black transition-all flex items-center justify-center gap-1.5 ${status === 'pending' ? 'bg-orange-500 text-white border-orange-600 shadow-sm' : 'bg-surface text-text-muted border-border-default hover:bg-subtle'}`}><Clock size={10} /> PND</button>
                                        <button type="button" onClick={() => setStatus('received')} className={`py-1 rounded-lg border text-[9px] font-black transition-all flex items-center justify-center gap-1.5 ${status === 'received' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-surface text-text-muted border-border-default hover:bg-subtle'}`}><ShieldCheck size={10} /> REC</button>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Payment</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        <button type="button" onClick={() => setPaymentStatus('unpaid')} className={`py-1 rounded-lg border text-[8px] font-black transition-all ${paymentStatus === 'unpaid' ? 'bg-red-500 text-white border-red-600 shadow-sm' : 'bg-surface text-text-muted border-border-default hover:bg-subtle'}`}>UN</button>
                                        <button type="button" onClick={() => setPaymentStatus('partial')} className={`py-1 rounded-lg border text-[8px] font-black transition-all ${paymentStatus === 'partial' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-surface text-text-muted border-border-default hover:bg-subtle'}`}>PRT</button>
                                        <button type="button" onClick={() => setPaymentStatus('paid')} className={`py-1 rounded-lg border text-[8px] font-black transition-all ${paymentStatus === 'paid' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-surface text-text-muted border-border-default hover:bg-subtle'}`}>FUL</button>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-3 p-2 bg-subtle rounded-xl border border-border-default h-[68px]">
                                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1 flex items-center gap-2"><Tag size={12} /> Label</label>
                                <select 
                                    className="w-full bg-surface border border-border-default rounded-xl px-2 py-1 text-[11px] font-black text-text-primary outline-none focus:ring-2 focus:ring-brand-red/10 appearance-none cursor-pointer uppercase h-[32px]"
                                    value={transactionLabel}
                                    onChange={(e) => setTransactionLabel(e.target.value)}
                                >
                                    <option value="">NO LABEL</option>
                                    {PURCHASE_LABELS.map(label => (<option key={label.id} value={label.id}>{label.label}</option>))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-border-default pb-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-xs font-black uppercase text-text-primary tracking-widest">Stock Items</h3>
                                    {lowStockProducts.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowLowStock(!showLowStock)}
                                            className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all flex items-center gap-1.5 ${showLowStock ? 'bg-brand-red text-white' : 'bg-brand-red/10 text-brand-red border border-brand-red/20'}`}
                                        >
                                            <AlertCircle size={12} />
                                            {showLowStock ? 'HIDE LOW STOCK' : `${lowStockProducts.length} LOW STOCK ITEMS`}
                                        </button>
                                    )}
                                </div>
                                <button type="button" onClick={handleAddItem} className="bg-brand-red-light/10 text-brand-red px-4 py-2 rounded-xl text-[10px] font-black hover:bg-brand-red hover:text-white transition-all border border-brand-red/20 shadow-sm">
                                    <Plus size={14} className="inline mr-1" /> ADD ITEM
                                </button>
                            </div>

                            {supplierVatRegistered && (
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white"><ShieldCheck size={16} /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">VAT Registered Supplier</p>
                                            <p className="text-[9px] font-bold text-emerald-500/80">Input VAT will be auto-calculated for BIR compliance.</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Est. Input VAT</p>
                                        <p className="text-sm font-black text-emerald-500 font-data">₱{inputVatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            )}

                            {showLowStock && lowStockProducts.length > 0 && (
                                <div className="p-4 bg-brand-red/5 border border-brand-red/20 rounded-2xl animate-fade-in">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertCircle className="text-brand-red" size={14} />
                                        <h4 className="text-[10px] font-black text-text-primary uppercase tracking-widest">Low Stock Alert</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {lowStockProducts.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => quickAddProduct(p)}
                                                className="flex items-center gap-3 px-3 py-2 bg-surface border border-border-default rounded-xl hover:border-brand-red transition-all group shadow-sm"
                                            >
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black text-text-primary leading-none mb-1 uppercase">{p.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-brand-red font-data">STK: {p.stock_available}</span>
                                                    </div>
                                                </div>
                                                <div className="w-6 h-6 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center group-hover:bg-brand-red group-hover:text-white transition-colors">
                                                    <Plus size={14} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div 
                                className="space-y-5 outline-none" 
                                tabIndex={focusedIndex >= 0 ? 0 : -1} 
                                onKeyDown={focusedIndex >= 0 ? handleListKeyDown : undefined}
                            >
                                {items.map((item, index) => (
                                    <div key={index} className={`flex flex-col lg:flex-row gap-5 p-5 rounded-2xl shadow-sm transition-all group/item overflow-visible relative ${item.product_id && focusedIndex === completedItems.indexOf(item) ? 'bg-blue-50 border-2 border-brand-red/30' : 'bg-subtle border border-border-default hover:border-brand-red/30'}`}>
                                        {/* Keyboard shortcut indicators */}
                                        {item.product_id && focusedIndex === completedItems.indexOf(item) && (
                                            <div className="absolute -top-3 left-4 flex gap-2 animate-bounce-subtle z-10">
                                                <span className="bg-brand-red text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                                                    <kbd className="bg-white/20 px-1 rounded">Q</kbd> QTY
                                                </span>
                                                <span className="bg-brand-red text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                                                    <kbd className="bg-white/20 px-1 rounded">R</kbd> REPLACE
                                                </span>
                                                <span className="bg-brand-red text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                                                    <kbd className="bg-white/20 px-1 rounded">DEL</kbd> REMOVE
                                                </span>
                                                {deleteConfirmIndex === focusedIndex && (
                                                    <span className="bg-brand-charcoal text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                                                        PRESS AGAIN TO REMOVE
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex-[4] relative" ref={el => { dropdownRefs.current[index] = el; }}>
                                            <label className="block text-[9px] font-black text-text-secondary mb-1.5 uppercase tracking-widest">Product</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"><Search size={14} /></div>
                                                <input
                                                    ref={el => { searchInputRefs.current[index] = el; }}
                                                    type="text"
                                                    placeholder="Focus to search product..."
                                                    className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-8 py-2.5 text-xs font-bold text-text-primary focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none"
                                                    value={item.searchQuery}
                                                    onChange={(e) => handleItemChange(index, 'searchQuery', e.target.value)}
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                        handleItemChange(index, 'isSearchOpen', true);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        const query = item.searchQuery || '';
                                                        const filtered = products.filter(p => isSmartMatch(p.name, query));

                                                        if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            if (item.isSearchOpen) {
                                                                handleItemChange(index, 'highlightedIndex', Math.min((item.highlightedIndex || 0) + 1, filtered.length - 1));
                                                            } else {
                                                                handleItemChange(index, 'isSearchOpen', true);
                                                            }
                                                        } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            handleItemChange(index, 'highlightedIndex', Math.max((item.highlightedIndex || 0) - 1, 0));
                                                        } else if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (item.isSearchOpen && filtered[item.highlightedIndex || 0]) {
                                                                selectProduct(index, filtered[item.highlightedIndex || 0]);
                                                            } else if (!item.searchQuery && completedItems.length > 0) {
                                                                saveButtonRef.current?.focus();
                                                            }
                                                        } else if (e.key === 'Escape') {
                                                            if (item.isSearchOpen) {
                                                                handleItemChange(index, 'isSearchOpen', false);
                                                            }
                                                        }
                                                    }}
                                                />
                                                {item.searchQuery && (
                                                    <button type="button" onClick={() => { const ni = [...items]; ni[index] = { ...ni[index], searchQuery: '', product_id: '', name: '', stock_available: 0, unit_price: 0, total_price: 0, currentLevel: 'master', selectedPath: {}, isSearchOpen: false }; setItems(ni); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-brand-red transition-colors">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            {item.isSearchOpen && (
                                                <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-surface border border-border-default rounded-xl shadow-2xl max-h-[350px] overflow-hidden flex flex-col min-w-[400px] animate-fade-in">
                                                    {/* Back to Master Categories */}
                                                    {!item.searchQuery && item.currentLevel !== 'master' && (
                                                        <div className="px-4 py-2 bg-subtle border-b border-border-default flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleItemChange(index, 'currentLevel', 'master')}
                                                                className="flex items-center gap-1.5 text-[10px] font-black uppercase text-brand-red hover:text-brand-red-dark transition-colors"
                                                            >
                                                                <ChevronDown size={14} className="rotate-90" />
                                                                Back
                                                            </button>
                                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                                {item.selectedPath?.master}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                                                        {item.searchQuery ? (
                                                            // Global Search Mode
                                                            products.filter(p =>
                                                                isSmartMatch(p.name, item.searchQuery || '')
                                                            ).length > 0 ? (
                                                                products.filter(p =>
                                                                    isSmartMatch(p.name, item.searchQuery || '')
                                                                ).map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => selectProduct(index, p)}
                                                                        className="w-full text-left px-3 py-2 hover:bg-bg-subtle border-b border-border-muted last:border-0 flex flex-col gap-0.5"
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-text-primary uppercase">{p.name}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[9px]">
                                                                            <span className="text-text-secondary font-medium font-data">STK: <span className={p.stock_available <= 5 ? 'text-brand-red font-bold' : 'text-emerald-500'}>{p.stock_available}</span></span>
                                                                        </div>
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="p-8 text-center bg-subtle rounded-xl">
                                                                    <div className="w-10 h-10 bg-base rounded-full flex items-center justify-center text-text-muted mx-auto mb-2"><Search size={16} /></div>
                                                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">No products found</p>
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
                                                                    className="w-full text-left px-3 py-2.5 hover:bg-brand-red/10 border-b border-border-muted last:border-0 flex items-center justify-between group"
                                                                >
                                                                    <span className="text-[10px] font-black text-text-primary uppercase tracking-wider">{m}</span>
                                                                    <ChevronDown size={12} className="-rotate-90 text-text-muted group-hover:text-brand-red transition-colors" />
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
                                                                        className="w-full text-left px-3 py-2 hover:bg-bg-subtle border-b border-border-muted last:border-0 flex flex-col gap-0.5"
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-text-primary uppercase">
                                                                                {p.name.split(' > ').slice(1).join(' > ')}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[9px]">
                                                                            <span className="text-text-secondary font-medium font-data">STK: <span className={p.stock_available <= 5 ? 'text-brand-red font-bold' : 'text-emerald-500'}>{p.stock_available}</span></span>
                                                                        </div>
                                                                    </button>
                                                                ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-[2]">
                                            <label className="block text-[9px] font-black text-text-secondary mb-1.5 uppercase tracking-widest">Unit Cost</label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">₱</span>
                                                <input
                                                    ref={el => { unitCostInputRefs.current[index] = el; }}
                                                    type="number"
                                                    step="0.01"
                                                    className={`w-full bg-bg-surface border ${item.unit_price > (products.find(p => p.id === item.product_id)?.buying_price || 0) * 1.5 ? 'border-amber-400' : 'border-border-default'} rounded-lg pl-5 pr-2 py-1.5 text-xs font-data focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none text-text-primary shadow-inner h-[32px]`}
                                                    value={item.unit_price}
                                                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (index === items.length - 1) {
                                                                handleAddItem();
                                                            } else {
                                                                searchInputRefs.current[index + 1]?.focus();
                                                            }
                                                        } else if (e.key === 'Escape') {
                                                            quantityInputRefs.current[index]?.focus();
                                                        }
                                                    }}
                                                />
                                            </div>
                                            {item.unit_price > (products.find(p => p.id === item.product_id)?.buying_price || 0) * 2 && (
                                                <p className="text-[8px] font-black text-amber-500 uppercase mt-1 flex items-center gap-1"><AlertCircle size={8} /> High Cost Alert</p>
                                            )}
                                        </div>
                                        <div className="flex-[1.5]">
                                            <label className="block text-[9px] font-black text-text-secondary mb-1.5 uppercase tracking-widest">Qty</label>
                                            <input
                                                ref={el => { quantityInputRefs.current[index] = el; }}
                                                type="number"
                                                step="0.25"
                                                min="0"
                                                className="w-full bg-bg-surface border border-border-default rounded-lg px-2 py-1.5 text-xs font-data focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none text-text-primary shadow-inner h-[32px]"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                onFocus={(e) => e.target.select()}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        unitCostInputRefs.current[index]?.focus();
                                                        unitCostInputRefs.current[index]?.select();
                                                    } else if (e.key === 'Escape') {
                                                        searchInputRefs.current[index]?.focus();
                                                    }
                                                }}
                                            />
                                            {item.name?.toLowerCase().includes('elf') && (
                                                <div className="mt-1.5 p-1.5 bg-brand-red/5 border border-brand-red/10 rounded-lg animate-fade-in group/calc relative">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-[8px] font-black text-brand-red uppercase tracking-widest leading-none">Cubic Calc</span>
                                                        <input 
                                                            type="number" 
                                                            placeholder="m³"
                                                            className="w-12 bg-surface border border-border-default rounded px-1 py-0.5 text-[9px] font-data outline-none focus:border-brand-red h-[16px]"
                                                            onChange={(e) => {
                                                                const m3 = parseFloat(e.target.value);
                                                                if (!isNaN(m3)) {
                                                                    const elf = m3 / 1.6;
                                                                    const rounded = Math.floor(elf / 0.25) * 0.25;
                                                                    handleItemChange(index, 'quantity', rounded);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="absolute bottom-full left-0 mb-1 opacity-0 group-hover/calc:opacity-100 transition-opacity bg-brand-charcoal text-white text-[8px] p-2 rounded-lg shadow-xl z-20 w-32 pointer-events-none border border-white/10">
                                                        <p className="font-bold mb-1 uppercase tracking-widest text-brand-red">Formula:</p>
                                                        <p className="opacity-80">ELF = m³ / 1.6</p>
                                                        <p className="opacity-80">Rnd: Down to 0.25</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-[2.5] text-right min-w-[100px]">
                                            <label className="block text-[9px] font-black text-text-secondary mb-1.5 uppercase tracking-widest">Sub-Total</label>
                                            <div className="py-1 font-black text-base text-text-primary font-data">₱{item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        <div className="flex items-center justify-center lg:pt-4">
                                            <button type="button" onClick={() => handleRemoveItem(index)} disabled={items.length === 1} className="p-1.5 text-text-muted hover:text-brand-red hover:bg-brand-red/5 rounded-lg transition-all disabled:opacity-0"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-10 py-8 bg-brand-charcoal flex flex-col md:flex-row items-end md:items-center justify-between gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="flex flex-wrap items-center gap-x-10 gap-y-4 text-white/60 relative z-10 w-full md:w-auto">
                        <div className="min-w-[120px]"><p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Subtotal</p><p className="text-base lg:text-lg font-black font-data text-white whitespace-nowrap">₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                        <div className={`min-w-[120px] transition-all ${isDiscountEnabled ? 'opacity-100' : 'opacity-20'}`}>
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Discount (10%)</p>
                            <p className="text-base lg:text-lg font-black font-data text-brand-orange whitespace-nowrap">- ₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end relative z-10 w-full md:w-auto max-w-full overflow-hidden">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1 leading-none">Total Payable</p>
                        <div className="flex flex-wrap items-center justify-end gap-6 text-right">
                            <p className="text-3xl lg:text-4xl font-black text-white font-data shadow-sm whitespace-nowrap">₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <button form="purchase-form" type="submit" ref={saveButtonRef} disabled={loading || success} className="px-8 py-4 bg-brand-red hover:bg-brand-red-dark text-white rounded-2xl font-black text-sm shadow-red active:scale-95 disabled:opacity-50 tracking-widest uppercase focus:ring-2 focus:ring-brand-red ring-offset-2 outline-none">
                                {loading ? 'SYNCING...' : success ? 'SAVED!' : 'SAVE PURCHASE'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Receipt Overlay */}
            {success && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-bg-surface rounded-3xl p-8 max-w-md w-full shadow-2xl border border-border-muted animate-slide-up relative overflow-hidden text-text-primary">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-brand-red" />

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-text-primary uppercase tracking-tight">Purchase Saved</h3>
                            <p className="text-text-secondary text-sm font-bold">Check invoice details before saving</p>
                        </div>

                        <div className="border-2 border-dashed border-border-muted rounded-2xl p-6 space-y-6 bg-bg-subtle/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">INVOICE #</h3>
                                    <p className="text-sm font-black text-text-primary font-data">{invoiceNumber}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">{purchaseType === 'supplier' ? 'Supplier' : 'Source'}</p>
                                    <p className="text-sm font-black text-text-primary uppercase">{supplier}</p>
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

                            <div className="pt-4 border-t-2 border-dashed border-border-muted space-y-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="font-black text-text-muted uppercase">Subtotal</span>
                                    <span className="font-black text-text-primary font-data">₱{subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-[11px] font-black text-text-primary uppercase tracking-widest">Total Cost</span>
                                    <span className="text-2xl font-black text-text-primary font-data tracking-tighter">₱{grandTotal.toLocaleString()}</span>
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
                                // Stay open but reset for next transaction
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
                                setSupplierId(null);
                                setSupplierSearchQuery('');
                                setSuccess(false);
                                resetNav();
                                setTimeout(() => supplierSearchInputRef.current?.focus(), 100);
                            }}
                            className="w-full mt-8 py-4 bg-brand-red text-white rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all active:scale-[0.98] uppercase tracking-[0.2em] shadow-xl shadow-brand-red/20"
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
