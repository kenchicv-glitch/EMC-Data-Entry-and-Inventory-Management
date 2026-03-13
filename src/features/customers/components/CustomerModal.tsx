import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Loader2, CreditCard, User, Phone, Mail, MapPin } from 'lucide-react';
import type { Customer, CustomerInsert } from '../../../shared/types';

const customerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().nullable().optional(),
    email: z.string().email('Invalid email').nullable().optional().or(z.literal('')),
    address: z.string().nullable().optional(),
    credit_limit: z.number().min(0, 'Must be positive'),
    is_active: z.boolean(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CustomerInsert) => Promise<void>;
    customer?: Customer | null;
    isLoading?: boolean;
}

export default function CustomerModal({ isOpen, onClose, onSubmit, customer, isLoading }: CustomerModalProps) {
    const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            address: '',
            credit_limit: 0,
            is_active: true,
        }
    });

    useEffect(() => {
        if (customer) {
            reset({
                name: customer.name,
                phone: customer.phone || '',
                email: customer.email || '',
                address: customer.address || '',
                credit_limit: customer.credit_limit,
                is_active: customer.is_active,
            });
        } else {
            reset({
                name: '',
                phone: '',
                email: '',
                address: '',
                credit_limit: 0,
                is_active: true,
            });
        }
    }, [customer, reset, isOpen]);

    const handleFormSubmit = (data: CustomerFormData) => {
        const formattedData: CustomerInsert = {
            name: data.name,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            credit_limit: data.credit_limit,
            is_active: data.is_active,
        };
        onSubmit(formattedData);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 animate-fade-in">
            <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border-default flex flex-col animate-scale-up text-left">
                <div className="px-6 py-4 flex items-center justify-between bg-subtle/50">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center">
                            <User className="text-brand-red" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">
                                {customer ? 'Edit Customer' : 'Add New Customer'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                Profile & Credit Configuration
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-2xl hover:bg-surface hover:shadow-lg transition-all text-slate-400 hover:text-brand-red active:scale-90">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto scrollbar-hide">
                    <div className="grid grid-cols-1 gap-5">
                        {/* Name */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <User size={12} /> Name *
                            </label>
                            <input
                                {...register('name')}
                                className={`w-full bg-subtle border ${errors.name ? 'border-red-200' : 'border-border-default'} rounded-xl px-4 py-2.5 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all placeholder:text-slate-300`}
                                placeholder="Distribution Name"
                            />
                            {errors.name && <p className="text-[9px] font-black text-brand-red uppercase tracking-wider ml-2">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Phone size={12} /> Phone
                                </label>
                                <input
                                    {...register('phone')}
                                    className="w-full bg-subtle border border-border-default rounded-xl px-4 py-2.5 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all"
                                    placeholder="0918-765-4321"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <CreditCard size={12} /> Credit Limit
                                </label>
                                <input
                                    type="number"
                                    {...register('credit_limit', { valueAsNumber: true })}
                                    className={`w-full bg-subtle border ${errors.credit_limit ? 'border-red-200' : 'border-border-default'} rounded-xl px-4 py-2.5 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all`}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Mail size={12} /> Email
                            </label>
                            <input
                                {...register('email')}
                                className={`w-full bg-subtle border ${errors.email ? 'border-red-200' : 'border-border-default'} rounded-xl px-4 py-2.5 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all`}
                                placeholder="client@example.com"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <MapPin size={12} /> Address
                            </label>
                            <textarea
                                {...register('address')}
                                rows={2}
                                className="w-full bg-subtle border border-border-default rounded-xl px-4 py-2 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all resize-none"
                                placeholder="Pasig City"
                            />
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <input
                                type="checkbox"
                                {...register('is_active')}
                                id="is_active"
                                className="w-5 h-5 rounded-lg accent-brand-red cursor-pointer"
                            />
                            <label htmlFor="is_active" className="text-xs font-black text-brand-charcoal uppercase tracking-widest cursor-pointer select-none">
                                Account Active and Eligible for Terms
                            </label>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-brand-charcoal text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    PROCESSING...
                                </>
                            ) : (
                                customer ? 'UPDATE CUSTOMER' : 'SAVE CUSTOMER'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
