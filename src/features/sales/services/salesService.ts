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

    async createRefund(refunds: Omit<CustomerRefund, 'id' | 'products'>[]): Promise<CustomerRefund[]> {
        // 1. Insert the refund records
        const { data, error } = await supabase
            .from('customer_refunds')
            .insert(refunds)
            .select();

        if (error) throw error;

        // 2. Restore stock for each item and log
        if (data && data.length > 0) {
            for (const item of data) {
                const { data: product } = await supabase
                    .from('products')
                    .select('stock_available')
                    .eq('id', item.product_id)
                    .single();

                if (product) {
                    const previousStock = product.stock_available || 0;
                    const newStock = previousStock + item.quantity;

                    await supabase
                        .from('products')
                        .update({ stock_available: newStock })
                        .eq('id', item.product_id);

                    // Log adjustment
                    await supabase.from('inventory_adjustments').insert({
                        product_id: item.product_id,
                        previous_stock: previousStock,
                        actual_stock: newStock,
                        difference: item.quantity,
                        type: 'refund',
                        reason: `Customer Refund — Invoice #${item.invoice_number}`,
                        adjusted_by: item.user_id,
                        branch_id: item.branch_id
                    });
                }
            }
        }

        return data || [];
    },

    async create(sale: Omit<Sale, 'id' | 'products'>[]): Promise<Sale[]> {
        // 1. Insert the sales records
        const { data, error } = await supabase
            .from('sales')
            .insert(sale)
            .select();

        if (error) throw error;

        // 2. Update stock and log adjustments for each item
        if (data && data.length > 0) {
            for (const item of data) {
                // Fetch current stock
                const { data: product } = await supabase
                    .from('products')
                    .select('stock_available')
                    .eq('id', item.product_id)
                    .single();

                if (product) {
                    const previousStock = product.stock_available || 0;
                    const newStock = previousStock - item.quantity;

                    // Update product stock
                    await supabase
                        .from('products')
                        .update({ stock_available: newStock })
                        .eq('id', item.product_id);

                    // Log adjustment
                    await supabase.from('inventory_adjustments').insert({
                        product_id: item.product_id,
                        previous_stock: previousStock,
                        actual_stock: newStock,
                        difference: -item.quantity,
                        type: 'sale',
                        reason: `Sale created — Invoice #${item.invoice_number}`,
                        adjusted_by: item.user_id,
                        branch_id: item.branch_id
                    });
                }
            }
        }

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
            .select('product_id, quantity, invoice_number, user_id, branch_id')
            .eq('invoice_number', invoiceNumber);

        if (fetchError) throw fetchError;

        // 2. Restore stock for each product and log
        if (saleItems && saleItems.length > 0) {
            for (const item of saleItems) {
                const { data: product } = await supabase
                    .from('products')
                    .select('stock_available')
                    .eq('id', item.product_id)
                    .single();

                if (product) {
                    const previousStock = product.stock_available || 0;
                    const newStock = previousStock + item.quantity;

                    await supabase
                        .from('products')
                        .update({ stock_available: newStock })
                        .eq('id', item.product_id);

                    // Log adjustment
                    await supabase.from('inventory_adjustments').insert({
                        product_id: item.product_id,
                        previous_stock: previousStock,
                        actual_stock: newStock,
                        difference: item.quantity,
                        type: 'sale_void',
                        reason: `Sale deleted/voided — Invoice #${item.invoice_number}`,
                        adjusted_by: item.user_id,
                        branch_id: item.branch_id
                    });
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
