import { supabase } from '../../../shared/lib/supabase';
import type { Sale, CustomerRefund } from '../../../shared/types';

export const salesService = {
    async getAll(branchId?: string | null, startDate?: string): Promise<Sale[]> {
        let query = supabase
            .from('sales')
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, cost_price, delivery_fee, date, invoice_number, user_id, customer_name, customer_id, fulfillment_status, payment_mode, is_os, edited_at, invoice_type, or_number, products(name, brand)')
            .order('date', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        if (startDate) {
            query = query.gte('date', startDate);
        }

        const { data, error } = await query;

        if (error) throw error;
        return (data || []).map(s => ({
            ...s,
            products: Array.isArray(s.products) ? s.products[0] : s.products
        })) as Sale[];
    },

    async getRefunds(branchId?: string | null): Promise<CustomerRefund[]> {
        let query = supabase
            .from('customer_refunds')
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, reason, date, invoice_number, user_id, products(name)')
            .order('date', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

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
        // 1. Fetch items to restore stock
        const { data: saleItems, error: fetchError } = await supabase
            .from('sales')
            .select('product_id, quantity')
            .eq('invoice_number', invoiceNumber);

        if (fetchError) throw fetchError;

        // 2. Restore stock for each product
        if (saleItems && saleItems.length > 0) {
            for (const item of saleItems) {
                const { data: product } = await supabase
                    .from('products')
                    .select('stock_available')
                    .eq('id', item.product_id)
                    .single();

                if (product) {
                    await supabase
                        .from('products')
                        .update({ stock_available: (product.stock_available || 0) + item.quantity })
                        .eq('id', item.product_id);
                }
            }
        }

        // 3. Delete the sales
        const { error } = await supabase
            .from('sales')
            .delete()
            .eq('invoice_number', invoiceNumber);

        if (error) throw error;
    }
};
