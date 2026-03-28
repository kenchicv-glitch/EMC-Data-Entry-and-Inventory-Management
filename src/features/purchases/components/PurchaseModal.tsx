import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { Truck, AlertCircle, Plus, Trash2, ShieldCheck, Clock, Search, ChevronDown, X, Tag } from 'lucide-react';
import { supplierService } from '../../suppliers/services/supplierService';
import type { Supplier } from '../../suppliers/types/supplier';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useKeyboardNav } from '../../../shared/hooks/useKeyboardNav';
import { toast } from 'sonner';
import { isSmartMatch } from '../../../shared/lib/searchUtils';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/lib/queryKeys';

interface Product {
    id: string;
    name: string;
    sku: string;
    stock_available: number;
    buying_price: number;
    price?: number;
    unit?: string;
}

interface PurchaseItem {
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    name?: string;
    stock_available?: number;
    unit?: string;
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
    received_date: string | null;
    invoice_number: string;
    supplier: string;
    status: 'pending' | 'received';
    payment_status?: 'unpaid' | 'partial' | 'paid';
    payment_date?: string | null;
    purchase_type: 'supplier' | 'transfer';
    name?: string; // Product name for search query matching
}

interface PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newPurchases?: unknown[]) => void;
    editData?: {
        invoiceNumber: string;
        supplier: string;
        supplierId?: string | null;
        items: PurchaseRecord[];
        status: 'pending' | 'received';
        paymentStatus: 'unpaid' | 'partial' | 'paid';
        paymentDate?: string | null;
        date?: string;
        receivedDate?: string | null;
        isVatEnabled: boolean;
        isDiscountEnabled: boolean;
        sourceBranchId?: number | null;
        purchaseType: 'supplier' | 'transfer';
        transactionLabel?: string;
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
    const [isLabelDropdownOpen, setIsLabelDropdownOpen] = useState(false);
    const [isTransferDropdownOpen, setIsTransferDropdownOpen] = useState(false);
    const labelDropdownRef = useRef<HTMLDivElement>(null);
    const transferDropdownRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [rawInvoiceNum, setRawInvoiceNum] = useState(''); // Holds the numeric part during editing
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
    const queryClient = useQueryClient();

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

        // Auto-focus the new search input using items.length as the index for the new row
        setTimeout(() => {
            if (searchInputRefs.current[items.length]) {
                searchInputRefs.current[items.length]?.focus();
                searchInputRefs.current[items.length]?.select();
            }
        }, 150);
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
            .select('id, name, sku, stock_available, buying_price, unit')
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

    const fetchLatestPurchaseInvoice = useCallback(async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('purchases')
                .select('invoice_number')
                .order('invoice_number', { ascending: false })
                .limit(1);

            if (fetchError) throw fetchError;

            if (data && data.length > 0) {
                const lastInvoice = data[0].invoice_number;
                const numericPart = lastInvoice.replace(/\D/g, '');
                const nextNum = (parseInt(numericPart) || 0) + 1;
                const paddedNum = nextNum.toString().padStart(6, '0');
                setInvoiceNumber(paddedNum);
                setRawInvoiceNum(paddedNum);
            } else {
                const defaultNum = '000001';
                setInvoiceNumber(defaultNum);
                setRawInvoiceNum(defaultNum);
            }
        } catch (err) {
            console.error('Error fetching latest purchase invoice:', err);
            const defaultNum = '000001';
            setInvoiceNumber(defaultNum);
            setRawInvoiceNum(defaultNum);
        }
    }, []);

    // Initial setup and reset logic
    useEffect(() => {
        if (!isOpen) {
            document.body.classList.remove('modal-open');
            return;
        }

        // Fetch fresh data only once when modal opens
        fetchProducts();
        fetchSuppliers();
        fetchBranches();

        // Only run initialization once when modal opens
        if (editData) {
            setInvoiceNumber(editData.invoiceNumber);
            const numericPart = editData.invoiceNumber.replace(/\D/g, '');
            setRawInvoiceNum(numericPart.padStart(6, '0'));
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
            fetchLatestPurchaseInvoice();
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
            setStatus('received');
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

        // Auto-focus Source Entity (Supplier) search
        const focusTimer = setTimeout(() => {
            if (supplierSearchInputRef.current) {
                supplierSearchInputRef.current.focus();
            }
        }, 150);
        
        return () => {
            clearTimeout(focusTimer);
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]); // Strict dependency on isOpen to prevent resets while typing

    const stepInvoice = (dir: number) => {
        const current = parseInt(rawInvoiceNum) || 0;
        const next = Math.max(0, current + dir);
        const paddedNum = next.toString().padStart(6, '0');
        setRawInvoiceNum(paddedNum);
        setInvoiceNumber(paddedNum);
    };

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
            if (isLabelDropdownOpen && labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
                setIsLabelDropdownOpen(false);
            }
            if (isTransferDropdownOpen && transferDropdownRef.current && !transferDropdownRef.current.contains(event.target as Node)) {
                setIsTransferDropdownOpen(false);
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
    }, [isOpen, items.length, handleAddItem, handleRemoveItem, isSupplierSearchOpen, purchaseType, isLabelDropdownOpen, isTransferDropdownOpen]);

    const selectProduct = (index: number, product: Product) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            product_id: product.id,
            name: product.name,
            stock_available: product.stock_available,
            unit: product.unit,
            unit_price: product.buying_price || 0,
            total_price: (newItems[index].quantity || 1) * (product.buying_price || 0),
            searchQuery: product.name,
            isSearchOpen: false
        };
        setItems(newItems);

        // Auto-focus Unit Cost input after selection (Following: Product -> Unit Cost -> Quantity flow)
        setTimeout(() => {
            if (unitCostInputRefs.current[index]) {
                unitCostInputRefs.current[index]?.focus();
                unitCostInputRefs.current[index]?.select();
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
                    unit: product.unit,
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
                        
                        // Invalidate React Query cache so it reflects in the Suppliers page
                        queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.list(activeBranchId) });
                        queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
                        
                        // Refresh local modal list
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4 text-left">
            <div className="w-full max-w-5xl rounded-2xl bg-surface shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
                <div className="flex items-center justify-between px-8 py-5 bg-brand-charcoal">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-red/20"><Truck size={22} /></div>
                        <h2 className="text-xl font-black text-white uppercase tracking-widest">{editData ? 'Edit Purchase' : 'Create Purchase'}</h2>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X size={22} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide bg-surface">
                    {error && <div className="mb-4 p-3 bg-danger-subtle border border-danger text-danger text-sm rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                    <form 
                        id="purchase-form" 
                        onSubmit={handleSubmit} 
                        className="flex-1 flex flex-col overflow-hidden"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.ctrlKey) {
                                // Prevent saving on Enter (User Request: only ctrl+enter command will save)
                                e.preventDefault();
                            }
                        }}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 h-[730px]">
                            {/* Column 1: Items List (Left, 8/12) */}
                            <div className="md:col-span-8 flex flex-col h-full bg-subtle p-1.5 rounded-xl border border-border-default shadow-sm overflow-hidden gap-1.5">
                                {/* Compact Header */}
                                <div className="flex items-center justify-between gap-1.5 px-0.5">
                                    <div className="flex items-center gap-1.5 focus-within:ring-1 focus-within:ring-brand-red/10 rounded-lg transition-all px-0.5">
                                        <div className="px-1.5 py-0.5 bg-brand-red text-white text-[12px] font-black rounded uppercase tracking-tighter shadow-sm flex items-center justify-center h-[28px] min-w-[70px]">REFERENCE</div>
                                        <div className="relative group">
                                            <input 
                                                type="text"
                                                className="px-1.5 py-0.5 bg-surface border border-border-default text-[13px] font-data font-black text-text-primary rounded h-[28px] flex items-center justify-center min-w-[120px] outline-none focus:border-brand-red text-center uppercase transition-all"
                                                value={invoiceNumber}
                                                onChange={(e) => {
                                                    setInvoiceNumber(e.target.value);
                                                    setRawInvoiceNum(e.target.value.replace(/\D/g, ''));
                                                }}
                                                onFocus={(e) => e.target.select()}
                                            />
                                        </div>
                                        {/* Arrows (Fixed for UI Consistency) */}
                                        <div className="flex bg-surface border border-border-default rounded h-[28px] overflow-hidden">
                                            <button type="button" onClick={() => stepInvoice(1)} className="px-1 hover:bg-subtle text-text-muted transition-colors border-r border-border-default"><ChevronDown size={15} className="rotate-180" /></button>
                                            <button type="button" onClick={() => stepInvoice(-1)} className="px-1 hover:bg-subtle text-text-muted transition-colors"><ChevronDown size={15} /></button>
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleAddItem} className="text-brand-red text-[11px] font-black hover:bg-brand-red-light/10 px-2 py-1 rounded transition-all uppercase flex items-center gap-1">
                                        <Plus size={14} /> ADD ITEM
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto scrollbar-hide">
                                    <div 
                                        className="space-y-3 outline-none p-1" 
                                        tabIndex={focusedIndex >= 0 ? 0 : -1} 
                                        onKeyDown={focusedIndex >= 0 ? handleListKeyDown : undefined}
                                    >
                                        {lowStockProducts.length > 0 && (
                                            <div className="mb-2 px-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowLowStock(!showLowStock)}
                                                    className={`w-full text-[10px] font-black px-3 py-2 rounded-xl transition-all flex items-center justify-between ${showLowStock ? 'bg-brand-red text-white shadow-lg' : 'bg-brand-red/10 text-brand-red border border-brand-red/20 hover:bg-brand-red/20'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <AlertCircle size={14} />
                                                        <span>{lowStockProducts.length} LOW STOCK ITEMS DETECTED</span>
                                                    </div>
                                                    <ChevronDown size={14} className={`transition-transform ${showLowStock ? 'rotate-180' : ''}`} />
                                                </button>
                                                
                                                {showLowStock && (
                                                    <div className="mt-2 grid grid-cols-2 gap-2 animate-fade-in">
                                                        {lowStockProducts.map(p => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => quickAddProduct(p)}
                                                                className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-default rounded-xl hover:border-brand-red transition-all group shadow-sm text-left"
                                                            >
                                                                <div className="flex-1">
                                                                    <p className="text-[9px] font-black text-text-primary uppercase leading-none mb-1">{p.name}</p>
                                                                    <p className="text-[8px] font-black text-brand-red font-data">STK: {p.stock_available}</p>
                                                                </div>
                                                                <Plus size={12} className="text-brand-red group-hover:scale-125 transition-transform" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {items.map((item, index) => (
                                            <div key={index} className={`flex flex-col gap-3 p-4 rounded-xl transition-all group/item overflow-visible relative ${item.product_id && focusedIndex === completedItems.indexOf(item) ? 'bg-brand-red/5 border-2 border-brand-red/30' : 'bg-surface border border-border-default hover:border-brand-red/20'}`}>
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
                                                
                                                <div className="flex flex-col lg:flex-row gap-4">
                                                    <div className="flex-[4] relative" ref={el => { dropdownRefs.current[index] = el; }}>
                                                        <label className="block text-[10px] font-black text-text-secondary mb-1.5 uppercase tracking-widest">Product</label>
                                                        <div className="relative">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"><Search size={14} /></div>
                                                            <input
                                                                ref={el => { searchInputRefs.current[index] = el; }}
                                                                type="text"
                                                                placeholder="Search Product..."
                                                                className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-10 py-2 text-[13px] font-bold text-text-primary focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none h-[40px] uppercase"
                                                                value={item.searchQuery}
                                                                onChange={(e) => handleItemChange(index, 'searchQuery', e.target.value)}
                                                                onFocus={(e) => {
                                                                    e.target.select();
                                                                    handleItemChange(index, 'isSearchOpen', true);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    const filtered = products.filter(p => isSmartMatch(p.name, item.searchQuery || '')).slice(0, 20);
                                                                    
                                                                    if (e.key === 'Tab' && item.isSearchOpen && filtered.length > 0) {
                                                                        e.preventDefault();
                                                                        if (e.shiftKey) {
                                                                            // Shift+Tab = move highlight UP
                                                                            const nextIdx = ((item.highlightedIndex || 0) - 1 + filtered.length) % filtered.length;
                                                                            handleItemChange(index, 'highlightedIndex', nextIdx);
                                                                        } else {
                                                                            // Tab = move highlight DOWN
                                                                            const nextIdx = ((item.highlightedIndex || 0) + 1) % filtered.length;
                                                                            handleItemChange(index, 'highlightedIndex', nextIdx);
                                                                        }
                                                                    } else if (e.key === 'Enter' && item.isSearchOpen && filtered.length > 0) {
                                                                        // Enter = select the highlighted product
                                                                        e.preventDefault();
                                                                        const selectedIdx = item.highlightedIndex !== undefined ? item.highlightedIndex : 0;
                                                                        if (filtered[selectedIdx]) {
                                                                            selectProduct(index, filtered[selectedIdx]);
                                                                        }
                                                                    } else if (e.key === 'Enter') {
                                                                        // Enter with no dropdown = advance to Unit Cost
                                                                        e.preventDefault();
                                                                        unitCostInputRefs.current[index]?.focus();
                                                                    } else if (e.key === 'Escape') {
                                                                        handleItemChange(index, 'isSearchOpen', false);
                                                                    }
                                                                }}
                                                            />
                                                            {item.product_id && (
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white"><ShieldCheck size={12} /></div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {item.isSearchOpen && (
                                                            <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-surface border border-border-default rounded-xl shadow-2xl max-h-[350px] overflow-hidden flex flex-col min-w-[400px] animate-fade-in">
                                                                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                                                                    {(() => {
                                                                        const filtered = products.filter(p => isSmartMatch(p.name, item.searchQuery || '')).slice(0, 20);
                                                                        if (filtered.length === 0) {
                                                                            return (
                                                                                <div className="p-8 text-center bg-subtle">
                                                                                    <p className="text-[10px] font-bold text-text-muted uppercase">No products found</p>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return filtered.map((p, pIdx) => {
                                                                            const parts = p.name.includes(' > ') ? p.name.split(' > ') : [p.name];
                                                                            const name = parts[parts.length - 1];
                                                                            const path = parts.slice(0, -1).join(' > ') + (parts.length > 1 ? ' >' : '');
                                                                            
                                                                            return (
                                                                                <button
                                                                                    key={p.id}
                                                                                    type="button"
                                                                                    ref={(el) => {
                                                                                        if (item.highlightedIndex === pIdx && el) {
                                                                                            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                                                                                        }
                                                                                    }}
                                                                                    onClick={() => selectProduct(index, p)}
                                                                                    className={`w-full text-left px-4 py-3 border-b border-border-default transition-all flex items-start justify-between group h-auto ${item.highlightedIndex === pIdx ? 'bg-brand-red/10 ring-2 ring-inset ring-black' : 'hover:bg-brand-red/5'}`}
                                                                                >
                                                                                    <div className="flex-1 min-w-0 pr-4">
                                                                                        {path && <div className="text-[11px] font-black uppercase text-text-primary mb-0.5 leading-tight opacity-50 tracking-tight">{path}</div>}
                                                                                        <div className="text-[14px] font-black uppercase text-text-primary leading-tight break-words group-hover:text-brand-red transition-colors">
                                                                                            {name}
                                                                                        </div>
                                                                                        <div className="text-[10px] font-bold text-text-muted font-mono uppercase tracking-widest mt-1">STK: <span className="text-[11px] font-black text-teal-600">{p.stock_available} {p.unit || 'pcs'}</span></div>
                                                                                    </div>
                                                                                    <div className="shrink-0 pt-0.5">
                                                                                        <div className="text-[18px] font-data font-black text-brand-red leading-none">₱{p.buying_price?.toLocaleString()}</div>
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-3 flex-[4.5] gap-3">
                                                        <div>
                                                            <label className="block text-[10px] font-black text-text-secondary mb-1.5 uppercase tracking-widest">Unit Cost</label>
                                                            <div className="relative">
                                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">₱</span>
                                                                <input
                                                                    ref={el => { unitCostInputRefs.current[index] = el; }}
                                                                    type="number"
                                                                    className="w-full bg-surface border border-border-default rounded-lg pl-5 pr-2 py-2 text-[13px] font-data font-black focus:border-brand-red outline-none text-text-primary h-[40px]"
                                                                    value={item.unit_price}
                                                                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                                    onFocus={(e) => e.target.select()}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            quantityInputRefs.current[index]?.focus();
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-black text-text-secondary mb-1.5 uppercase tracking-widest">Qty</label>
                                                            <input
                                                                ref={el => { quantityInputRefs.current[index] = el; }}
                                                                type="number"
                                                                className="w-full bg-surface border border-border-default rounded-lg px-2 py-2 text-[13px] font-data font-black focus:border-brand-red outline-none text-text-primary h-[40px]"
                                                                value={item.quantity}
                                                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                                onFocus={(e) => e.target.select()}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        if (index === items.length - 1) {
                                                                            handleAddItem();
                                                                            // Focus will be handled by the effect of items length changing
                                                                        } else {
                                                                            searchInputRefs.current[index + 1]?.focus();
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="text-right">
                                                            <label className="block text-[10px] font-black text-text-secondary mb-1.5 uppercase tracking-widest">Total</label>
                                                            <div className="py-2.5 font-black text-[15px] text-text-primary font-data lining-nums">₱{item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-end pb-1.5">
                                                        <button type="button" onClick={() => handleRemoveItem(index)} disabled={items.length === 1} className="p-2 text-text-muted hover:text-brand-red hover:bg-brand-red/5 rounded-lg transition-all disabled:opacity-0"><Trash2 size={18} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Sidebar (Right, 4/12) */}
                            <div className="md:col-span-4 flex flex-col gap-2.5 h-full">
                                {/* Supplier Card */}
                                <div 
                                    className="bg-subtle/50 p-2.5 rounded-xl border border-border-default shadow-sm group"
                                    onMouseEnter={() => purchaseType === 'supplier' && setIsSupplierSearchOpen(true)}
                                    onMouseLeave={() => setIsSupplierSearchOpen(false)}
                                >
                                    <div className="flex items-center gap-2 mb-2 px-1">
                                        <div className="p-1.5 bg-brand-red/10 rounded-lg text-brand-red group-hover:bg-brand-red group-hover:text-white transition-all"><Truck size={14} /></div>
                                        <h3 className="text-[10px] font-black uppercase text-text-primary tracking-widest">Source Entity</h3>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex p-1 bg-surface border border-border-default rounded-lg overflow-hidden h-[34px]">
                                            <button type="button" onClick={() => setPurchaseType('supplier')} className={`flex-1 text-[9px] font-black rounded-md transition-all ${purchaseType === 'supplier' ? 'bg-brand-red text-white' : 'text-text-muted hover:bg-subtle'}`}>SUPPLIER</button>
                                            <button type="button" onClick={() => setPurchaseType('transfer')} className={`flex-1 text-[9px] font-black rounded-md transition-all ${purchaseType === 'transfer' ? 'bg-brand-red text-white' : 'text-text-muted hover:bg-subtle'}`}>TRANSFER</button>
                                        </div>
                                        <div className="relative">
                                            {purchaseType === 'supplier' ? (
                                                <div className="relative">
                                                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"><Search size={12} /></div>
                                                    <input
                                                        ref={supplierSearchInputRef}
                                                        type="text"
                                                        placeholder="SEARCH SUPPLIER..."
                                                        className="w-full bg-surface border border-border-default rounded-lg pl-8 pr-3 py-2 text-[11px] font-black text-text-primary outline-none focus:border-brand-red h-[36px] uppercase"
                                                        value={supplierSearchQuery}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setSupplierSearchQuery(val);
                                                            setSupplier(val);
                                                            setIsSupplierSearchOpen(true);
                                                            // Logic to clear ID only if not an exact match to allow auto-creation
                                                            const match = suppliers.find(s => s.name.toLowerCase() === val.toLowerCase());
                                                            if (match) {
                                                                setSupplierId(match.id);
                                                            } else {
                                                                setSupplierId(null);
                                                            }
                                                        }}
                                                        onFocus={() => setIsSupplierSearchOpen(true)}
                                                        onKeyDown={(e) => {
                                                            const filtered = suppliers.filter(s => isSmartMatch(s.name, supplierSearchQuery));
                                                            
                                                            if (e.key === 'ArrowDown' && isSupplierSearchOpen) {
                                                                e.preventDefault();
                                                                // If I add highlightedIndex to modal state, I can navigate here too.
                                                            } else if ((e.key === 'Enter' || e.key === 'Tab') && isSupplierSearchOpen && filtered.length > 0) {
                                                                e.preventDefault();
                                                                selectSupplier(filtered[0]);
                                                                searchInputRefs.current[0]?.focus();
                                                            } else if (e.key === 'Enter' || e.key === 'Tab') {
                                                                e.preventDefault();
                                                                searchInputRefs.current[0]?.focus();
                                                            }
                                                        }}
                                                    />
                                                    {isSupplierSearchOpen && (
                                                        <div ref={supplierDropdownRef} className="absolute z-[110] left-0 right-0 top-full mt-1 bg-surface border border-border-default rounded-xl shadow-2xl max-h-[250px] overflow-y-auto animate-fade-in">
                                                            {suppliers.filter(s => isSmartMatch(s.name, supplierSearchQuery)).map(s => (
                                                                <button key={s.id} type="button" onClick={() => selectSupplier(s)} className="w-full text-left px-3 py-2 hover:bg-subtle border-b border-border-muted last:border-0 flex flex-col">
                                                                    <span className="text-[10px] font-black text-text-primary uppercase">{s.name}</span>
                                                                    <span className="text-[8px] text-text-secondary uppercase tracking-tighter">VAT: {s.supplier_vat_registered ? 'YES' : 'NO'}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div 
                                                    className="relative"
                                                    onMouseEnter={() => setIsTransferDropdownOpen(true)}
                                                    onMouseLeave={() => setIsTransferDropdownOpen(false)}
                                                >
                                                    <button 
                                                        type="button"
                                                        className="w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-[11px] font-black text-text-primary outline-none focus:border-brand-red h-[36px] uppercase flex items-center justify-between"
                                                    >
                                                        <span>{branches.find(b => b.id === sourceBranchId)?.name.toUpperCase() || 'SELECT SOURCE'}</span>
                                                        <ChevronDown size={14} className={`transition-transform ${isTransferDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    {isTransferDropdownOpen && (
                                                        <div 
                                                            ref={transferDropdownRef}
                                                            className="absolute z-[110] left-0 right-0 top-full mt-1 bg-surface border border-border-default rounded-xl shadow-2xl overflow-hidden animate-fade-in"
                                                        >
                                                            {branches.filter(b => b.id !== Number(activeBranchId)).map(b => (
                                                                <button
                                                                    key={b.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSourceBranchId(b.id);
                                                                        setSupplier(b.name);
                                                                        setIsTransferDropdownOpen(false);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2.5 hover:bg-subtle text-[11px] font-black uppercase border-b border-border-default last:border-0 transition-colors"
                                                                >
                                                                    {b.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status Card */}
                                <div className="bg-subtle/50 p-2.5 rounded-xl border border-border-default shadow-sm group">
                                    <div className="flex items-center gap-2 mb-2 px-1">
                                        <div className="p-1.5 bg-brand-red/10 rounded-lg text-brand-red group-hover:bg-brand-red group-hover:text-white transition-all"><ShieldCheck size={14} /></div>
                                        <h3 className="text-[10px] font-black uppercase text-text-primary tracking-widest">Transaction Status</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button type="button" onClick={() => setStatus('pending')} className={`py-2 rounded-lg border text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${status === 'pending' ? 'bg-orange-500 text-white border-orange-600 shadow-sm' : 'bg-surface text-text-muted border-border-default hover:bg-subtle'}`}><Clock size={12} /> PENDING</button>
                                        <button type="button" onClick={() => setStatus('received')} className={`py-2 rounded-lg border text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${status === 'received' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-surface text-text-muted border-border-default hover:bg-subtle'}`}><ShieldCheck size={12} /> RECEIVED</button>
                                    </div>
                                </div>

                                {/* Payment Card */}
                                <div className="bg-subtle/50 p-2.5 rounded-xl border border-border-default shadow-sm group">
                                    <div className="flex items-center gap-2 mb-2 px-1">
                                        <div className="p-1.5 bg-brand-red/10 rounded-lg text-brand-red group-hover:bg-brand-red group-hover:text-white transition-all"><Tag size={14} /></div>
                                        <h3 className="text-[10px] font-black uppercase text-text-primary tracking-widest">Settlement & Label</h3>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface border border-border-default rounded-lg">
                                            <button type="button" onClick={() => setPaymentStatus('unpaid')} className={`py-1.5 rounded-md text-[9px] font-black transition-all ${paymentStatus === 'unpaid' ? 'bg-red-500 text-white' : 'text-text-muted hover:bg-subtle'}`}>UNPAID</button>
                                            <button type="button" onClick={() => setPaymentStatus('partial')} className={`py-1.5 rounded-md text-[9px] font-black transition-all ${paymentStatus === 'partial' ? 'bg-amber-500 text-white' : 'text-text-muted hover:bg-subtle'}`}>PARTIAL</button>
                                            <button type="button" onClick={() => setPaymentStatus('paid')} className={`py-1.5 rounded-md text-[9px] font-black transition-all ${paymentStatus === 'paid' ? 'bg-indigo-600 text-white' : 'text-text-muted hover:bg-subtle'}`}>FULFILLED</button>
                                        </div>
                                        <div 
                                            className="relative"
                                            onMouseEnter={() => setIsLabelDropdownOpen(true)}
                                            onMouseLeave={() => setIsLabelDropdownOpen(false)}
                                        >
                                            <button 
                                                type="button"
                                                className="w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-[11px] font-black text-text-primary outline-none focus:border-brand-red h-[36px] uppercase flex items-center justify-between"
                                            >
                                                <span>{PURCHASE_LABELS.find(l => l.id === transactionLabel)?.label.toUpperCase() || 'NO LABEL'}</span>
                                                <ChevronDown size={14} className={`transition-transform ${isLabelDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isLabelDropdownOpen && (
                                                <div 
                                                    ref={labelDropdownRef}
                                                    className="absolute z-[110] left-0 right-0 bottom-full mb-1 bg-surface border border-border-default rounded-xl shadow-2xl overflow-hidden animate-fade-in-up"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setTransactionLabel('');
                                                            setIsLabelDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-subtle text-[11px] font-black uppercase border-b border-border-default transition-colors"
                                                    >
                                                        NO LABEL
                                                    </button>
                                                    {PURCHASE_LABELS.map(label => (
                                                        <button
                                                            key={label.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTransactionLabel(label.id);
                                                                setIsLabelDropdownOpen(false);
                                                            }}
                                                            className="w-full text-left px-4 py-2.5 hover:bg-subtle text-[11px] font-black uppercase border-b border-border-default last:border-0 transition-colors"
                                                        >
                                                            {label.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {supplierVatRegistered && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-1 mt-auto">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">VAT REGISTERED SUPPLIER</p>
                                        <div className="flex items-end justify-between">
                                            <span className="text-[8px] text-emerald-600/70 font-bold">EST. INPUT VAT</span>
                                            <span className="text-sm font-black text-emerald-700 font-data">₱{inputVatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer Section (Consistent with SalesModal) */}
                <div className="h-[100px] bg-brand-charcoal border-t border-white/5 flex items-center justify-between px-8 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/5 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="flex items-center gap-12 text-white/60 relative z-10 h-full">
                        <div className="group">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1.5 group-hover:text-brand-red transition-colors">Net Total</p>
                            <p className="text-xl font-black font-data text-white lining-nums">₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        {isDiscountEnabled && (
                            <div className="group">
                                <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1.5 text-brand-orange">Discount (10%)</p>
                                <p className="text-xl font-black font-data text-brand-orange lining-nums">-₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-8 relative z-10">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-1">TOTAL PAYABLE</p>
                            <p className="text-4xl font-black text-white font-data tracking-tight lining-nums shadow-sm">₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <button 
                            form="purchase-form" 
                            type="submit" 
                            ref={saveButtonRef} 
                            disabled={loading || success} 
                            className="h-[60px] min-w-[200px] bg-brand-red hover:bg-brand-red-dark text-white rounded-2xl font-black text-base shadow-xl shadow-brand-red/20 active:scale-95 disabled:opacity-50 transition-all uppercase tracking-widest flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                    SYNCING...
                                </>
                            ) : success ? 'SAVED!' : (
                                <>
                                    <Truck size={20} />
                                    SAVE PURCHASE
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Success Receipt Overlay */}
            {success && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-3xl p-8 max-w-md w-full shadow-2xl border border-border-default animate-slide-up relative overflow-hidden text-text-primary">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-brand-red" />

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-text-primary uppercase tracking-tight">Purchase Saved</h3>
                            <p className="text-text-secondary text-sm font-bold">Check invoice details before saving</p>
                        </div>

                        <div className="border-2 border-dashed border-border-default rounded-2xl p-6 space-y-6 bg-subtle/50">
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
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest pb-1 border-b border-border-default">Itemized List</p>
                                <div className="max-h-48 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                                    {savedData.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-[11px]">
                                            <div className="flex-1">
                                                <p className="font-bold text-text-primary leading-tight">{item.products?.name}</p>
                                                <p className="text-[9px] text-text-muted font-data">x{item.quantity} @ ₱{item.unit_price.toLocaleString()}</p>
                                            </div>
                                            <p className="font-black text-text-primary font-data">₱{item.total_price.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t-2 border-dashed border-border-default space-y-2">
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
                                // Reset for next transaction
                                fetchLatestPurchaseInvoice();
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
                                // User Request: seamless keyboard only architecture
                                setTimeout(() => searchInputRefs.current[0]?.focus(), 150);
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
