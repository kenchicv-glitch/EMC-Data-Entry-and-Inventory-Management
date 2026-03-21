import { supabase } from '../../../shared/lib/supabase';
import type { Product } from '../../../shared/types';
import { startOfDay } from 'date-fns';
import type { RawProductData } from '../../../shared/lib/ExcelImportService';
import { inferUnitFromName } from '../../../shared/lib/unitUtils';

export const productService = {
    async getAll(branchId?: string | null): Promise<Product[]> {
        let query = supabase
            .from('products')
            .select('*')
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    async getById(id: string): Promise<Product | null> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Product | null;
    },

    async create(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
        const { data, error } = await supabase
            .from('products')
            .insert(product)
            .select()
            .single();

        if (error) throw error;
        return data as Product;
    },

    async update(id: string, product: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<Product> {
        const { data, error } = await supabase
            .from('products')
            .update(product)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Product;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async bulkDelete(branchId: string | null, pattern: string): Promise<void> {
        let query = supabase.from('products').delete();
        if (branchId) query = query.eq('branch_id', branchId);
        
        const { error } = await query.ilike('name', pattern);
        if (error) throw error;
    },

    async importProducts(activeBranchId: string | null, productsToUpsert: RawProductData[]) {
        if (productsToUpsert.length === 0) return { updates: 0, inserts: 0 };

        // Fetch current products for this branch to check for existing names
        let existingQuery = supabase.from('products').select('id, name, stock_available');
        if (activeBranchId) {
            existingQuery = existingQuery.eq('branch_id', activeBranchId);
        }
        const { data: existingProducts, error: fetchError } = await existingQuery;
        if (fetchError) throw fetchError;

        const existingMap = new Map();
        (existingProducts || []).forEach(p => {
            const upperName = p.name.toUpperCase();
            if (existingMap.has(upperName)) {
                existingMap.get(upperName).stock += (p.stock_available || 0);
            } else {
                existingMap.set(upperName, { id: p.id, stock: p.stock_available || 0 });
            }
        });

        const consolidateUpload = new Map<string, RawProductData>();
        productsToUpsert.forEach(item => {
            const name = item.name.toUpperCase();
            if (consolidateUpload.has(name)) {
                const existing = consolidateUpload.get(name)!;
                existing.stock_available += (item.stock_available || 0);
            } else {
                consolidateUpload.set(name, { ...item, name });
            }
        });

        const updates = [];
        const inserts = [];

        for (const [name, item] of consolidateUpload) {
            if (existingMap.has(name)) {
                const match = existingMap.get(name);
                const currentStock = match.stock || 0;
                const finalStock = currentStock < 100 ? 100 : currentStock;
                
                updates.push({
                    id: match.id,
                    ...item,
                    sku: item.sku || name,
                    stock_available: finalStock
                });
            } else {
                inserts.push({
                    ...item,
                    sku: item.sku || name,
                    stock_available: 100,
                    branch_id: activeBranchId
                });
            }
        }

        if (updates.length > 0) {
            const { error: updateError } = await supabase.from('products').upsert(updates, { onConflict: 'id' });
            if (updateError) throw updateError;
        }

        if (inserts.length > 0) {
            const { error: insertError } = await supabase.from('products').insert(inserts);
            if (insertError) throw insertError;
        }

        return { updates: updates.length, inserts: inserts.length };
    },

    async getMovements(activeBranchId: string | null) {
        const todayStart = startOfDay(new Date()).toISOString();
        
        let salesQuery = supabase.from('sales').select('product_id, quantity').gte('date', todayStart);
        let purchasesQuery = supabase.from('purchases').select('product_id, quantity').gte('date', todayStart).eq('status', 'received');
        let refundsQuery = supabase.from('customer_refunds').select('product_id, quantity').gte('date', todayStart);

        if (activeBranchId) {
            salesQuery = salesQuery.eq('branch_id', activeBranchId);
            purchasesQuery = purchasesQuery.eq('branch_id', activeBranchId);
            refundsQuery = refundsQuery.eq('branch_id', activeBranchId);
        }

        const [salesRes, purchasesRes, refundsRes] = await Promise.all([
            salesQuery,
            purchasesQuery,
            refundsQuery
        ]);

        const movMap: Record<string, { sales: number, purchases: number, refunds: number }> = {};

        salesRes.data?.forEach(s => {
            const key = s.product_id;
            movMap[key] = { ...movMap[key] || { sales: 0, purchases: 0, refunds: 0 }, sales: (movMap[key]?.sales || 0) + s.quantity };
        });
        purchasesRes.data?.forEach(p => {
            const key = p.product_id;
            movMap[key] = { ...movMap[key] || { sales: 0, purchases: 0, refunds: 0 }, purchases: (movMap[key]?.purchases || 0) + p.quantity };
        });
        refundsRes.data?.forEach(r => {
            const key = r.product_id;
            movMap[key] = { ...movMap[key] || { sales: 0, purchases: 0, refunds: 0 }, refunds: (movMap[key]?.refunds || 0) + r.quantity };
        });

        return movMap;
    },

    async getCategoryChoices(branchId: string | null): Promise<{ l1s: string[], l2s: string[], l3s: string[] }> {
        let query = supabase.from('products').select('name');
        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        const { data } = await query;
        if (!data) return { l1s: [], l2s: [], l3s: [], };

        const l1s = new Set<string>();
        const l2s = new Set<string>();
        const l3s = new Set<string>();
        
        data.forEach(p => {
            const parts = p.name.split(' > ');
            if (parts.length >= 1) l1s.add(parts[0]);
            if (parts.length >= 2) l2s.add(parts[1]);
            if (parts.length >= 3) l3s.add(parts[2]);
            if (p.name.includes(' - ') && !p.name.includes(' > ')) {
                const legacyParts = p.name.split(' - ');
                l2s.add(legacyParts[0]);
            }
        });

        return {
            l1s: Array.from(l1s).filter(Boolean).sort(),
            l2s: Array.from(l2s).filter(Boolean).sort(),
            l3s: Array.from(l3s).filter(Boolean).sort(),
        };
    },

    async renameCategory(branchId: string | null, currentName: string, newName: string, level: 1 | 2 | 3): Promise<void> {
        let query = supabase.from('products').select('id, name');
        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        const { data: products, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        const updates = products?.filter(p => {
            const parts = p.name.split(' > ');
            return parts[level - 1] === currentName;
        }).map(p => {
            const parts = p.name.split(' > ');
            parts[level - 1] = newName.toUpperCase();
            return { id: p.id, name: parts.join(' > ') };
        }) || [];

        if (updates.length > 0) {
            const { error: updateError } = await supabase.from('products').upsert(updates);
            if (updateError) throw updateError;
        }
    },

    async standardizeUnits(): Promise<number> {
        // Paginate to get ALL products (Supabase defaults to 1000 rows)
        let allProducts: { id: string; name: string; unit: string }[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, unit')
                .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allProducts = allProducts.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
        }

        let updated = 0;
        for (const p of allProducts) {
            const inferred = inferUnitFromName(p.name);
            if (inferred !== (p.unit || '').toLowerCase()) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ unit: inferred })
                    .eq('id', p.id);
                if (!updateError) updated++;
            }
        }

        return updated;
    }
};
