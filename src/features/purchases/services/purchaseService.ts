import { supabase } from '../../../shared/lib/supabase';
import type { Purchase, SupplierReturn } from '../../../shared/types';

export const purchaseService = {
    async getAll(): Promise<Purchase[]> {
        const { data, error } = await supabase
            .from('purchases')
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, supplier, status, payment_status, purchase_type, date, received_date, payment_date, invoice_number, supplier_id, user_id, products(name)')
            .order('date', { ascending: false });

        if (error) throw error;
        return (data || []).map(p => ({
            ...p,
            products: Array.isArray(p.products) ? p.products[0] : p.products
        })) as Purchase[];
    },

    async getReturns(): Promise<SupplierReturn[]> {
        const { data, error } = await supabase
            .from('supplier_returns')
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, reason, date, invoice_number, products(name)')
            .order('date', { ascending: false });

        if (error) throw error;
        return (data || []).map(r => ({
            ...r,
            products: Array.isArray(r.products) ? r.products[0] : r.products
        })) as SupplierReturn[];
    },

    async create(purchase: Omit<Purchase, 'id' | 'products'>[]): Promise<Purchase[]> {
        const { data, error } = await supabase
            .from('purchases')
            .insert(purchase)
            .select();

        if (error) throw error;
        return data || [];
    },

    async updateByInvoice(invoiceNumber: string, purchase: Partial<Omit<Purchase, 'id' | 'invoice_number' | 'products'>>): Promise<void> {
        const { error } = await supabase
            .from('purchases')
            .update(purchase)
            .eq('invoice_number', invoiceNumber);

        if (error) throw error;
    },

    async deleteByInvoice(invoiceNumber: string): Promise<void> {
        const { error } = await supabase
            .from('purchases')
            .delete()
            .eq('invoice_number', invoiceNumber);

        if (error) throw error;
    }
};
