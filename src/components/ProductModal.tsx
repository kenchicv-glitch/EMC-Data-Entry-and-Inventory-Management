import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Package, AlertTriangle } from 'lucide-react';
import CategoryRenameModal from './CategoryRenameModal';

interface Product {
    id?: string;
    sku: string;
    name: string;
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
    category?: string;
}

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    product?: Product | null;
    role: 'admin' | 'encoder' | null;
    initialData?: { l1?: string; l2?: string; l3?: string };
}

export default function ProductModal(props: ProductModalProps) {
    const { isOpen, onClose, onSuccess, product, role } = props;
    const [formData, setFormData] = useState<Product>({
        sku: '', name: '', stock_available: 0, stock_reserved: 0, stock_damaged: 0,
    });
    const [l1Choices, setL1Choices] = useState<string[]>([]);
    const [l2Choices, setL2Choices] = useState<string[]>([]);
    const [l3Choices, setL3Choices] = useState<string[]>([]);

    const [l1, setL1] = useState('');
    const [l2, setL2] = useState('');
    const [l3, setL3] = useState('');
    const [l4, setL4] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [renameState, setRenameState] = useState<{ isOpen: boolean; currentName: string; level: 1 | 2 | 3 | null }>({
        isOpen: false,
        currentName: '',
        level: null
    });

    useEffect(() => {
        const fetchChoices = async () => {
            const { data } = await supabase.from('products').select('name');
            if (data) {
                const l1s = new Set<string>();
                const l2s = new Set<string>();
                const l3s = new Set<string>();
                data.forEach(p => {
                    const parts = p.name.split(' > ');
                    if (parts.length >= 1) l1s.add(parts[0]);
                    if (parts.length >= 2) l2s.add(parts[1]);
                    if (parts.length >= 3) l3s.add(parts[2]);
                    if (p.name.includes(' - ') && !p.name.includes(' > ')) {
                        const legacyParts = p.name.split(' - ');
                        l2s.add(legacyParts[0]);
                    }
                });
                setL1Choices(Array.from(l1s).filter(Boolean).sort());
                setL2Choices(Array.from(l2s).filter(Boolean).sort());
                setL3Choices(Array.from(l3s).filter(Boolean).sort());
            }
        };
        if (isOpen) fetchChoices();

        if (product) {
            setFormData(product);
            const name = product.name;
            if (name.includes(' > ')) {
                const parts = name.split(' > ');
                setL1(parts[0] || '');
                setL2(parts[1] || '');
                setL3(parts[2] || '');
                setL4(parts[3] || '');
            } else if (name.includes(' - ')) {
                const [cat, type] = name.split(' - ');
                setL1('UNCATEGORIZED');
                setL2(cat);
                setL3('');
                setL4(type);
            } else {
                setL1('UNCATEGORIZED');
                setL2('');
                setL3('');
                setL4(name);
            }
        } else {
            setFormData({ sku: '', name: '', stock_available: 0, stock_reserved: 0, stock_damaged: 0 });
            setL1(props.initialData?.l1 || '');
            setL2(props.initialData?.l2 || '');
            setL3(props.initialData?.l3 || '');
            setL4('');
        }
        setError(null);
    }, [product, isOpen, props.initialData]);

    if (!isOpen) return null;
    const isEditing = !!product;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const parts = [l1.trim(), l2.trim(), l3.trim(), l4.trim()].filter(p => p !== '');
            const finalName = parts.join(' > ');
            if (!finalName) throw new Error('Product name cannot be empty');

            const payload = {
                sku: formData.sku.trim().toUpperCase(),
                name: finalName,
                stock_available: formData.stock_available,
                stock_reserved: formData.stock_reserved,
                stock_damaged: formData.stock_damaged,
            };

            if (isEditing && product?.id) {
                const { error } = await supabase.from('products').update(payload).eq('id', product.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('products').insert([payload]);
                if (error) throw error;
            }
            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-slide-up flex flex-col max-h-[95vh]">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center"><Package size={16} /></div>
                        <h2 className="text-base font-bold">{isEditing ? 'Edit Product' : 'New Product'}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="p-6 overflow-y-auto scrollbar-hide">
                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between mb-1.5"><label className="text-[9px] font-black uppercase text-slate-500">Master Category</label>{l1 && <button type="button" onClick={() => setRenameState({ isOpen: true, currentName: l1, level: 1 })} className="text-[8px] font-bold text-amber-600 hover:underline">RENAME</button>}</div>
                                    <input type="text" list="l1-options" required className="modal-input text-xs" value={l1} onChange={e => setL1(e.target.value.toUpperCase())} />
                                    <datalist id="l1-options">{l1Choices.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1.5"><label className="text-[9px] font-black uppercase text-slate-500">Category</label>{l2 && <button type="button" onClick={() => setRenameState({ isOpen: true, currentName: l2, level: 2 })} className="text-[8px] font-bold text-amber-600 hover:underline">RENAME</button>}</div>
                                    <input type="text" list="l2-options" required className="modal-input text-xs" value={l2} onChange={e => setL2(e.target.value.toUpperCase())} />
                                    <datalist id="l2-options">{l2Choices.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1.5"><label className="text-[9px] font-black uppercase text-slate-500">Subcategory</label>{l3 && <button type="button" onClick={() => setRenameState({ isOpen: true, currentName: l3, level: 3 })} className="text-[8px] font-bold text-amber-600 hover:underline">RENAME</button>}</div>
                                    <input type="text" list="l3-options" className="modal-input text-xs" value={l3} onChange={e => setL3(e.target.value.toUpperCase())} />
                                    <datalist id="l3-options">{l3Choices.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                                <div><label className="block text-[9px] font-black uppercase text-slate-500 mb-1.5">Size/Details</label><input type="text" required className="modal-input text-xs" value={l4} onChange={e => setL4(e.target.value.toUpperCase())} /></div>
                                <div className="md:col-span-2"><label className="block text-[9px] font-black uppercase text-slate-500 mb-1.5">SKU</label><input type="text" required className="modal-input font-data text-xs" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} /></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Stock</label><input type="number" min="0" required disabled={role !== 'admin' && isEditing} className="w-full bg-white border rounded-xl px-3 py-2 text-sm font-data" value={formData.stock_available} onChange={e => setFormData({ ...formData, stock_available: parseInt(e.target.value) || 0 })} /></div>
                            {isEditing && (
                                <>
                                    <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Reserved</label><input type="number" min="0" disabled={role !== 'admin'} className="w-full bg-white border rounded-xl px-3 py-2 text-sm font-data" value={formData.stock_reserved} onChange={e => setFormData({ ...formData, stock_reserved: parseInt(e.target.value) || 0 })} /></div>
                                    <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Damaged</label><input type="number" min="0" disabled={role !== 'admin'} className="w-full bg-white border rounded-xl px-3 py-2 text-sm font-data" value={formData.stock_damaged} onChange={e => setFormData({ ...formData, stock_damaged: parseInt(e.target.value) || 0 })} /></div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
                            <button type="submit" disabled={loading} className="px-6 py-2 bg-brand-red text-white text-sm font-bold rounded-xl shadow-red hover:bg-brand-red-dark disabled:opacity-50">{loading ? 'SAVING...' : 'SAVE PRODUCT'}</button>
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
        </div>
    );
}
