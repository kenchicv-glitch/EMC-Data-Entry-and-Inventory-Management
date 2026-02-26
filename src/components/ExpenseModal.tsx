import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Wallet, AlertTriangle } from 'lucide-react';

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newExpense?: unknown) => void;
}

const CATEGORIES = ['Salary', 'Donation', 'Others'] as const;

export default function ExpenseModal({ isOpen, onClose, onSuccess }: ExpenseModalProps) {
    const [category, setCategory] = useState<typeof CATEGORIES[number]>('Salary');
    const [customCategory, setCustomCategory] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setCategory('Salary');
            setCustomCategory('');
            setDescription('');
            setAmount(0);
            setError(null);
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        if (category === 'Others' && !customCategory.trim()) {
            setError('Please specify the category');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const finalCategory = category === 'Others' ? customCategory : category;

            const { data, error: insertError } = await supabase
                .from('expenses')
                .insert([{
                    category: finalCategory,
                    description,
                    amount,
                    user_id: user?.id
                }])
                .select();

            if (insertError) throw insertError;

            setTimeout(() => {
                onSuccess(data?.[0]);
                onClose();
            }, 500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border flex flex-col animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center"><Wallet size={16} /></div>
                        <h2 className="text-base font-black uppercase tracking-tight">Log Expense</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="p-8">
                    {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2 font-bold"><AlertTriangle size={16} /> {error}</div>}
                    <form id="expense-form" onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Category</label>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategory(cat)}
                                        className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${category === cat ? 'bg-brand-red text-white border-brand-red shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {category === 'Others' && (
                                <div className="animate-slide-up">
                                    <input
                                        type="text"
                                        value={customCategory}
                                        onChange={e => setCustomCategory(e.target.value)}
                                        className="modal-input pl-4 font-bold border-brand-red/50"
                                        placeholder="Specify other expense type..."
                                        required
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="modal-input min-h-[100px] py-4 pl-4 font-medium"
                                placeholder="Describe the expense details..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Total Amount</label>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">₱</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={amount}
                                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                    className="modal-input pl-12 font-data text-2xl text-brand-red font-black h-16"
                                    required
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t flex items-center justify-between rounded-b-2xl">
                    <button type="button" onClick={onClose} className="text-sm font-black text-slate-500 hover:text-brand-charcoal transition-colors uppercase tracking-widest">Cancel</button>
                    <button
                        type="submit"
                        form="expense-form"
                        disabled={loading}
                        className="px-10 py-4 bg-brand-charcoal text-white rounded-2xl font-black text-sm shadow-2xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'RECORD EXPENSE'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
