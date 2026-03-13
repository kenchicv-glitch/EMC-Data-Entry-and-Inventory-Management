import { supabase } from '../../../shared/lib/supabase';
import type { Product } from '../../../shared/types';

export const productService = {
    async getAll(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('id, sku, name, description, brand, stock_available, stock_reserved, stock_damaged, selling_price, buying_price, supplier_selling_price, low_stock_threshold, supplier_id, created_at')
            .order('name');

        if (error) throw error;
        return data || [];
    },

    async getById(id: string): Promise<Product | null> {
        const { data, error } = await supabase
            .from('products')
            .select('id, sku, name, description, brand, stock_available, stock_reserved, stock_damaged, selling_price, buying_price, supplier_selling_price, low_stock_threshold, supplier_id, created_at')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async create(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
        const { data, error } = await supabase
            .from('products')
            .insert(product)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, product: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<Product> {
        const { data, error } = await supabase
            .from('products')
            .update(product)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
