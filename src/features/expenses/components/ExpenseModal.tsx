import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { X, Wallet, AlertTriangle } from 'lucide-react';
import { useBranch } from '../../../shared/lib/BranchContext';

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newExpense?: unknown) => void;
    expense?: any; // Add optional expense for editing
}

const CATEGORIES = ['Salary', 'Utilities', 'Rent', 'Transportation', 'Supplies', 'Maintenance', 'Donation', 'Others'] as const;

export default function ExpenseModal({ isOpen, onClose, onSuccess, expense }: ExpenseModalProps) {
    const { activeBranchId } = useBranch();
    const [category, setCategory] = useState<typeof CATEGORIES[number]>('Salary');
    const [customCategory, setCustomCategory] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                (document.getElementById('expense-form') as HTMLFormElement)?.requestSubmit();
            }

            if (e.altKey) {
                if (e.key === '1') setCategory('Salary');
                if (e.key === '2') setCategory('Donation');
                if (e.key === '3') setCategory('Others');
            }
        };

        if (isOpen) {
            if (expense) {
                // Editing mode
                if (CATEGORIES.includes(expense.category)) {
                    setCategory(expense.category);
                } else {
                    setCategory('Others');
                    setCustomCategory(expense.category);
                }
                setDescription(expense.description || '');
                setAmount(expense.amount || 0);
            } else {
                // Create mode
                setCategory('Salary');
                setCustomCategory('');
                setDescription('');
                setAmount(0);
            }
            setError(null);
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

            const payload = {
                category: finalCategory,
                description,
                amount,
                user_id: user?.id,
                branch_id: activeBranchId
            };

            let result;
            if (expense?.id) {
                // Update existing
                result = await supabase
                    .from('expenses')
                    .update(payload)
                    .eq('id', expense.id)
                    .select();
            } else {
                // Insert new
                result = await supabase
                    .from('expenses')
                    .insert([payload])
                    .select();
            }

            const { data, error: dbError } = result;

            if (dbError) throw dbError;

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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-surface shadow-2xl border border-border-default flex flex-col animate-slide-up text-left">
                <div className="flex items-center justify-between px-6 py-3 bg-text-primary">
                    <div className="flex items-center gap-3 text-text-inverse">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center"><Wallet size={16} /></div>
                        <h2 className="text-base font-black uppercase tracking-tight">{expense ? 'Edit Expense' : 'Log Expense'}</h2>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-text-inverse transition-colors"><X size={18} /></button>
                </div>

                <div className="p-6">
                    {error && <div className="mb-4 p-3 bg-danger-subtle border border-danger text-brand-red text-xs rounded-xl flex items-center gap-2 font-bold"><AlertTriangle size={16} /> {error}</div>}
                    <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-text-muted uppercase tracking-widest mb-3">Category</label>
                            <div className="grid grid-cols-4 gap-2 mb-3">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategory(cat)}
                                        className={`py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all ${category === cat ? 'bg-brand-red text-text-inverse border-brand-red shadow-lg' : 'bg-surface text-text-secondary border-border-strong hover:border-brand-red'}`}
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
                            <label className="block text-xs font-black text-text-muted uppercase tracking-widest mb-1.5 font-bold">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="modal-input min-h-[80px] py-3 pl-4 font-medium"
                                    placeholder="Details..."
                                />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-text-muted uppercase tracking-widest mb-1.5 font-bold">Total Amount</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-black text-lg">₱</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={amount}
                                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                    onFocus={e => e.target.select()}
                                    className="modal-input pl-10 font-data text-xl text-brand-red font-black h-12"
                                    required
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 bg-bg-subtle border-t border-border-muted flex items-center justify-between rounded-b-2xl">
                    <button type="button" onClick={onClose} className="text-[10px] font-black text-text-muted hover:text-text-primary transition-colors uppercase tracking-widest">Cancel</button>
                    <button
                        type="submit"
                        form="expense-form"
                        disabled={loading}
                        className="px-8 py-3 bg-brand-red text-white rounded-xl font-black text-[10px] shadow-red hover:bg-brand-red-dark transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                    >
                        {loading ? 'SAVING...' : (expense ? 'UPDATE EXPENSE' : 'RECORD EXPENSE')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
