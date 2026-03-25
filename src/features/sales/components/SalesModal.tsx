import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { X, ShoppingCart, AlertCircle, Plus, Trash2, Percent, User, Truck, SendHorizonal, ChevronUp, ChevronDown, Search, Users, Tag, Receipt, CreditCard } from 'lucide-react';
import { customerService } from '../../customers/services/customerService';
import { encodePrice } from '../../../shared/lib/priceCodes';
import { useAudit } from '../../../shared/hooks/useAudit';
import { useKeyboardNav } from '../../../shared/hooks/useKeyboardNav';
import { computeOutputVat, type VatClassification } from '../../../shared/lib/vatUtils';
import type { Customer } from '../../customers/types/customer';
import { useBranch } from '../../../shared/hooks/useBranch';
import { toast } from 'sonner';
import { isSmartMatch } from '../../../shared/lib/searchUtils';
import { sanitizeString } from '../../../shared/lib/sanitize';


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
    const [customerHighlightedIndex, setCustomerHighlightedIndex] = useState(0);
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
    const customerSearchInputRef = useRef<HTMLInputElement>(null);
    const saveButtonRef = useRef<HTMLButtonElement>(null);

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
            const data = await customerService.getAll();
            setCustomers(data);
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
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


    const handleInvoiceChange = (val: string) => {
        // Strip everything but numbers
        const num = val.replace(/\D/g, '').slice(0, 6);
        setRawInvoiceNum(num);
        // Display value prefixing
        const newInvoice = isOs ? `OS-${num}` : num;
        setInvoiceNumber(newInvoice);
        setOrNumber(newInvoice);
    };


    const handleInvoiceBlur = () => {
        // Apply padding when focus is lost
        const paddedNum = rawInvoiceNum.padStart(6, '0');
        setRawInvoiceNum(paddedNum);
        const newInvoice = isOs ? `OS-${paddedNum}` : paddedNum;
        setInvoiceNumber(newInvoice);
        setOrNumber(newInvoice);
    };

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
            <div className="w-full max-w-6xl rounded-2xl bg-surface shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
                <div className="flex items-center justify-between px-6 py-3 bg-brand-charcoal">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white"><ShoppingCart size={16} /></div>
                        <h2 className="text-base font-bold text-white uppercase tracking-wider">{editData ? 'Edit Sale' : 'New Sale'}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
                </div>


                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide bg-surface">
                    {error && <div className="mb-4 p-3 bg-danger-subtle border border-danger text-danger text-sm rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                    <form id="order-form" onSubmit={validateAndSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                             <div className="lg:col-span-4 p-3 bg-brand-charcoal rounded-2xl border border-border-strong px-5 flex items-center justify-between shadow-soft min-h-[65px]">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-2"><Receipt size={12} /> Invoice</label>
                                    <div className="flex items-center gap-4">
                                         <input
                                             type="text"
                                             className="w-32 bg-transparent text-white text-lg font-data font-black outline-none border-b-2 border-slate-700 focus:border-brand-red transition-all text-center tracking-widest h-[28px]"
                                             value={rawInvoiceNum}
                                             onChange={(e) => handleInvoiceChange(e.target.value)}
                                             onBlur={handleInvoiceBlur}
                                             onFocus={(e) => e.target.select()}
                                             placeholder={isOs ? 'OS-000001' : '000001'}
                                         />
                                         <div className="flex bg-white/10 border border-white/10 rounded-lg p-1 shadow-md shrink-0">
                                             <button
                                                 type="button"
                                                 disabled={isOs}
                                                 onClick={() => setInvoiceType('A')}
                                                 className={`px-3 py-1.5 rounded-md text-[11px] font-black transition-all ${invoiceType === 'A' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-slate-400 hover:text-white'} ${isOs ? 'opacity-20 cursor-not-allowed' : ''}`}
                                             >
                                                 A
                                             </button>
                                             <button
                                                 type="button"
                                                 disabled={isOs}
                                                 onClick={() => setInvoiceType('B')}
                                                 className={`px-3 py-1.5 rounded-md text-[11px] font-black transition-all ${invoiceType === 'B' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-slate-400 hover:text-white'} ${isOs ? 'opacity-20 cursor-not-allowed' : ''}`}
                                             >
                                                 B
                                             </button>
                                         </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newIsOs = !isOs;
                                                setIsOs(newIsOs);
                                                fetchLatestInvoice(newIsOs);
                                            }}
                                            className={`ml-10 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${isOs ? 'bg-brand-red text-white shadow-red ring-1 ring-brand-red/20' : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white hover:bg-white/10'}`}
                                        >
                                            OS
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5 shrink-0">
                                    <button type="button" onClick={() => stepInvoice(1)} title="Increment" className="flex items-center justify-center w-6 h-4 bg-white/10 hover:bg-brand-red text-white rounded border border-white/5 transition-all">
                                        <ChevronUp size={10} strokeWidth={3} />
                                    </button>
                                    <button type="button" onClick={() => stepInvoice(-1)} title="Decrement" className="flex items-center justify-center w-6 h-4 bg-white/10 hover:bg-brand-red text-white rounded border border-white/5 transition-all">
                                        <ChevronDown size={10} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                              <div className="lg:col-span-4 p-2 bg-subtle rounded-xl border border-border-default min-h-[65px] flex flex-col justify-center">
                                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1.5 flex items-center gap-2"><Tag size={12} /> Accounting Label</label>
                                <select 
                                    className="w-full bg-surface border border-border-default rounded-xl px-2 py-1.5 text-xs font-black text-text-primary outline-none focus:ring-2 focus:ring-brand-red/10 appearance-none cursor-pointer uppercase"
                                    value={transactionLabel}
                                    onChange={(e) => { setTransactionLabel(e.target.value);  }}
                                >

                                    <option value="">NO LABEL</option>
                                    {AR_LABELS.map(label => (
                                        <option key={label.id} value={label.id}>{label.label}</option>
                                    ))}
                                </select>
                            </div>
                              <div 
                                 className="lg:col-span-4 p-2 bg-subtle rounded-xl border border-border-default relative min-h-[65px] flex flex-col justify-center"
                                onMouseEnter={() => setIsCustomerSearchOpen(true)}
                                onMouseLeave={() => setIsCustomerSearchOpen(false)}
                            >
                                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1.5 flex items-center gap-2"><User size={12} /> Customer Name</label>
                                <div className="relative">
                                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><Users size={12} /></div>
                                    <input
                                        type="text"
                                        ref={customerSearchInputRef}
                                        placeholder="Enter customer..."
                                        className="w-full bg-surface border border-border-default rounded-xl pl-8 pr-7 py-1.5 text-xs focus:ring-2 focus:ring-brand-red/20 outline-none shadow-sm font-medium h-[32px]"
                                        value={customerSearchQuery}
                                        onChange={(e) => {
                                            setCustomerSearchQuery(e.target.value);
                                            setCustomerName(e.target.value);
                                            setCustomerHighlightedIndex(0);
                                            
                                            if (!e.target.value) setCustomerId(null);
                                        }}
                                        onFocus={(e) => {
                                            e.target.select();
                                        }}
                                        onKeyDown={(e) => {
                                            const filtered = customers.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()));
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setIsCustomerSearchOpen(true);
                                                setCustomerHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1));
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setCustomerHighlightedIndex(prev => Math.max(prev - 1, 0));
                                            } else if (e.key === 'Enter') {
                                                if (isCustomerSearchOpen && filtered[customerHighlightedIndex]) {
                                                    e.preventDefault();
                                                    const c = filtered[customerHighlightedIndex];
                                                    setCustomerId(c.id);
                                                    setCustomerName(c.name);
                                                    setCustomerSearchQuery(c.name);
                                                    setIsCustomerSearchOpen(false);
                                                }
                                            } else if (e.key === 'Escape') {
                                                setIsCustomerSearchOpen(false);
                                            }
                                        }}
                                    />
                                    {isCustomerSearchOpen && (
                                        <div className="absolute z-[110] left-0 right-0 top-full mt-1 bg-surface border border-border-default rounded-xl shadow-xl max-h-[200px] overflow-y-auto overflow-x-hidden animate-fade-in">                                             {customers.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).length > 0 ? (
                                                customers.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).map((c, index) => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onMouseEnter={() => setCustomerHighlightedIndex(index)}
                                                        onClick={() => {
                                                            setCustomerId(c.id);
                                                            setCustomerName(c.name);
                                                            setCustomerSearchQuery(c.name);
                                                            setIsCustomerSearchOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2 border-b border-border-default last:border-0 text-xs font-bold uppercase transition-colors ${customerHighlightedIndex === index ? 'bg-brand-red/5 text-brand-red' : 'text-text-primary'}`}
                                                    >
                                                        {c.name}
                                                    </button>
                                                ))
                                            ) : null}
                                            
                                            {customerSearchQuery.trim() && !customers.find(c => c.name.toLowerCase() === customerSearchQuery.trim().toLowerCase()) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsCustomerSearchOpen(false);
                                                        toast.info(`New customer "${customerSearchQuery}" will be created on save`);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-brand-red-light/10 text-brand-red border-t border-brand-red/10 animate-pulse bg-brand-red/5"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Plus size={12} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-red">Create New: {customerSearchQuery.toUpperCase()}</span>
                                                    </div>
                                                </button>
                                            )}

                                            {!customerSearchQuery.trim() && customers.length === 0 && (
                                                <div className="px-4 py-3 text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">
                                                    NO CUSTOMERS FOUND
                                                </div>
                                            )}
                                        </div>

                                    )}
                                </div>
                            </div>

                              <div className="lg:col-span-6 p-2 bg-subtle rounded-xl border border-border-default min-h-[85px] shadow-sm flex flex-col justify-between">
                                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 flex items-center gap-2"><CreditCard size={12} strokeWidth={2.5} /> Settlement</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PAYMENT_MODES.slice(0, 2).map(mode => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => setPaymentMode(mode.id)}
                                            className={`flex items-center justify-center px-1 py-2 rounded-lg border text-[11px] font-black transition-all ${paymentMode === mode.id ? 'bg-brand-red text-white border-brand-red shadow-md' : 'bg-surface text-slate-400 border-border-default hover:border-slate-300'}`}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                    {PAYMENT_MODES.slice(2, 4).map(mode => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => setPaymentMode(mode.id)}
                                            className={`flex items-center justify-center px-1 py-2 rounded-lg border text-[11px] font-black transition-all ${paymentMode === mode.id ? 'bg-brand-red text-white border-brand-red shadow-md' : 'bg-surface text-slate-400 border-border-default hover:border-slate-300'}`}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="lg:col-span-6 p-2 bg-subtle rounded-xl border border-border-default min-h-[75px] shadow-sm flex flex-col justify-center">
                                 <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 flex items-center gap-2"><Percent size={12} /> Adjustments & Tax</label>
                                 <div className="flex gap-2">
                                    <select
                                        className={`flex-1 py-1 px-1 rounded-lg border text-[11px] font-black tracking-widest transition-all outline-none text-center ${vatClassification === 'vatable' ? 'bg-brand-red/10 text-brand-red border-brand-red/20 pr-4' : 'bg-surface text-text-muted border-border-default'}`}
                                        value={vatClassification}
                                        onChange={(e) => { setVatClassification(e.target.value as VatClassification);  }}
                                    >
                                        <option value="vatable">VAT</option>
                                        <option value="exempt">EXE</option>
                                        <option value="zero_rated">ZERO</option>
                                    </select>
                                    <button type="button" onClick={() => { setIsDiscountEnabled(!isDiscountEnabled);  }} className={`flex-1 py-2 rounded-lg border text-[11px] font-black tracking-widest transition-all ${isDiscountEnabled ? 'bg-brand-orange text-white border-brand-orange shadow-md' : 'bg-surface text-text-muted border-border-default'}`}>Discount</button>
                                </div>

                            </div>
                        </div >



                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-border-default pb-2"><h3 className="text-xs font-black uppercase text-text-primary tracking-widest">Order Items</h3><button type="button" onClick={handleAddItem} className="bg-brand-red-light text-brand-red px-4 py-2 rounded-xl text-[10px] font-black hover:bg-brand-red hover:text-white transition-all"><Plus size={14} className="inline mr-1" /> ADD ITEM</button></div>
                            <div className="space-y-3 pb-40" tabIndex={focusedIndex >= 0 ? 0 : -1} onKeyDown={focusedIndex >= 0 ? handleListKeyDown : undefined} style={{ outline: 'none' }}>
                                {items.map((item, index) => (
                                    <div key={index} className={`flex flex-col lg:flex-row gap-2 p-2 rounded-xl shadow-sm transition-all group/item overflow-visible ${item.product_id && focusedIndex === completedItems.indexOf(item) ? 'bg-accent-subtle border-2 border-accent-primary ring-2 ring-accent-subtle' : 'bg-surface border border-border-default hover:border-brand-red/20'}`}>
                                        {/* Keyboard shortcut indicators for focused row */}
                                        {item.product_id && focusedIndex === completedItems.indexOf(item) && (
                                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-accent-primary mb-1 lg:mb-0">
                                                <span className="px-1.5 py-0.5 bg-accent-subtle rounded">Q</span> Qty
                                                <span className="px-1.5 py-0.5 bg-accent-subtle rounded">R</span> Replace
                                                <span className="px-1.5 py-0.5 bg-accent-subtle rounded">Del</span> Remove
                                                {deleteConfirmIndex === completedItems.indexOf(item) && (
                                                    <span className="px-2 py-0.5 bg-danger text-white rounded animate-pulse">Press Delete again to remove</span>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex-[4] relative" ref={el => { dropdownRefs.current[index] = el; }}>
                                            <label className="block text-[9px] font-black text-text-primary mb-1.5 uppercase">Product</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={14} /></div>
                                                <input
                                                    type="text"
                                                    placeholder="Focus to search product..."
                                                    className="w-full bg-subtle border border-border-default rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium text-text-primary focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/30 outline-none placeholder:text-text-muted"
                                                    value={item.searchQuery}
                                                    ref={el => { searchInputRefs.current[index] = el; }}
                                                    onChange={(e) => handleItemChange(index, 'searchQuery', e.target.value)}
                                                    onFocus={() => handleItemChange(index, 'isSearchOpen', true)}
                                                    onKeyDown={(e) => {
                                                        const query = item.searchQuery?.toLowerCase() || '';
                                                        const filtered = products
                                                            .filter(p => p.name.toLowerCase().includes(query) || (p.brand?.toLowerCase().includes(query) ?? false))
                                                            .sort((a, b) => {
                                                                const aName = a.name.toLowerCase();
                                                                const bName = b.name.toLowerCase();
                                                                const aExact = aName === query;
                                                                const bExact = bName === query;
                                                                if (aExact && !bExact) return -1;
                                                                if (!aExact && bExact) return 1;
                                                                const aPrefix = aName.startsWith(query);
                                                                const bPrefix = bName.startsWith(query);
                                                                if (aPrefix && !bPrefix) return -1;
                                                                if (!aPrefix && bPrefix) return 1;
                                                                return aName.localeCompare(bName);
                                                            });

                                                        if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            if (item.isSearchOpen) {
                                                                handleItemChange(index, 'highlightedIndex', Math.min((item.highlightedIndex || 0) + 1, filtered.length - 1));
                                                            } else {
                                                                handleItemChange(index, 'isSearchOpen', true);
                                                            }
                                                        } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            if ((item.highlightedIndex || 0) === 0 && item.isSearchOpen) {
                                                                // At top of suggestions, close and stay in search
                                                            } else {
                                                                handleItemChange(index, 'highlightedIndex', Math.max((item.highlightedIndex || 0) - 1, 0));
                                                            }
                                                        } else if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (item.isSearchOpen && filtered[item.highlightedIndex || 0]) {
                                                                selectProduct(index, filtered[item.highlightedIndex || 0]);
                                                            } else {
                                                                // Enter on empty search when items exist -> move to save
                                                                const isEmpty = !item.searchQuery;
                                                                const hasItems = completedItems.length > 0;
                                                                if (isEmpty && hasItems) {
                                                                    saveButtonRef.current?.focus();
                                                                }
                                                            }
                                                        } else if (e.key === 'Escape') {
                                                            if (item.isSearchOpen) {
                                                                handleItemChange(index, 'isSearchOpen', false);
                                                            }
                                                        }
                                                    }}
                                                />
                                                {item.searchQuery && (
                                                    <button type="button" onClick={() => { const ni = [...items]; ni[index] = { ...ni[index], searchQuery: '', product_id: '', unit_price: 0, currentLevel: 'master', selectedPath: {}, isSearchOpen: false }; setItems(ni); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-brand-red transition-colors">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            {item.isSearchOpen && (
                                                <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-surface border border-border-default rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-h-[350px] overflow-hidden flex flex-col min-w-[400px] animate-fade-in">
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
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                {item.selectedPath?.master}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                                                        {item.searchQuery ? (
                                                            // Global Search Mode
                                                            (() => {
                                                                const query = item.searchQuery.toLowerCase();
                                                                const filtered = products
                                                                    .filter(p => isSmartMatch(`${p.name} ${p.brand || ''}`, query))
                                                                    .sort((a, b) => {
                                                                        const aName = a.name.toLowerCase();
                                                                        const bName = b.name.toLowerCase();
                                                                        const aExact = aName === query;
                                                                        const bExact = bName === query;
                                                                        if (aExact && !bExact) return -1;
                                                                        if (!aExact && bExact) return 1;
                                                                        const aPrefix = aName.startsWith(query);
                                                                        const bPrefix = bName.startsWith(query);
                                                                        if (aPrefix && !bPrefix) return -1;
                                                                        if (!aPrefix && bPrefix) return 1;
                                                                        return aName.localeCompare(bName);
                                                                    })
                                                                    .slice(0, 15); // Show top 15 for speed

                                                                if (filtered.length > 0) {
                                                                    return filtered.map((p, pIdx) => (
                                                                        <button
                                                                            key={p.id}
                                                                            type="button"
                                                                            onMouseEnter={() => handleItemChange(index, 'highlightedIndex', pIdx)}
                                                                            onClick={() => selectProduct(index, p)}
                                                                            className={`w-full text-left px-4 py-3 border-b border-border-default last:border-0 flex flex-col gap-0.5 transition-colors ${item.highlightedIndex === pIdx ? 'bg-brand-red/5' : 'hover:bg-subtle'}`}
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-[11px] font-black text-text-primary uppercase">{p.name} {p.brand ? <span className="text-brand-red">[{p.brand}]</span> : ''}</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between text-[10px]">
                                                                                <span className="text-text-muted font-medium font-data flex items-center gap-2">
                                                                                    STK: <span className={p.stock_available <= 5 ? 'text-brand-red font-bold' : 'text-emerald-600'}>{p.stock_available}</span>
                                                                                    {p.buying_price && <span className="text-[8px] font-black text-text-muted">[{encodePrice(p.buying_price)}]</span>}
                                                                                </span>
                                                                                <span className="text-text-primary font-black font-data">₱{p.selling_price.toLocaleString()}</span>
                                                                            </div>
                                                                        </button>
                                                                    ));
                                                                }
                                                                return (
                                                                    <div className="p-8 text-center bg-subtle rounded-xl">
                                                                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-text-muted mx-auto mb-2"><Search size={16} /></div>
                                                                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">No products found</p>
                                                                    </div>
                                                                );
                                                            })()
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
                                                                    className="w-full text-left px-5 py-4 hover:bg-brand-red/5 border-b border-border-default last:border-0 flex items-center justify-between group"
                                                                >
                                                                    <span className="text-[11px] font-black text-text-primary uppercase tracking-wider">{m}</span>
                                                                    <ChevronDown size={14} className="-rotate-90 text-text-muted group-hover:text-brand-red transition-colors" />
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
                                                                        className="w-full text-left px-4 py-3 hover:bg-subtle border-b border-border-default last:border-0 flex flex-col gap-0.5"
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[11px] font-black text-text-primary uppercase">
                                                                                {p.name.split(' > ').slice(1).join(' > ')} {p.brand ? <span className="text-brand-red">[{p.brand}]</span> : ''}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                            <span className="text-text-muted font-medium font-data">STK: <span className={p.stock_available <= 5 ? 'text-brand-red font-bold' : 'text-emerald-600'}>{p.stock_available}</span></span>
                                                                            <span className="text-text-primary font-black font-data">₱{p.selling_price.toLocaleString()}</span>
                                                                        </div>
                                                                    </button>
                                                                ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-[2]">
                                            <label className="block text-[9px] font-black text-text-primary mb-1.5 uppercase">Price (SRP)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">₱</span>
                                                <input readOnly type="number" step="0.01" className="w-full bg-muted border border-border-default rounded-xl pl-6 pr-3 py-2.5 text-xs font-data text-text-muted outline-none cursor-not-allowed" value={item.unit_price || ''} />
                                            </div>
                                        </div>
                                        <div className="flex-[1.5]">
                                            <label className="block text-[9px] font-black text-text-primary mb-1.5 uppercase">Qty</label>
                                            <input
                                                type="number"
                                                step={item.unit?.toLowerCase() === 'elf' ? '0.25' : '1'}
                                                min="0"
                                                className="w-full bg-subtle border border-border-default rounded-xl px-3 py-2.5 text-xs font-data text-text-primary focus:border-brand-red outline-none shadow-inner"
                                                value={item.quantity}
                                                ref={el => { quantityInputRefs.current[index] = el; }}
                                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        // Confirm this line item, add a new row and re-focus search
                                                        if (index === items.length - 1) {
                                                            handleAddItem();
                                                        } else if (searchInputRefs.current[index + 1]) {
                                                            searchInputRefs.current[index + 1]?.focus();
                                                        }
                                                        setEditingQtyIndex(-1);
                                                    } else if (e.key === 'Escape') {
                                                        e.preventDefault();
                                                        // Return to the last search input
                                                        const lastSearchIdx = items.length - 1;
                                                        searchInputRefs.current[lastSearchIdx]?.focus();
                                                        setEditingQtyIndex(-1);
                                                    }
                                                }}
                                            />
                                            {item.name?.toLowerCase().includes('elf') && (
                                                <div className="mt-1.5 p-1.5 bg-brand-red/5 border border-brand-red/10 rounded-lg animate-fade-in group/calc relative">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-[8px] font-black text-brand-red uppercase tracking-widest leading-none text-left">Cubic Calc</span>
                                                        <input 
                                                            type="number" 
                                                            placeholder="m³"
                                                            className="w-10 bg-surface border border-border-default rounded px-1 py-0.5 text-[9px] font-data text-text-primary outline-none focus:border-brand-red h-[16px]"
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
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-[1.5] hidden lg:block">
                                            <label className="block text-[9px] font-black text-text-primary mb-1.5 uppercase">After</label>
                                            <div className={`py-2.5 px-3 rounded-xl border font-data text-center text-xs font-bold ${((item.stock_available || 0) - item.quantity) < 0 ? 'bg-danger-subtle border-danger text-brand-red' : 'bg-success-subtle border-success text-emerald-600'}`}>
                                                {(item.stock_available || 0) - item.quantity}
                                            </div>
                                        </div>
                                        <div className="flex-[2.5] text-right min-w-[120px]">
                                            <label className="block text-[9px] font-black text-text-primary mb-1.5 uppercase">Sub-Total</label>
                                            <div className="py-2.5 font-black text-lg text-text-primary font-data overflow-hidden text-ellipsis">₱{item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        <div className="flex items-center justify-center lg:pt-5">
                                            <button type="button" onClick={() => handleRemoveItem(index)} disabled={items.length === 1} className="p-2.5 text-text-muted hover:text-brand-red hover:bg-brand-red/5 rounded-xl transition-all disabled:opacity-0"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form >
                </div >

                <div className="px-8 py-6 bg-brand-charcoal flex flex-col md:flex-row items-end md:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="flex flex-wrap items-center gap-x-10 gap-y-4 text-white/60 relative z-10 w-full md:w-auto">
                        <div className="min-w-[140px]">
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Items Total</p>
                            <p className="text-base lg:text-lg font-black font-data text-white whitespace-nowrap">₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className={`min-w-[120px] transition-all ${!isOs && currentVatClassification === 'vatable' ? 'opacity-100' : 'opacity-20'}`}>
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Tax (12%)</p>
                            <p className="text-base lg:text-lg font-black font-data text-brand-red whitespace-nowrap">₱{finalVatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className={`min-w-[120px] transition-all ${isDiscountEnabled ? 'opacity-100' : 'opacity-20'}`}>
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-1.5">Discount</p>
                            <p className="text-base lg:text-lg font-black font-data text-brand-orange whitespace-nowrap">- ₱{finalDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end relative z-10 w-full md:w-auto max-w-full overflow-hidden">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Items Total</p>
                        <div className="flex flex-wrap items-center justify-end gap-6 text-right">
                            <p className="text-3xl lg:text-4xl font-black text-white font-data shadow-sm whitespace-nowrap">₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <button 
                                ref={saveButtonRef}
                                type="button" 
                                onClick={() => validateAndSubmit()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        const lastSearchIdx = items.length - 1;
                                        searchInputRefs.current[lastSearchIdx]?.focus();
                                    }
                                }}
                                disabled={loading || success} 
                                className="px-8 lg:px-10 py-4 lg:py-5 bg-brand-red hover:bg-brand-red-dark text-white rounded-2xl font-black text-sm shadow-red active:scale-95 disabled:opacity-50 tracking-[0.2em] flex items-center gap-2 group shrink-0 focus:ring-4 focus:ring-white/30 focus:outline-none"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                <span>{loading ? 'PROCESSING' : success ? 'DONE!' : 'FINALIZE ORDER'}</span>
                                {!loading && !success && <SendHorizonal size={18} className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div >

            {/* Delivery Prompt Overlay */}
            {showDeliveryPrompt && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-brand-charcoal/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-border-default animate-slide-up">
                        <div className="w-16 h-16 bg-brand-red-light rounded-2xl flex items-center justify-center text-brand-red mb-6 mx-auto">
                            <Truck size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-text-primary text-center mb-1">Deliver</h3>
                        <p className="text-text-muted text-center text-[10px] font-black uppercase tracking-[0.2em] mb-8">ORDER IS BELOW 5,000</p>

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
                                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 text-center">DELIVERY FEE (PHP)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                                            <input
                                                type="number"
                                                autoFocus
                                                className="w-full bg-surface border-2 border-brand-red/20 rounded-xl pl-8 pr-4 py-3 text-lg font-data font-black text-text-primary outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red/50 transition-all text-center"
                                                placeholder="0.00"
                                                value={deliveryFee || ''}
                                                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
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
                                        className="w-full py-1 text-text-muted hover:text-text-secondary mt-2 text-[9px] font-bold uppercase tracking-widest"
                                    >
                                        CONTINUE WITHOUT FEE
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeliveryPrompt(false)}
                                        className="w-full py-2 text-text-muted hover:text-text-secondary transition-all text-[10px] font-black uppercase tracking-widest mt-1"
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
