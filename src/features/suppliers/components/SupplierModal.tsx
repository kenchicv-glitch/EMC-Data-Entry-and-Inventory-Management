import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Loader2 } from 'lucide-react';
import { useBranch } from '../../../shared/lib/BranchContext';
import type { Supplier, SupplierInsert } from '../../../shared/types';

const supplierSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    contact_person: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email('Invalid email').nullable().optional().or(z.literal('')),
    address: z.string().nullable().optional(),
    supplier_tin: z.string().nullable().optional(),
    supplier_vat_registered: z.boolean(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: SupplierInsert) => Promise<void>;
    supplier?: Supplier | null;
    isLoading?: boolean;
}

export default function SupplierModal({ isOpen, onClose, onSubmit, supplier, isLoading }: SupplierModalProps) {
    const { activeBranchId } = useBranch();
    const { register, handleSubmit, reset, watch, getValues, formState: { errors } } = useForm<SupplierFormData>({
        resolver: zodResolver(supplierSchema),
        defaultValues: {
            name: '',
            contact_person: '',
            phone: '',
            email: '',
            address: '',
            supplier_tin: '',
            supplier_vat_registered: false,
        }
    });

    const watchedVat = watch('supplier_vat_registered');

    useEffect(() => {
        if (supplier) {
            reset({
                name: supplier.name,
                contact_person: supplier.contact_person || '',
                phone: supplier.phone || '',
                email: supplier.email || '',
                address: supplier.address || '',
                supplier_tin: (supplier as any).supplier_tin || '',
                supplier_vat_registered: (supplier as any).supplier_vat_registered || false,
            });
        } else {
            reset({
                name: '',
                contact_person: '',
                phone: '',
                email: '',
                address: '',
                supplier_tin: '',
                supplier_vat_registered: false,
            });
        }
    }, [supplier, reset, isOpen]);

    const handleFormSubmit = (data: SupplierFormData) => {
        const formattedData: SupplierInsert = {
            name: data.name,
            contact_person: data.contact_person || null,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            branch_id: supplier?.branch_id || activeBranchId,
            ...({
                supplier_tin: data.supplier_tin || null,
                supplier_vat_registered: data.supplier_vat_registered,
            } as any)
        };
        onSubmit(formattedData);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 animate-fade-in">
            <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border-default flex flex-col animate-scale-up text-left">
                <div className="px-6 py-4 flex items-center justify-between bg-subtle/50">
                    <div>
                        <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">
                            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Supplier Details & Contact Information
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-2xl hover:bg-surface hover:shadow-lg transition-all text-slate-400 hover:text-brand-red active:scale-90">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto scrollbar-hide">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Supplier Name *</label>
                            <input
                                {...register('name')}
                                className={`w-full bg-subtle border ${errors.name ? 'border-red-200' : 'border-border-default'} rounded-xl px-4 py-2 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all placeholder:text-slate-300`}
                                placeholder="Universal Hardware Inc."
                            />
                            {errors.name && <p className="text-[9px] font-black text-brand-red uppercase tracking-wider ml-2">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contact Person</label>
                                <input
                                    {...register('contact_person')}
                                    className="w-full bg-subtle border border-border-default rounded-xl px-4 py-2 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all placeholder:text-slate-300"
                                    placeholder="Juan Dela Cruz"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone Number</label>
                                <input
                                    {...register('phone')}
                                    className="w-full bg-subtle border border-border-default rounded-xl px-4 py-2 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all placeholder:text-slate-300"
                                    placeholder="0917..."
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                            <input
                                {...register('email')}
                                className={`w-full bg-subtle border ${errors.email ? 'border-red-200' : 'border-border-default'} rounded-xl px-4 py-2 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all placeholder:text-slate-300`}
                                placeholder="vendor@example.com"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Tax Identification Number (TIN)</label>
                                <input
                                    {...register('supplier_tin')}
                                    className="w-full bg-subtle border-2 border-transparent rounded-2xl px-5 py-3.5 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red focus:shadow-[0_0_0_4px_rgba(238,62,62,0.1)] transition-all outline-none placeholder:text-slate-300"
                                    placeholder="000-000-000-000"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">VAT Registered?</label>
                                <div className="flex items-center h-[52px]">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const current = !watchedVat;
                                            reset({ ...getValues(), supplier_vat_registered: current });
                                        }}
                                        className={`w-full h-full rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-black text-[10px] tracking-widest ${watchedVat ? 'bg-brand-red text-white border-brand-red shadow-lg' : 'bg-subtle text-text-muted border-transparent hover:border-border-default'}`}
                                    >
                                        {watchedVat ? 'VAT REGISTERED' : 'NON-VAT'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Address</label>
                            <textarea
                                {...register('address')}
                                rows={2}
                                className="w-full bg-subtle border border-border-default rounded-xl px-4 py-2 text-sm font-bold text-text-primary focus:bg-surface focus:border-brand-red outline-none transition-all resize-none"
                                placeholder="Quezon City"
                            />
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
                                supplier ? 'UPDATE SUPPLIER' : 'SAVE SUPPLIER'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
