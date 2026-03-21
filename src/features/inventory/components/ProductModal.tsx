import React, { useState, useEffect, useCallback } from 'react';
import type { Product } from '../types/product';
import { createPortal } from 'react-dom';
import { X, Package, AlertTriangle, Info, Tag, DollarSign, Building2, Eye, Truck } from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';
import CategoryRenameModal from './CategoryRenameModal';
import { encodePrice } from '../../../shared/lib/priceCodes';
import { useProducts } from '../hooks/useProducts';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { inferUnitFromName } from '../../../shared/lib/unitUtils';
import { sanitizeString } from '../../../shared/lib/sanitize';



interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    product?: Product | null;
    role: 'owner' | 'admin' | 'encoder' | null;
    initialData?: { l1?: string; l2?: string; l3?: string; branch_id?: string };
}

export default function ProductModal(props: ProductModalProps) {
    const { isOpen, onClose, onSuccess, product, role } = props;
    const { activeBranchId } = useBranch();
    const { createProduct, updateProduct, choices, products } = useProducts();
    const { suppliers } = useSuppliers();

    const [formData, setFormData] = useState<Partial<Product>>({
        name: '',
        stock_available: 0,
        stock_reserved: 0,
        stock_damaged: 0,
        brand: '',
        description: '',
        buying_price: 0,
        selling_price: 0,
        unit: 'pc',
        low_stock_threshold: 10,
        supplier_id: null
    });

    const [l1, setL1] = useState('');
    const [l2, setL2] = useState('');
    const [l3, setL3] = useState('');
    const [l4, setL4] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [renameState, setRenameState] = useState<{ isOpen: boolean; currentName: string; level: 1 | 2 | 3 | null }>({
        isOpen: false,
        currentName: '',
        level: null
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                (document.getElementById('product-form') as HTMLFormElement)?.requestSubmit();
            }
        };

        if (isOpen) {
            document.body.classList.add('modal-open');
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setHasChanged(false);
        setError(null);
        if (product) {
            setFormData({
                ...product,
                brand: product.brand || '',
                description: product.description || '',
                buying_price: product.buying_price || 0,
                selling_price: product.selling_price || 0,
                unit: product.unit || 'pc',
                low_stock_threshold: product.low_stock_threshold || 10
            });
            const name = product.name || '';
            if (name.includes(' > ')) {
                const parts = name.split(' > ');
                setL1(parts[0] || '');
                setL2(parts[1] || '');
                setL3(parts[2] || '');
                setL4(parts[3] || '');
            } else if (name.includes(' - ')) {
                const [cat, type] = name.split(' - ');
                setL1('UNCATEGORIZED');
                setL2(cat || '');
                setL3('');
                setL4(type || '');
            } else {
                setL1('UNCATEGORIZED');
                setL2('');
                setL3('');
                setL4(name);
            }
        } else {
            setFormData({
                name: '',
                stock_available: 0,
                stock_reserved: 0,
                stock_damaged: 0,
                brand: '',
                description: '',
                buying_price: 0,
                selling_price: 0,
                unit: 'pc',
                low_stock_threshold: 10
            });
            setL1(props.initialData?.l1 || '');
            setL2(props.initialData?.l2 || '');
            setL3(props.initialData?.l3 || '');
            setL4('');
        }
    }, [product, isOpen, props.initialData]);

    useEffect(() => {
        if (!isOpen) return;
        const parts = [l1.trim(), l2.trim(), l3.trim(), l4.trim()].filter(p => p !== '');
        const currentName = parts.join(' > ').toUpperCase();
        
        if (currentName) {
            const inferred = inferUnitFromName(currentName);
            if (inferred && (!formData.unit || formData.unit.toLowerCase() === 'pc')) {
                setFormData(prev => ({ ...prev, unit: inferred }));
            }
        }
    }, [l1, l2, l3, l4, isOpen]);

    const [hasChanged, setHasChanged] = useState(false);

    const handleSafeClose = useCallback(() => {
        if (hasChanged) {
            if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                onClose();
            }
        } else {
            onClose();
        }
    }, [hasChanged, onClose]);

    const isEditing = !!product;

    if (!isOpen) return null;
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        try {
            const parts = [l1?.trim(), l2?.trim(), l3?.trim(), l4?.trim()].filter(p => p && p !== '');
            const finalName = sanitizeString(parts.join(' > ').toUpperCase());

            if (!finalName) throw new Error('Product name cannot be empty');

            // PRICE VALIDATION
            if (formData.buying_price === 0) throw new Error('WSP (Buying Price) is required and cannot be 0.');
            if (formData.selling_price === 0) throw new Error('SRP (Selling Price) is required and cannot be 0.');
            if (formData.buying_price === formData.selling_price) throw new Error('WSP and SRP cannot be the same. There must be a profit margin.');
            if ((formData.buying_price || 0) > (formData.selling_price || 0)) {
                throw new Error(`Invalid Pricing: Buying Price (₱${formData.buying_price}) cannot be higher than Selling Price (₱${formData.selling_price}). This would result in a loss.`);
            }

            // DUPLICATE DETECTION (Only for new products)
            if (!isEditing) {
                const isDuplicate = products.some(p => p.name.toUpperCase() === finalName);
                if (isDuplicate) {
                    throw new Error(`Product "${finalName}" already exists in this branch. Please use a unique name or edit the existing product.`);
                }
            }

            const payload = {
                name: finalName,
                sku: finalName,
                stock_available: formData.stock_available || 0,
                stock_reserved: formData.stock_reserved || 0,
                stock_damaged: formData.stock_damaged || 0,
                brand: sanitizeString(formData.brand),
                description: sanitizeString(formData.description),
                buying_price: formData.buying_price || 0,
                selling_price: formData.selling_price || 0,
                unit: sanitizeString(formData.unit) || 'pc',
                low_stock_threshold: formData.low_stock_threshold || 10,
                supplier_id: formData.supplier_id || null,
                branch_id: activeBranchId || null
            } as any;


            if (isEditing && product?.id) {
                await updateProduct({ id: product.id, product: payload });
            } else {
                await createProduct(payload);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save product');
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4 py-6">
            <div className="w-full max-w-2xl rounded-2xl bg-surface shadow-2xl border border-border-default overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-3 bg-text-primary">
                    <div className="flex items-center gap-3 text-text-inverse">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center text-white"><Package size={16} /></div>
                        <h2 className="text-base font-bold">{isEditing ? 'Edit Product' : 'New Product'}</h2>
                    </div>
                    <button onClick={handleSafeClose} className="text-text-muted hover:text-text-inverse"><X size={18} /></button>
                </div>

                <div className="p-4 overflow-y-auto scrollbar-hide text-left flex-1">

                    {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
                    <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* Section 1: Classification */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                <Tag size={12} /> Classification & Identification
                            </h3>
                            <div className="p-3 bg-subtle rounded-xl border border-border-default grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between mb-1.5"><label className="text-[9px] font-black uppercase text-text-primary">Master Category</label></div>
                                    <input type="text" list="l1-options" required placeholder="Type or select Master Category" className="modal-input text-xs bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20" value={l1} onChange={e => { setL1(e.target.value.toUpperCase()); setHasChanged(true); }} />
                                    <datalist id="l1-options">{choices.l1s.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1.5"><label className="text-[9px] font-black uppercase text-text-primary">Category</label>{l2 && <button type="button" onClick={() => setRenameState({ isOpen: true, currentName: l2, level: 2 })} className="text-[8px] font-bold text-amber-600 hover:underline">RENAME</button>}</div>
                                    <input type="text" list="l2-options" className="modal-input text-xs bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20" value={l2} onChange={e => { setL2(e.target.value.toUpperCase()); setHasChanged(true); }} />
                                    <datalist id="l2-options">{choices.l2s.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1.5"><label className="text-[9px] font-black uppercase text-text-primary">Subcategory</label>{l3 && <button type="button" onClick={() => setRenameState({ isOpen: true, currentName: l3, level: 3 })} className="text-[8px] font-bold text-amber-600 hover:underline">RENAME</button>}</div>
                                    <input type="text" list="l3-options" className="modal-input text-xs bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20" value={l3} onChange={e => { setL3(e.target.value.toUpperCase()); setHasChanged(true); }} />
                                    <datalist id="l3-options">{choices.l3s.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                                <div><label className="block text-[9px] font-black uppercase text-text-primary mb-1.5">Details / Size <span className="text-text-muted font-normal normal-case">(optional)</span></label><input type="text" className="modal-input text-xs bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20" value={l4} onChange={e => { setL4(e.target.value.toUpperCase()); setHasChanged(true); }} /></div>

                            </div>
                        </div>

                        {/* Section 2: Extended Info */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                <Info size={12} /> Extended Information
                            </h3>
                            <div className="p-3 bg-subtle rounded-xl border border-border-default grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-1">
                                    <label className="block text-[9px] font-black uppercase text-text-secondary mb-1.5 flex items-center gap-1.5"><Building2 size={10} /> Brand</label>
                                    <input type="text" placeholder="e.g. Samsung, Nike" className="modal-input text-xs bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20" value={formData.brand || ''} onChange={e => { setFormData({ ...formData, brand: e.target.value }); setHasChanged(true); }} />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-[9px] font-black uppercase text-text-secondary mb-1.5">Unit (pc, sheet, length...)</label>
                                    <input type="text" placeholder="e.g. pc, roll" className="modal-input text-xs bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20" value={formData.unit || ''} onChange={e => { setFormData({ ...formData, unit: e.target.value }); setHasChanged(true); }} />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-[9px] font-black uppercase text-text-secondary mb-1.5">Description / Remarks</label>
                                    <input type="text" placeholder="Additional details..." className="modal-input text-xs bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20" value={formData.description || ''} onChange={e => { setFormData({ ...formData, description: e.target.value }); setHasChanged(true); }} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-[9px] font-black uppercase text-text-secondary mb-1.5 flex items-center gap-1.5"><Truck size={10} /> Preferred Supplier</label>
                                    <select
                                        className="modal-input text-xs bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20"
                                        value={formData.supplier_id || ''}
                                        onChange={e => { setFormData({ ...formData, supplier_id: e.target.value || null }); setHasChanged(true); }}
                                    >

                                        <option value="">No Preferred Supplier</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Financial & Stock */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                <DollarSign size={12} /> Financial & Inventory
                            </h3>
                            <div className="p-3 bg-subtle rounded-xl border border-border-default space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-amber-600 mb-1.5">WSP (Buying Price / Cost)</label>
                                        <div className="relative group">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">₱</span>
                                            <input type="number" step="0.01" className="w-full bg-surface border border-border-default rounded-xl pl-6 pr-16 py-2 text-xs font-data text-text-primary outline-none focus:ring-2 focus:ring-brand-red/20 transition-all" value={formData.buying_price ?? ''} onChange={e => { setFormData({ ...formData, buying_price: parseFloat(e.target.value) || 0 }); setHasChanged(true); }} onFocus={e => e.target.select()} />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded text-[9px] font-black pointer-events-none text-text-secondary border border-border-default">
                                                <Eye size={10} /> {encodePrice(formData.buying_price || 0)}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-brand-red mb-1.5">SRP (Selling Price)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">₱</span>
                                            <input type="number" step="0.01" className="w-full bg-surface border border-border-default rounded-xl pl-6 pr-3 py-2 text-xs font-data text-text-primary outline-none focus:ring-2 focus:ring-brand-red/20 transition-all" value={formData.selling_price ?? ''} onChange={e => { setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 }); setHasChanged(true); }} onFocus={e => e.target.select()} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="block text-[9px] font-bold uppercase text-text-secondary mb-1.5">Current Stock</label>
                                        <input type="number" min="0" required disabled={role !== 'owner' && isEditing} className="w-full bg-surface border border-border-default rounded-xl px-3 py-2 text-xs font-data text-text-primary focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all disabled:bg-muted disabled:text-text-muted" value={formData.stock_available} onChange={e => { setFormData({ ...formData, stock_available: parseInt(e.target.value) || 0 }); setHasChanged(true); }} onFocus={e => e.target.select()} />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold uppercase text-orange-600 mb-1.5">Alert Trigger (Low Stock at)</label>
                                        <input type="number" min="0" required className="w-full bg-surface border border-orange-200 rounded-xl px-3 py-2 text-xs font-data text-text-primary focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" value={formData.low_stock_threshold ?? ''} onChange={e => { setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 }); setHasChanged(true); }} onFocus={e => e.target.select()} />
                                    </div>
                                </div>

                                {!isEditing && (
                                    <div className="bg-brand-red/10 rounded-xl p-2 flex items-center gap-2 border border-brand-red/20">
                                        <Info size={14} className="text-brand-red" />
                                        <p className="text-[10px] text-text-primary">Initial stock count for new items.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="sticky bottom-0 left-0 right-0 bg-surface flex justify-end gap-3 p-4 border-t border-border-default">
                            <button type="button" onClick={handleSafeClose} className="px-5 py-2 border border-border-strong/20 text-text-secondary font-bold text-[10px] rounded-lg hover:bg-subtle transition-colors uppercase tracking-widest">Cancel</button>
                            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-brand-red text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-red hover:bg-brand-red-dark disabled:opacity-50 transition-all active:scale-95">
                                {isSaving ? 'SAVING...' : 'SAVE PRODUCT'}
                            </button>
                        </div>
                    </form>

                </div>
            </div>

            <CategoryRenameModal
                isOpen={renameState.isOpen}
                onClose={() => setRenameState({ ...renameState, isOpen: false })}
                onSuccess={() => window.location.reload()}
                currentName={renameState.currentName}
                level={renameState.level as 1 | 2 | 3}
            />
        </div>,
        document.body
    );
}
