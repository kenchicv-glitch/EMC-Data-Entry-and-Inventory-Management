import { supabase } from '../../../shared/lib/supabase';
import type { Sale, CustomerRefund } from '../../../shared/types';

export const salesService = {
    async getAll(): Promise<Sale[]> {
        const { data, error } = await supabase
            .from('sales')
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, cost_price, delivery_fee, date, invoice_number, user_id, customer_name, customer_id, fulfillment_status, payment_mode, is_os, edited_at, products(name, brand)')
            .order('date', { ascending: false });

        if (error) throw error;
        return (data || []).map(s => ({
            ...s,
            products: Array.isArray(s.products) ? s.products[0] : s.products
        })) as Sale[];
    },

    async getRefunds(): Promise<CustomerRefund[]> {
        const { data, error } = await supabase
            .from('customer_refunds')
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, reason, date, invoice_number, user_id, products(name)')
            .order('date', { ascending: false });

        if (error) throw error;
        return (data || []).map(r => ({
            ...r,
            products: Array.isArray(r.products) ? r.products[0] : r.products
        })) as CustomerRefund[];
    },

    async create(sale: Omit<Sale, 'id' | 'products'>[]): Promise<Sale[]> {
        const { data, error } = await supabase
            .from('sales')
            .insert(sale)
            .select();

        if (error) throw error;
        return data || [];
    },

    async updateByInvoice(invoiceNumber: string, sale: Partial<Omit<Sale, 'id' | 'invoice_number' | 'products'>>): Promise<void> {
        const { error } = await supabase
            .from('sales')
            .update(sale)
            .eq('invoice_number', invoiceNumber);

        if (error) throw error;
    },

    async deleteByInvoice(invoiceNumber: string): Promise<void> {
        const { error } = await supabase
            .from('sales')
            .delete()
            .eq('invoice_number', invoiceNumber);

        if (error) throw error;
    }
};
