import { supabase } from '../../../shared/lib/supabase';
import type { Purchase, SupplierReturn } from '../../../shared/types';

export const purchaseService = {
    async getAll(branchId?: string | null, startDate?: string): Promise<Purchase[]> {
        let query = supabase
            .from('purchases')
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, supplier, status, payment_status, purchase_type, date, received_date, payment_date, invoice_number, supplier_id, user_id, branch_id, products(name)')
            .order('date', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        if (startDate) {
            query = query.gte('date', startDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(p => ({
            ...p,
            products: Array.isArray(p.products) ? p.products[0] : p.products
        })) as Purchase[];
    },

    async getReturns(branchId?: string | null): Promise<SupplierReturn[]> {
        let query = supabase
            .from('supplier_returns')
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, reason, date, invoice_number, branch_id, products(name)')
            .order('date', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
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
            .select('id, product_id, quantity, unit_price, total_price, vat_amount, discount_amount, is_discounted, supplier, status, payment_status, purchase_type, date, received_date, payment_date, invoice_number, supplier_id, user_id, branch_id');

        if (error) throw error;
        return data as unknown as Purchase[];
    },

    async updateByInvoice(invoiceNumber: string, purchase: Partial<Omit<Purchase, 'id' | 'invoice_number' | 'products'>>): Promise<void> {
        const { error } = await supabase
            .from('purchases')
            .update(purchase)
            .eq('invoice_number', invoiceNumber);

        if (error) throw error;
    },

    async deleteByInvoice(invoiceNumber: string): Promise<void> {
        // 1. Fetch items to reduce stock
        const { data: purchaseItems, error: fetchError } = await supabase
            .from('purchases')
            .select('product_id, quantity')
            .eq('invoice_number', invoiceNumber);

        if (fetchError) throw fetchError;

        // 2. Reduce stock for each product
        if (purchaseItems && purchaseItems.length > 0) {
            for (const item of purchaseItems) {
                const { data: product } = await supabase
                    .from('products')
                    .select('stock_available')
                    .eq('id', item.product_id)
                    .single();

                if (product) {
                    await supabase
                        .from('products')
                        .update({ stock_available: (product.stock_available || 0) - item.quantity })
                        .eq('id', item.product_id);
                }
            }
        }

        // 3. Delete the purchases
        const { error } = await supabase
            .from('purchases')
            .delete()
            .eq('invoice_number', invoiceNumber);

        if (error) throw error;
    }
};
