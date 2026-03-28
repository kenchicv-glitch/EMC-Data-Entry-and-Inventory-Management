import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { X, ShoppingCart, AlertCircle, Plus, Trash2, Percent, User, Truck, ChevronDown, Search, Tag, CreditCard, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { customerService } from '../../customers/services/customerService';
import { useAudit } from '../../../shared/hooks/useAudit';
import { useKeyboardNav } from '../../../shared/hooks/useKeyboardNav';
import { computeOutputVat, type VatClassification } from '../../../shared/lib/vatUtils';
import type { Customer } from '../../customers/types/customer';
import { useBranch } from '../../../shared/hooks/useBranch';
import { toast } from 'sonner';
import { isSmartMatch } from '../../../shared/lib/searchUtils';
import { sanitizeString } from '../../../shared/lib/sanitize';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/lib/queryKeys';


interface Product {
    id: string;
    name: string;
    stock_available: number;
    selling_price: number;
    brand?: string;
    description?: string;
    buying_price?: number;
    unit?: string;
}

export interface OrderItem {
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    name?: string;
    stock_available?: number;
    brand?: string;
    unit?: string;
    searchQuery?: string;
    isSearchOpen?: boolean;
    highlightedIndex?: number;
    currentLevel?: 'master' | 'category' | 'subcategory' | 'product';
    selectedPath?: {
        master?: string;
        category?: string;
        subcategory?: string;
    };
}

export interface SalesModalProps {
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
        isOs?: boolean;
        date?: string;
        deliveryFee?: number;
        customerId?: string | null;
        vatClassification?: VatClassification;
        orNumber?: string;
        invoiceType?: 'A' | 'B';
        transactionLabel?: string;
    };
}

const PAYMENT_MODES = [
    { id: 'cash', label: 'Cash' },
    { id: 'gcash', label: 'GCash' },
    { id: 'cheque', label: 'Cheque' },
    { id: 'bank_transfer', label: 'Bank Transfer' },
    { id: 'others', label: 'Others' }
];

const AR_LABELS = [
    { id: 'AR', label: 'AR (General Credit)' },
    { id: 'AR Cash', label: 'AR Cash (Collection)' },
    { id: 'AR1', label: 'AR1 (Sister Co Debt)' },
    { id: 'AR2', label: 'AR2 (Customer Debt)' }
];

export default function SalesModal({ isOpen, onClose, onSuccess, editData }: SalesModalProps) {
    const { activeBranchId } = useBranch();
    const queryClient = useQueryClient();
    const { logAction } = useAudit();
    const [products, setProducts] = useState<Product[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('000000');
    const [customerName, setCustomerName] = useState('');
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
    const [fulfillmentStatus, setFulfillmentStatus] = useState<'pickup' | 'delivered' | 'out'>('pickup');
    const [paymentMode, setPaymentMode] = useState('cash');
    const [isOs, setIsOs] = useState(false);
    const [invoiceType, setInvoiceType] = useState<'A' | 'B'>('A');
    const [rawInvoiceNum, setRawInvoiceNum] = useState(''); // Holds the numeric part during editing
    const [originalDate, setOriginalDate] = useState<string | null>(null);
    const [items, setItems] = useState<OrderItem[]>([
        {
            product_id: '',
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            searchQuery: '',
            isSearchOpen: false,
            highlightedIndex: 0,
            currentLevel: 'master',
            selectedPath: {}
        }
    ]);
    const [vatClassification, setVatClassification] = useState<VatClassification>('vatable');
    const [orNumber, setOrNumber] = useState('');
    const [transactionLabel, setTransactionLabel] = useState<string>('');
    const [isDiscountEnabled, setIsDiscountEnabled] = useState(false);
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [showDeliveryPrompt, setShowDeliveryPrompt] = useState(false);
    const [promptStep, setPromptStep] = useState<'confirm' | 'input'>('confirm');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    // Disruptive close logic and draft state removed


    const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
    const searchInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const quantityInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const saveButtonRef = useRef<HTMLButtonElement>(null);

    // Keyboard navigation for line items
    const completedItems = items.filter(it => it.product_id);
    const {
        focusedIndex,
        handleListKeyDown,
        resetNav,
    } = useKeyboardNav({
        itemCount: completedItems.length,
        searchInputRef: { current: searchInputRefs.current[items.length - 1] || searchInputRefs.current[0] } as React.RefObject<HTMLInputElement | null>,
        saveButtonRef,
        onEditQuantity: (idx) => {
            // Find the actual item index for completed items
            const actualIdx = items.findIndex((it, i) => {
                let completedCount = 0;
                for (let j = 0; j <= i; j++) {
                    if (items[j].product_id) completedCount++;
                }
                return it.product_id && completedCount - 1 === idx;
            });
            if (actualIdx >= 0 && quantityInputRefs.current[actualIdx]) {
                quantityInputRefs.current[actualIdx]?.focus();
                quantityInputRefs.current[actualIdx]?.select();
            }
        },
        onReplaceItem: (idx) => {
            const actualIdx = items.findIndex((it, i) => {
                let completedCount = 0;
                for (let j = 0; j <= i; j++) {
                    if (items[j].product_id) completedCount++;
                }
                return it.product_id && completedCount - 1 === idx;
            });
            if (actualIdx >= 0) {
                handleItemChange(actualIdx, 'searchQuery', '');
                handleItemChange(actualIdx, 'product_id', '');
                handleItemChange(actualIdx, 'isSearchOpen', true);
                setTimeout(() => searchInputRefs.current[actualIdx]?.focus(), 50);
            }
        },
        onRemoveItem: (idx) => {
            const actualIdx = items.findIndex((it, i) => {
                let completedCount = 0;
                for (let j = 0; j <= i; j++) {
                    if (items[j].product_id) completedCount++;
                }
                return it.product_id && completedCount - 1 === idx;
            });
            if (actualIdx >= 0) handleRemoveItem(actualIdx);
        },
        onEmptySearchEnter: () => {
            saveButtonRef.current?.focus();
        },
    });

    const fetchProducts = useCallback(async () => {
        const query = supabase
            .from('products')
            .select('id, name, stock_available, selling_price, brand, description, buying_price, unit')
            .order('name');
        
        if (activeBranchId) {
            query.eq('branch_id', activeBranchId);
        }

        const { data, error } = await query;

        if (error) console.error('Error fetching products:', error);
        else setProducts(data || []);
    }, [activeBranchId]);

    const fetchCustomers = useCallback(async () => {
        try {
            const data = await customerService.getAll(activeBranchId);
            setCustomers(data);
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
    }, [activeBranchId]);

    const fetchLatestInvoice = useCallback(async (osMode: boolean) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            let query = supabase.from('sales').select('invoice_number');

            if (osMode) {
                query = query.eq('is_os', true).gte('date', today);
            } else {
                query = query.eq('is_os', false);
            }

            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            if (!osMode) {
                // Only filter by type for standard invoices
                query = query.eq('invoice_type', invoiceType);
            } else {
                // OS invoices ALWAYS reset to 000001 daily
                query = query.eq('is_os', true).gte('date', today);
            }

            const { data, error } = await query
                .order('invoice_number', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const lastInvoice = data[0].invoice_number;
                const numericPart = lastInvoice.replace(/\D/g, '');
                const nextNum = (parseInt(numericPart) || 0) + 1;
                const paddedNum = nextNum.toString().padStart(6, '0');
                const newInvoice = osMode ? `OS-${paddedNum}` : paddedNum;
                setInvoiceNumber(newInvoice);
                setRawInvoiceNum(paddedNum);
                setOrNumber(newInvoice);
            } else {
                const defaultNum = '000001';
                const newInvoice = osMode ? `OS-${defaultNum}` : defaultNum;
                setInvoiceNumber(newInvoice);
                setRawInvoiceNum(defaultNum);
                setOrNumber(newInvoice);
            }
        } catch (err) {
            console.error('Error fetching latest invoice:', err);
            const defaultNum = '000001';
            const newInvoice = osMode ? `OS-${defaultNum}` : defaultNum;
            setInvoiceNumber(newInvoice);
            setRawInvoiceNum(defaultNum);
            setOrNumber(newInvoice);
        }
    }, [activeBranchId, invoiceType]);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            fetchCustomers();
            if (editData) {
                setInvoiceNumber(editData.invoiceNumber);
                setCustomerName(editData.customerName || '');
                setFulfillmentStatus((editData.fulfillmentStatus as 'pickup' | 'delivered' | 'out') || 'pickup');
                setPaymentMode(editData.paymentMode || 'cash');
                setItems(editData.items.map(item => ({ ...item, searchQuery: item.name || '', isSearchOpen: false })));
                setIsDiscountEnabled(editData.isDiscountEnabled);
                setVatClassification(editData.vatClassification || (editData.isVatEnabled ? 'vatable' : 'exempt'));
                setOrNumber(editData.orNumber || '');
                setIsOs(editData.isOs || false);
                setInvoiceType((editData.invoiceType as 'A' | 'B') || 'A');
                setOriginalDate(editData.date || null);
                setDeliveryFee(0); // Reset fee so it's re-added via prompt
                setCustomerId(editData.customerId || null);
                setCustomerSearchQuery(editData.customerName || '');
                setTransactionLabel(editData.transactionLabel || '');
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
                    highlightedIndex: 0,
                    currentLevel: 'master',
                    selectedPath: {}
                }]);
                setVatClassification('vatable');
                setOrNumber('');
                setIsDiscountEnabled(false);
                setCustomerId(null);
                setCustomerSearchQuery('');
                setDeliveryFee(0);
                setTransactionLabel('');
            }
            setError(null);
            setSuccess(false);
            setShowDeliveryPrompt(false);
            setPromptStep('confirm');
            document.body.classList.add('modal-open');

            // Auto-focus first search input
            setTimeout(() => {
                if (searchInputRefs.current[0]) {
                    searchInputRefs.current[0].focus();
                }
            }, 100);
        } else {
            document.body.classList.remove('modal-open');
            resetNav();
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen, editData, fetchProducts, fetchCustomers, resetNav]);

    // Listen for global Escape to close modal
    useEffect(() => {
        if (!isOpen) return;
        const handleCloseModal = () => {
            // Only close if no dropdown is open
            const anyDropdownOpen = items.some(it => it.isSearchOpen) || isCustomerSearchOpen;
            if (!anyDropdownOpen) {
                onClose();
            }
        };
        window.addEventListener('close-modal', handleCloseModal);
        
        // Removed beforeunload listener as it disrupts workflow

        return () => {
            window.removeEventListener('close-modal', handleCloseModal);
        };
    }, [isOpen, items, isCustomerSearchOpen, onClose]);

    // Draft persistence and restoration logic removed for workflow efficiency


    useEffect(() => {
        if (isOpen && !editData) {
            fetchLatestInvoice(isOs);
        }
    }, [isOs, invoiceType, isOpen, editData, fetchLatestInvoice]);

    // Keep OR Number in sync with Invoice Number
    useEffect(() => {
        setOrNumber(invoiceNumber);
    }, [invoiceNumber]);


    const stepInvoice = (dir: number) => {
        const current = parseInt(rawInvoiceNum) || 0;
        const next = Math.max(0, current + dir);
        const paddedNum = next.toString().padStart(6, '0');
        setRawInvoiceNum(paddedNum);
        const newInvoice = isOs ? `OS-${paddedNum}` : paddedNum;
        setInvoiceNumber(newInvoice);
        setOrNumber(newInvoice);
    };

    // --- Calculations Moved Up ---
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const { vatAmount } = computeOutputVat(subtotal, vatClassification);
    const finalVatAmount = isOs ? 0 : vatAmount;
    const finalDiscountAmount = isDiscountEnabled ? (subtotal > 1300 ? 65 : subtotal * 0.05) : 0;
    const currentVatClassification = vatClassification;
    const grandTotal = subtotal - finalDiscountAmount;

    // --- Logic Handlers ---
    const handleSubmit = useCallback(async () => {
        if (loading || success) return;
        setLoading(true);
        setError(null);

        try {
            if (!invoiceNumber.trim()) throw new Error('Please enter an invoice number');
            const sanitizedOrNumber = sanitizeString(orNumber);
            if (sanitizedOrNumber) {
                const { data: duplicateOr } = await supabase
                    .from('sales')
                    .select('or_number')
                    .eq('or_number', sanitizedOrNumber)
                    .maybeSingle();

                if (duplicateOr && (!editData || editData.orNumber !== sanitizedOrNumber)) {
                    throw new Error(`Duplicate OR Number detected: ${sanitizedOrNumber}. Please check or enter a new one.`);
                }
            }
            if (items.some(item => !item.product_id)) throw new Error('Please select a product for all rows');
            if (items.some(item => item.quantity <= 0)) throw new Error('Quantity must be greater than 0');

            const { data: { user } } = await supabase.auth.getUser();

            // Handle New Customer Creation
            const currentCustomerName = sanitizeString(customerName);
            let currentCustomerId = customerId;


            if (currentCustomerName && !currentCustomerId) {
                // Double check if it exists but wasn't selected (case-insensitive)
                const existingCustomer = customers.find(c => c.name.toLowerCase() === currentCustomerName.toLowerCase());
                if (existingCustomer) {
                    currentCustomerId = existingCustomer.id;
                } else {
                    // Create new customer
                    const { data: newCustomer, error: customerError } = await supabase
                        .from('customers')
                        .insert({
                            name: currentCustomerName,
                            branch_id: activeBranchId
                        })
                        .select()
                        .single();

                    if (customerError) throw customerError;
                    currentCustomerId = newCustomer.id;
                    setCustomerId(currentCustomerId);
                    // Refresh customers list background
                    fetchCustomers();
                    // Invalidate global customer query cache
                    queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
                }
            }

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
                    customer_name: currentCustomerName,
                    customer_id: currentCustomerId,
                    fulfillment_status: 'pickup', // Default to pickup as selection is removed
                    payment_mode: paymentMode,
                    user_id: user?.id,
                    vat_amount: finalVatAmount * itemRatio,
                    discount_amount: finalDiscountAmount * itemRatio,
                    is_discounted: isDiscountEnabled,
                    cost_price: product?.buying_price || 0,
                    is_os: isOs,
                    delivery_fee: deliveryFee,
                    vat_classification: currentVatClassification,
                    or_number: sanitizedOrNumber,
                    invoice_type: isOs ? null : invoiceType,
                    net_amount: (item.total_price - (finalVatAmount * itemRatio)),
                    branch_id: activeBranchId,
                    transaction_label: sanitizeString(transactionLabel),
                    ...(originalDate ? { date: originalDate, edited_at: new Date().toISOString() } : {})
                };

            });

            const { data: insertedData, error: insertError } = await supabase.from('sales').insert(salesToInsert).select('*, products(name, brand)');
            if (insertError) throw insertError;

            // Audit Log
            if (insertedData && insertedData.length > 0) {
                await logAction({
                    action: editData ? 'UPDATE_SALE' : 'CREATE_SALE',
                    table_name: 'sales',
                    record_id: invoiceNumber,
                    old_data: editData,
                    new_data: salesToInsert
                });
            }

            setSuccess(true);
            
            toast.success('Sale saved', { duration: 2000 });
            setTimeout(() => {
                onSuccess(insertedData as unknown as unknown[]);

                // Auto-reset for next sale instead of closing
                setSuccess(false);
                setError(null);
                setCustomerName('');
                setCustomerId(null);
                setCustomerSearchQuery('');
                setItems([{
                    product_id: '',
                    quantity: 1,
                    unit_price: 0,
                    total_price: 0,
                    searchQuery: '',
                    isSearchOpen: false,
                    highlightedIndex: 0,
                    currentLevel: 'master',
                    selectedPath: {}
                }]);
                setDeliveryFee(0);
                setShowDeliveryPrompt(false);
                setPromptStep('confirm');
                resetNav();
                // Re-fetch next invoice number
                fetchLatestInvoice(isOs);
                // Re-focus search input
                setTimeout(() => {
                    searchInputRefs.current[0]?.focus();
                }, 100);
            }, 800);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error processing transaction');
        } finally {
            setLoading(false);
        }
    }, [loading, success, invoiceNumber, orNumber, items, editData, subtotal, finalVatAmount, finalDiscountAmount, customerName, customerId, fulfillmentStatus, paymentMode, isDiscountEnabled, isOs, deliveryFee, currentVatClassification, invoiceType, activeBranchId, originalDate, products, logAction, onSuccess, resetNav, fetchLatestInvoice, transactionLabel]);

    const validateAndSubmit = useCallback((e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (grandTotal > 100 && grandTotal < 5001 && deliveryFee === 0 && !showDeliveryPrompt) {
            setPromptStep('input');
            setShowDeliveryPrompt(true);
        } else {
            handleSubmit();
        }
    }, [grandTotal, deliveryFee, showDeliveryPrompt, handleSubmit]);

    const handleAddItem = useCallback(() => {
        setItems(prev => [...prev, {
            product_id: '',
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            searchQuery: '',
            isSearchOpen: false,
            highlightedIndex: 0,
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

    const handleItemChange = useCallback(<K extends keyof OrderItem>(index: number, field: K, value: OrderItem[K]) => {
        setItems(prev => {
            const next = [...prev];
            const item = { ...next[index], [field]: value };

            if (field === 'quantity' || field === 'unit_price' || field === 'searchQuery') {
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
                    item.highlightedIndex = 0;
                }
            }

            if (field === 'isSearchOpen' && value === true) {
                item.highlightedIndex = 0;
            }

            next[index] = item;
            return next;
        });
    }, []);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Modal level shortcuts
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                validateAndSubmit();
            }

            if (e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 'a':
                        e.preventDefault();
                        handleAddItem();
                        break;
                    case 'd':
                        e.preventDefault();
                        setIsDiscountEnabled(prev => !prev);
                        break;
                    case 'v':
                        e.preventDefault();
                        setVatClassification(prev => {
                            if (prev === 'vatable') return 'exempt';
                            if (prev === 'exempt') return 'zero_rated';
                            return 'vatable';
                        });
                        break;
                    case 'm':
                        e.preventDefault();
                        setPaymentMode(prev => {
                            const currentIndex = PAYMENT_MODES.findIndex(m => m.id === prev);
                            const nextIndex = (currentIndex + 1) % PAYMENT_MODES.length;
                            return PAYMENT_MODES[nextIndex].id;
                        });
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
        };

        if (isOpen) {
            document.addEventListener('keydown', handleGlobalKeyDown);
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, items.length, validateAndSubmit, handleAddItem, handleRemoveItem]);

    const selectProduct = (index: number, product: Product) => {
        // Zero-stock blocking
        if (product.stock_available <= 0) {
            toast.error('Insufficient stock — item cannot be added', { duration: 2000 });
            return;
        }

        const existingIndex = items.findIndex((item, i) => i !== index && item.product_id === product.id);

        if (existingIndex !== -1) {
            // Merge duplicate
            const newItems = [...items];
            const existingItem = newItems[existingIndex];
            existingItem.quantity += items[index].quantity;
            existingItem.total_price = existingItem.quantity * existingItem.unit_price;

            // Remove current empty/partial row if it was just being used for selection
            if (items.length > 1) {
                newItems.splice(index, 1);
            } else {
                // If it's the only row, just reset it (though this case is rare for duplicates)
                newItems[index] = {
                    product_id: '',
                    quantity: 1,
                    unit_price: 0,
                    total_price: 0,
                    searchQuery: '',
                    isSearchOpen: false,
                    highlightedIndex: 0,
                    currentLevel: 'master',
                    selectedPath: {}
                };
            }

            setItems(newItems);

            // Focus the existing item's quantity
            const focusIndex = existingIndex < index ? existingIndex : existingIndex - 1;
            setTimeout(() => {
                if (quantityInputRefs.current[focusIndex]) {
                    quantityInputRefs.current[focusIndex]?.focus();
                    quantityInputRefs.current[focusIndex]?.select();
                }
            }, 50);
            return;
        }

        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            product_id: product.id,
            name: product.name,
            stock_available: product.stock_available,
            unit_price: product.selling_price || 0,
            total_price: newItems[index].quantity * (product.selling_price || 0),
            brand: product.brand,
            unit: product.unit || 'pc',
            searchQuery: product.name,
            isSearchOpen: false,
            highlightedIndex: 0
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

    // Auto-switch to OS for orders <= 100 PHP (New Sales only)
    useEffect(() => {
        if (isOpen && !editData && grandTotal > 0) {
            const shouldBeOs = grandTotal <= 100;
            if (isOs !== shouldBeOs) {
                setIsOs(shouldBeOs);
            }
        }
    }, [grandTotal, isOpen, editData, isOs, setIsOs]);


    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4 text-left">
            <div className="w-full max-w-5xl rounded-2xl bg-surface shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
                <div className="flex items-center justify-between px-8 py-5 bg-brand-charcoal">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center text-white shadow-lg"><ShoppingCart size={22} /></div>
                        <h2 className="text-xl font-black text-white uppercase tracking-widest">{editData ? 'Edit Sale' : 'New Sale'}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={22} /></button>
                </div>


                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide bg-surface">
                    {error && <div className="mb-4 p-3 bg-danger-subtle border border-danger text-danger text-sm rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                    <form id="order-form" onSubmit={validateAndSubmit} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 h-[700px]">
                            {/* Column 1: Items List (Left, 8/12) */}
                            <div className="md:col-span-8 flex flex-col h-full bg-subtle p-1.5 rounded-xl border border-border-default shadow-sm overflow-hidden gap-1.5">
                                {/* Compact Header */}
                                <div className="flex items-center justify-between gap-1.5 px-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <div className="px-1.5 py-0.5 bg-brand-red text-white text-[12px] font-black rounded uppercase tracking-tighter shadow-sm flex items-center justify-center h-[28px] min-w-[70px]">RECEIPT</div>
                                        <div className="px-1.5 py-0.5 bg-surface border border-border-default text-[13px] font-data font-black text-text-primary rounded h-[28px] flex items-center justify-center min-w-[120px]">#{invoiceNumber}</div>
                                        {/* Arrows */}
                                        <div className="flex bg-surface border border-border-default rounded h-[28px] overflow-hidden">
                                            <button type="button" onClick={() => stepInvoice(-1)} className="px-1 hover:bg-subtle text-text-muted transition-colors border-r border-border-default"><ChevronDown size={15} className="rotate-90" /></button>
                                            <button type="button" onClick={() => stepInvoice(1)} className="px-1 hover:bg-subtle text-text-muted transition-colors"><ChevronDown size={15} className="-rotate-90" /></button>
                                        </div>
                                        {/* Toggles */}
                                        <div className="flex bg-surface border border-border-default rounded h-[28px] overflow-hidden">
                                            <button 
                                                type="button" 
                                                disabled={isOs}
                                                onClick={() => setInvoiceType('A')} 
                                                className={`px-3 text-[12px] font-black transition-all ${isOs ? 'opacity-30 cursor-not-allowed bg-subtle' : invoiceType === 'A' ? 'bg-brand-red text-white' : 'text-text-muted hover:bg-subtle border-r border-border-default'}`}
                                            >
                                                A
                                            </button>
                                            <button 
                                                type="button" 
                                                disabled={isOs}
                                                onClick={() => setInvoiceType('B')} 
                                                className={`px-3 text-[12px] font-black transition-all ${isOs ? 'opacity-30 cursor-not-allowed bg-subtle' : invoiceType === 'B' ? 'bg-brand-red text-white border-l border-border-default' : 'text-text-muted hover:bg-subtle'}`}
                                            >
                                                B
                                            </button>
                                        </div>
                                        <button type="button" onClick={() => { setIsOs(!isOs); fetchLatestInvoice(!isOs); }} className={`px-2 h-[28px] text-[12px] font-black rounded border transition-all ${isOs ? 'bg-brand-red text-white border-brand-red' : 'bg-surface text-text-muted border-border-default hover:border-border-strong'}`}>OS</button>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[12px] font-black font-data text-brand-red mr-1">
                                         <Calendar size={15} /> {format(new Date(), 'MMM dd, yyyy')}
                                    </div>
                                </div>

                                {/* Items List Area */}
                                <div className="flex flex-col flex-1 bg-surface rounded-lg border border-border-default overflow-hidden p-1">
                                    <div className="flex justify-between items-center border-b border-border-default pb-0.5 mb-1 mx-0.5">
                                        <h3 className="text-[12px] font-black uppercase text-text-muted tracking-widest pl-0.5">Order Items</h3>
                                        <button type="button" onClick={handleAddItem} className="bg-brand-red-light text-brand-red px-2 py-0.5 rounded text-[12px] font-black hover:bg-brand-red hover:text-white transition-all">
                                            <Plus size={13} className="inline mr-1" /> ADD ITEM
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1 pr-0.5" tabIndex={focusedIndex >= 0 ? 0 : -1} onKeyDown={focusedIndex >= 0 ? handleListKeyDown : undefined} style={{ outline: 'none' }}>
                                        {items.map((item, index) => (
                                            <div key={index} className={`flex flex-col gap-1 p-1.5 rounded-lg border transition-all ${item.product_id && focusedIndex === completedItems.indexOf(item) ? 'bg-accent-subtle border-accent-primary ring-1 ring-accent-subtle' : 'bg-surface border-border-default hover:border-brand-red/10'}`}>
                                                <div className="flex items-start gap-1.5">
                                                    <div className="flex-[4] relative">
                                                        <label className="block text-[9px] font-black text-text-muted mb-0.5 uppercase tracking-tighter">Product</label>
                                                        <div className="relative">
                                                            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"><Search size={13} /></div>
                                                            <input
                                                                ref={(el) => { searchInputRefs.current[index] = el; }}
                                                                type="text"
                                                                placeholder="Search..."
                                                                className="w-full bg-subtle border border-border-default rounded px-6 py-0.5 text-[13px] font-bold text-text-primary focus:ring-1 focus:ring-brand-red/10 outline-none h-[30px]"
                                                                value={item.searchQuery || ''}
                                                                onChange={(e) => handleItemChange(index, 'searchQuery', e.target.value)}
                                                                onFocus={() => handleItemChange(index, 'isSearchOpen', true)}
                                                                onKeyDown={(e) => {
                                                                    const filtered = products.filter(p => isSmartMatch(`${p.name} ${p.brand || ''}`, item.searchQuery || '')).slice(0, 15);
                                                                    if (e.key === 'ArrowDown') {
                                                                        e.preventDefault();
                                                                        const nextIdx = ((item.highlightedIndex || 0) + 1) % filtered.length;
                                                                        handleItemChange(index, 'highlightedIndex', nextIdx);
                                                                    } else if (e.key === 'ArrowUp') {
                                                                        e.preventDefault();
                                                                        const nextIdx = ((item.highlightedIndex || 0) - 1 + filtered.length) % filtered.length;
                                                                        handleItemChange(index, 'highlightedIndex', nextIdx);
                                                                    } else if (e.key === 'Enter' && item.isSearchOpen && filtered.length > 0) {
                                                                        e.preventDefault();
                                                                        selectProduct(index, filtered[item.highlightedIndex || 0]);
                                                                    } else if (e.key === 'Escape') {
                                                                        handleItemChange(index, 'isSearchOpen', false);
                                                                    }
                                                                }}
                                                            />
                                                            {item.isSearchOpen && (
                                                                <div className="absolute z-[100] left-0 right-0 top-full mt-0.5 bg-surface border border-border-default rounded shadow-2xl max-h-[300px] overflow-y-auto min-w-[450px]">
                                                                    {products.filter(p => isSmartMatch(`${p.name} ${p.brand || ''}`, item.searchQuery || '')).slice(0, 20).map((p, pIdx) => {
                                                                        const parts = p.name.includes(' > ') ? p.name.split(' > ') : [p.name];
                                                                        const name = parts[parts.length - 1];
                                                                        const path = parts.slice(0, -1).join(' > ') + (parts.length > 1 ? ' >' : '');
                                                                        
                                                                        return (
                                                                            <button 
                                                                                key={p.id} 
                                                                                type="button" 
                                                                                onClick={() => selectProduct(index, p)} 
                                                                                className={`w-full text-left px-4 py-3 border-b border-border-default transition-all flex items-start justify-between group h-auto ${item.highlightedIndex === pIdx ? 'bg-subtle ring-2 ring-inset ring-brand-red/10' : 'hover:bg-subtle'}`}
                                                                            >
                                                                                <div className="flex-1 min-w-0 pr-4">
                                                                                    {path && <div className="text-[11px] font-black uppercase text-text-primary mb-0.5 leading-tight opacity-50 tracking-tight">{path}</div>}
                                                                                    <div className="text-[14px] font-black uppercase text-text-primary leading-tight break-words">
                                                                                        {name} {p.brand && <span className="text-text-muted font-bold ml-1 text-[12px]">{p.brand}</span>}
                                                                                    </div>
                                                                                    <div className="text-[10px] font-bold text-text-muted font-mono uppercase tracking-widest mt-1">STK: <span className="text-[11px] font-black text-teal-600">{p.stock_available} {p.unit || 'pcs'}</span></div>
                                                                                </div>
                                                                                <div className="shrink-0 pt-0.5">
                                                                                    <div className="text-[18px] font-data font-black text-brand-red leading-none">₱{p.selling_price?.toLocaleString()}</div>
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="w-14">
                                                        <label className="block text-[9px] font-black text-text-muted mb-0.5 uppercase tracking-tighter">Price</label>
                                                        <div className="h-[30px] flex items-center bg-muted border border-border-default rounded px-1 text-[13px] font-data font-bold text-text-muted">₱{item.unit_price?.toLocaleString()}</div>
                                                    </div>
                                                    <div className="w-10">
                                                        <label className="block text-[9px] font-black text-text-muted mb-0.5 uppercase tracking-tighter">Qty</label>
                                                        <input 
                                                            ref={(el) => { quantityInputRefs.current[index] = el; }}
                                                            type="number" 
                                                            step={item.unit?.toLowerCase() === 'elf' ? '0.25' : '1'} 
                                                            className="w-full bg-subtle border border-border-default rounded px-1 py-0.5 text-[13px] font-data font-black text-text-primary outline-none h-[30px] text-center" 
                                                            value={item.quantity} 
                                                            onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} 
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    if (index === items.length - 1) {
                                                                        handleAddItem();
                                                                    } else {
                                                                        searchInputRefs.current[index + 1]?.focus();
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 text-right min-w-[60px]">
                                                        <label className="block text-[9px] font-black text-text-muted mb-0.5 uppercase tracking-tighter">Total</label>
                                                        <div className="h-[30px] flex items-center justify-end font-black text-[13px] text-brand-red font-data">₱{item.total_price.toLocaleString()}</div>
                                                    </div>
                                                    <button type="button" onClick={() => handleRemoveItem(index)} className="mt-4 p-1 text-text-muted hover:text-brand-red transition-colors"><Trash2 size={15} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Data Sidebar (Right, 4/12) */}
                            <div className="md:col-span-4 flex flex-col gap-2 overflow-y-auto scrollbar-hide pr-0.5 border-l border-border-default pl-2">
                                {/* Accounting */}
                                <div className="p-1.5 bg-subtle rounded-xl border border-border-default shadow-sm flex flex-col">
                                    <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5 flex items-center gap-1.5"><Tag size={13} /> Accounting</label>
                                    <select className="w-full bg-surface border border-border-default rounded px-2 py-0 text-[13px] font-black text-text-primary outline-none h-[30px] uppercase cursor-pointer" value={transactionLabel} onChange={(e) => setTransactionLabel(e.target.value)}>
                                        <option value="">NO LABEL</option>
                                        {AR_LABELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                                    </select>
                                </div>

                                {/* Customer */}
                                <div className="p-1.5 bg-subtle rounded-xl border border-border-default shadow-sm flex flex-col relative" onMouseEnter={() => setIsCustomerSearchOpen(true)} onMouseLeave={() => setIsCustomerSearchOpen(false)}>
                                    <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5 flex items-center gap-1.5"><User size={13} /> Customer</label>
                                    <div className="relative">
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"><Search size={13} /></div>
                                        <input type="text" placeholder="Search..." className="w-full bg-surface border border-border-default rounded pl-7 pr-2 py-0 text-[13px] focus:ring-1 focus:ring-brand-red/20 outline-none h-[30px] uppercase font-black text-text-primary" value={customerSearchQuery} onChange={(e) => { setCustomerSearchQuery(e.target.value); setCustomerName(e.target.value); if (!e.target.value) setCustomerId(null); }} onFocus={(e) => e.target.select()} />
                                        {isCustomerSearchOpen && (
                                            <div className="absolute z-[110] left-0 right-0 top-full mt-0.5 bg-surface border border-border-default rounded shadow-xl max-h-[100px] overflow-y-auto">
                                                {customers.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).map(c => (
                                                    <button key={c.id} type="button" onClick={() => { setCustomerId(c.id); setCustomerName(c.name); setCustomerSearchQuery(c.name); setIsCustomerSearchOpen(false); }} className="w-full text-left px-3 py-1 border-b border-border-default text-[13px] font-bold uppercase hover:bg-subtle transition-colors">{c.name}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Settlement */}
                                <div className="p-1.5 bg-subtle rounded-xl border border-border-default shadow-sm flex flex-col">
                                    <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 flex items-center gap-1.5"><CreditCard size={13} strokeWidth={2.5} /> Settlement</label>
                                    <div className="grid grid-cols-2 gap-1">
                                        {PAYMENT_MODES.map(mode => (
                                            <button key={mode.id} type="button" onClick={() => setPaymentMode(mode.id)} className={`flex items-center justify-center px-1 py-1 rounded border text-[9px] font-black transition-all ${paymentMode === mode.id ? 'bg-brand-red text-white border-brand-red' : 'bg-surface text-text-muted border-border-default'}`}>{mode.label}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tax */}
                                <div className="p-1.5 bg-subtle rounded-xl border border-border-default shadow-sm flex flex-col">
                                    <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 flex items-center gap-1.5"><Percent size={13} /> Tax & Disc</label>
                                    <div className="flex flex-col gap-1 mt-0">
                                        <select className="w-full py-0.5 rounded border text-[12px] font-black tracking-widest transition-all outline-none text-center bg-brand-red text-white border-brand-red h-[28px] appearance-none cursor-pointer" value={vatClassification} onChange={(e) => setVatClassification(e.target.value as VatClassification)}>
                                            <option value="vatable">VAT</option>
                                            <option value="exempt">EXE</option>
                                            <option value="zero_rated">ZERO</option>
                                        </select>
                                        <button type="button" onClick={() => setIsDiscountEnabled(!isDiscountEnabled)} className={`w-full py-0.5 rounded border text-[12px] font-black tracking-widest transition-all h-[28px] ${isDiscountEnabled ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-surface text-text-muted border-border-default'}`}>Discount</button>
                                    </div>
                                </div>

                                {/* Summary Box (Compact) */}
                                <div className="mt-auto p-2 bg-brand-red text-white rounded-xl shadow-lg border border-brand-red-dark">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] font-black uppercase opacity-60">Grand Total</span>
                                        <span className="text-[12px] font-data font-black">₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <button type="submit" disabled={loading || items.every(i => !i.product_id)} className="w-full bg-surface text-brand-red py-1.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-sm hover:bg-subtle transition-all disabled:opacity-50 border border-brand-red/20">
                                        {loading ? 'SAVING...' : 'SAVE SALE'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form >
                </div >
            </div >

            {/* Delivery Prompt Overlay */}
            {showDeliveryPrompt && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-brand-charcoal/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-border-default animate-slide-up">
                        <div className="w-16 h-16 bg-brand-red-light rounded-2xl flex items-center justify-center text-brand-red mb-6 mx-auto">
                            <Truck size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-text-primary text-center mb-1">Deliver</h3>
                        <p className="text-text-muted text-center text-[13px] font-black uppercase tracking-[0.2em] mb-8">ORDER IS BELOW 5,000</p>

                        <div className="space-y-3">
                            {promptStep === 'confirm' ? (
                                // Keeping confirm logic as fallback/logic-path although validateAndSubmit sets it to 'input' now
                                <>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => setPromptStep('input')}
                                        className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-sm shadow-red hover:bg-brand-red-dark transition-all active:scale-[0.98] uppercase tracking-widest ring-offset-2 focus:ring-2 focus:ring-brand-red disabled:opacity-50"
                                    >
                                        YES
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => {
                                            setDeliveryFee(0);
                                            handleSubmit();
                                        }}
                                        className="w-full py-4 bg-surface border-2 border-border-default text-text-muted rounded-2xl font-bold text-xs hover:border-border-strong hover:text-text-secondary transition-all uppercase tracking-widest disabled:opacity-50"
                                    >
                                        NO
                                    </button>
                                </>
                            ) : (
                                <div className="animate-fade-in text-center">
                                    <div className="p-4 bg-subtle rounded-2xl border border-border-default mb-4">
                                        <label className="block text-[13px] font-black text-text-muted uppercase tracking-widest mb-2 text-center">DELIVERY FEE (PHP)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">₱</span>
                                            <input
                                                type="number"
                                                autoFocus
                                                className="w-full bg-surface border-2 border-brand-red/20 rounded-xl pl-8 pr-4 py-3 text-lg font-data font-black text-text-primary outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/50 transition-all text-center"
                                                placeholder="0.00"
                                                value={deliveryFee || ''}
                                                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSubmit();
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleSubmit()}
                                        className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-sm shadow-red hover:bg-brand-red-dark transition-all active:scale-[0.98] uppercase tracking-widest disabled:opacity-50"
                                    >
                                        SAVE WITH FEE
                                    </button>
                                    {/* Link for No Fee if user changed their mind */}
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => {
                                            setDeliveryFee(0);
                                            handleSubmit();
                                        }}
                                        className="w-full py-1 text-text-muted hover:text-text-secondary mt-2 text-[12px] font-bold uppercase tracking-widest"
                                    >
                                        CONTINUE WITHOUT FEE
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeliveryPrompt(false)}
                                        className="w-full py-2 text-text-muted hover:text-text-secondary transition-all text-[13px] font-black uppercase tracking-widest mt-1"
                                    >
                                        BACK
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >,
        document.body
    );
}
