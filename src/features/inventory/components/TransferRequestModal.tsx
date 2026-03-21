import { useState, useEffect } from 'react';
import type { Product } from '../types/product';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { X, Building2, Package, Send, Search, ArrowRightLeft } from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useAuth } from '../../../shared/hooks/useAuth';
import { toast } from 'sonner';


interface CartItem {
    product_id: string;
    sku: string;
    name: string;
    quantity: number;
    stock_available: number;
}

import type { StockTransfer } from '../../../shared/hooks/useTransfers';

interface TransferRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: Product | null;
    onSuccess: () => void;
    transferToEdit?: StockTransfer;
}

export default function TransferRequestModal({ isOpen, onClose, product, onSuccess, transferToEdit }: TransferRequestModalProps) {
    const { branches, activeBranchId } = useBranch();
    const { user } = useAuth();
    const [direction, setDirection] = useState<'send' | 'request'>('send');
    const [targetBranchId, setTargetBranchId] = useState<number | null>(null);
    const [targetBranchStock, setTargetBranchStock] = useState<Record<string, number>>({});
    const [cart, setCart] = useState<CartItem[]>([]);
    const [remarks, setRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [branchSearch, setBranchSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);

    const otherBranches = branches.filter(b => b.id.toString() !== activeBranchId?.toString());
    const filteredBranches = otherBranches.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase()));

    useEffect(() => {
        if (isOpen && transferToEdit) {
            // Determine direction
            const isSend = String(transferToEdit.source_branch_id) === String(activeBranchId);
            setDirection(isSend ? 'send' : 'request');
            setTargetBranchId(isSend ? transferToEdit.destination_branch_id : transferToEdit.source_branch_id);
            setRemarks(transferToEdit.request_remarks?.split(': ').slice(1).join(': ') || '');
            
            // Map items to cart
            const mappedItems: CartItem[] = (transferToEdit.items || []).map(item => ({
                product_id: item.product_id || '',
                sku: item.sku,
                name: item.name,
                quantity: item.quantity,
                stock_available: 0
            }));
            
            // Legacy single-item support
            if (mappedItems.length === 0 && transferToEdit.product_sku) {
                mappedItems.push({
                    product_id: '',
                    sku: transferToEdit.product_sku,
                    name: transferToEdit.product_name,
                    quantity: transferToEdit.quantity,
                    stock_available: 0
                });
            }
            setCart(mappedItems);
        } else if (isOpen && product) {
            setDirection('send');
            setCart([{
                product_id: product.id || '',
                sku: product.sku,
                name: product.name,
                quantity: 1,
                stock_available: product.stock_available
            }]);
            setRemarks('');
            setTargetBranchId(null);
        } else if (!isOpen) {
            setCart([]);
            setTargetBranchId(null);
            setRemarks('');
            setDirection('send');
        }
    }, [isOpen, transferToEdit, product, activeBranchId]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]);

    // Search products to add to cart
    useEffect(() => {
        const searchProducts = async () => {
            if (productSearch.length < 2) {
                setSearchResults([]);
                return;
            }
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, stock_available')
                .eq('branch_id', activeBranchId)
                .or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`)
                .limit(5);

            if (!error && data) setSearchResults(data as unknown as Product[]);
        };

        const timer = setTimeout(searchProducts, 300);
        return () => clearTimeout(timer);
    }, [productSearch, activeBranchId]);

    // Fetch target branch stock for all cart items
    useEffect(() => {
        const fetchTargetStocks = async () => {
            if (!targetBranchId || cart.length === 0) return;

            const skus = cart.map(item => item.sku);
            const { data, error } = await supabase
                .from('products')
                .select('sku, stock_available')
                .eq('branch_id', targetBranchId)
                .in('sku', skus);

            if (!error && data) {
                const stockMap: Record<string, number> = {};
                data.forEach(d => { stockMap[d.sku] = d.stock_available; });
                setTargetBranchStock(stockMap);
            }
        };

        if (isOpen && targetBranchId) fetchTargetStocks();
    }, [targetBranchId, cart, isOpen]);

    const addToCart = (p: Product) => {
        if (cart.find(item => item.sku === p.sku)) {
            toast.error('Item already in cart');
            return;
        }
        setCart([...cart, {
            product_id: p.id || '',
            sku: p.sku,
            name: p.name,
            quantity: 1,
            stock_available: p.stock_available
        }]);
        setProductSearch('');
        setSearchResults([]);
    };

    const removeFromCart = (sku: string) => {
        setCart(cart.filter(item => item.sku !== sku));
    };

    const updateQuantity = (sku: string, qty: number) => {
        setCart(cart.map(item => item.sku === sku ? { ...item, quantity: Math.max(1, qty) } : item));
    };

    const handleSubmit = async () => {
        if (!targetBranchId || !user || !activeBranchId || cart.length === 0) return;
        setIsSubmitting(true);

        try {
            const isSending = direction === 'send';
            const payload = {
                source_branch_id: isSending ? Number(activeBranchId) : targetBranchId,
                destination_branch_id: isSending ? targetBranchId : Number(activeBranchId),
                product_sku: cart[0].sku,
                product_name: cart[0].name,
                quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
                items: cart.map(item => ({
                    product_id: item.product_id,
                    sku: item.sku,
                    name: item.name,
                    quantity: item.quantity
                })),
                request_remarks: `${direction.toUpperCase()}: ${remarks}`,
                updated_at: new Date().toISOString()
            };

            if (transferToEdit) {
                const { error } = await supabase
                    .from('stock_transfers')
                    .update(payload)
                    .eq('id', transferToEdit.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('stock_transfers')
                    .insert({
                        ...payload,
                        status: 'pending',
                        requested_by: user.id,
                        created_at: new Date().toISOString()
                    });
                if (error) throw error;
            }

            toast.success(transferToEdit ? 'Request updated!' : 'Transfer request sent successfully!');
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error processing transfer:', err);
            toast.error(transferToEdit ? 'Failed to update request' : 'Failed to send request');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-surface shadow-2xl rounded-[32px] border border-border-default overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-8 pt-8 pb-6 bg-subtle/50 relative shrink-0">
                    <div className="absolute top-0 right-0 p-6">
                        <button onClick={onClose} className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-text-muted hover:text-brand-red shadow-sm transition-all shadow-hover">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-red/10 rounded-2xl flex items-center justify-center text-brand-red shadow-inner">
                            <ArrowRightLeft size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-text-primary tracking-tight">Inventory Transfer</h2>
                            <div className="flex gap-2 mt-1">
                                <button 
                                    onClick={() => setDirection('send')}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase transition-all ${direction === 'send' ? 'bg-brand-red text-white' : 'bg-surface border border-border-default text-text-muted hover:bg-subtle'}`}
                                >
                                    Transfer Out
                                </button>
                                <button 
                                    onClick={() => setDirection('request')}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase transition-all ${direction === 'request' ? 'bg-indigo-600 text-white' : 'bg-surface border border-border-default text-text-muted hover:bg-subtle'}`}
                                >
                                    Request In
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {/* Branch Selection */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-1">
                            {direction === 'send' ? 'Destination Branch (To)' : 'Source Branch (From)'}
                        </label>
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={16} />
                            <input 
                                type="text"
                                placeholder="Search branch..."
                                className="w-full pl-12 pr-4 py-3.5 bg-subtle border border-border-default rounded-2xl text-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-all placeholder:text-text-muted"
                                value={branchSearch}
                                onChange={(e) => setBranchSearch(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex gap-2 pb-2 overflow-x-auto custom-scrollbar-h">
                            {filteredBranches.map(branch => (
                                <button 
                                    key={branch.id}
                                    onClick={() => setTargetBranchId(Number(branch.id))}
                                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${targetBranchId === Number(branch.id) ? 'bg-brand-red border-brand-red text-white shadow-red-sm' : 'bg-surface border-border-default text-text-secondary hover:bg-subtle'}`}
                                >
                                    <Building2 size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-tight">{branch.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Selection/Dropdown */}
                    <div className="space-y-3 pt-2 border-t border-border-muted/50">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-1">Add More Items</label>
                        <div className="relative group">
                            <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={16} />
                            <input 
                                type="text"
                                placeholder="Search product to add..."
                                className="w-full pl-12 pr-4 py-3.5 bg-subtle border border-border-default rounded-2xl text-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-all placeholder:text-text-muted"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                            />
                            
                            {/* Search Results Dropdown */}
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border-default rounded-2xl shadow-xl z-50 overflow-hidden animate-slide-down">
                                    {searchResults.map(p => (
                                        <button 
                                            key={p.sku}
                                            onClick={() => addToCart(p)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-subtle transition-colors border-b border-border-muted last:border-0"
                                        >
                                            <div className="text-left">
                                                <p className="text-xs font-black text-text-primary uppercase">{p.name}</p>
                                                <p className="text-[9px] text-text-muted">{p.sku}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-brand-red uppercase">Stock: {p.stock_available}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pl-1">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Requested Items ({cart.length})</label>
                        </div>
                        <div className="space-y-2">
                            {cart.map(item => (
                                <div key={item.sku} className="bg-surface border border-border-default rounded-2xl p-4 flex items-center gap-4 group hover:border-brand-red transition-all">
                                    <div className="w-10 h-10 bg-subtle rounded-xl flex items-center justify-center text-text-muted group-hover:bg-brand-red/5 group-hover:text-brand-red transition-colors">
                                        <Package size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-text-primary uppercase truncate leading-tight">{item.name}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <p className="text-[9px] text-text-muted font-bold">{item.sku}</p>
                                            <div className="h-3 w-px bg-border-muted" />
                                            <p className="text-[9px] text-brand-red font-black uppercase">Your: {item.stock_available}</p>
                                            <div className="h-3 w-px bg-border-muted" />
                                            <p className="text-[9px] text-emerald-500 font-black uppercase">Target: {targetBranchStock[item.sku] ?? '...'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center bg-subtle rounded-xl border border-border-default p-1">
                                            <button 
                                                onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                                                className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-brand-red hover:bg-surface rounded-lg transition-all"
                                            >
                                                -
                                            </button>
                                            <input 
                                                type="number" 
                                                className="w-10 bg-transparent text-center text-xs font-black text-text-primary outline-none"
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.sku, parseInt(e.target.value) || 1)}
                                            />
                                            <button 
                                                onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                                                className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-brand-red hover:bg-surface rounded-lg transition-all"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <button 
                                            onClick={() => removeFromCart(item.sku)}
                                            className="p-2 text-text-muted hover:text-brand-red transition-colors"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <div className="text-center py-8 bg-subtle/30 rounded-2xl border border-dashed border-border-default">
                                    <p className="text-xs text-text-muted">No items in request. Search and add items above.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border-muted/50">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-1">Reason / Remarks (Optional)</label>
                        <textarea 
                            placeholder="Why do you need this stock?"
                            className="w-full px-4 py-3.5 bg-subtle border border-border-default rounded-2xl text-sm min-h-[80px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-all resize-none placeholder:text-text-muted"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-8 bg-subtle/50 border-t border-border-muted flex gap-3 shrink-0">
                    <button 
                        onClick={onClose}
                        className="flex-1 px-6 py-4 rounded-2xl font-bold text-xs text-text-secondary hover:bg-surface border border-transparent hover:border-border-default transition-all uppercase tracking-widest"
                    >
                        Cancel
                    </button>
                    <button 
                        disabled={!targetBranchId || isSubmitting || cart.length === 0}
                        onClick={handleSubmit}
                        className="flex-[2] bg-brand-red text-white px-6 py-4 rounded-2xl font-black text-xs hover:bg-brand-red-dark transition-all shadow-red disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? 'Sending Request...' : 'Send Request'}
                        {!isSubmitting && <Send size={16} />}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
