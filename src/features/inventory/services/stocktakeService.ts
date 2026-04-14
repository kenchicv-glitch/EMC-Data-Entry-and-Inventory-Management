import { supabase } from '../../../shared/lib/supabase';
import type { StocktakeSession, StocktakeItem } from '../types/product';

export async function createStocktake(
    branchId: string,
    userId: string,
    notes?: string
): Promise<StocktakeSession> {
    // Snapshot current stock for all active products in branch
    const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, stock_available')
        .eq('branch_id', branchId)
        .eq('is_active', true);
    if (pErr) throw pErr;

    const { data: session, error: sErr } = await supabase
        .from('inv_stocktakes')
        .insert({
            branch_id: branchId,
            started_by: userId,
            started_at: new Date().toISOString(),
            notes: notes ?? null,
            status: 'in_progress',
        })
        .select()
        .single();
    if (sErr) throw sErr;

    const items = (products ?? []).map(p => ({
        stocktake_id: session.id,
        product_id: p.id,
        system_qty: p.stock_available ?? 0,
        counted_qty: null,
    }));

    if (items.length > 0) {
        const { error: iErr } = await supabase.from('inv_stocktake_items').insert(items);
        if (iErr) throw iErr;
    }

    return session;
}

export async function getStocktakeSessions(branchId: string): Promise<StocktakeSession[]> {
    const { data, error } = await supabase
        .from('inv_stocktakes')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function getStocktakeItems(stocktakeId: string): Promise<StocktakeItem[]> {
    const { data, error } = await supabase
        .from('inv_stocktake_items')
        .select(`
            *,
            product:products(id, sku, name, unit, category_id, location_id)
        `)
        .eq('stocktake_id', stocktakeId);
    if (error) throw error;

    // Sort by product name client-side (avoids Supabase embedded sort limitation)
    return (data ?? []).sort((a, b) =>
        (a.product?.name ?? '').localeCompare(b.product?.name ?? '')
    );
}

export async function updateStocktakeItemCount(
    itemId: string,
    countedQty: number,
    countedBy: string
): Promise<void> {
    const { error } = await supabase
        .from('inv_stocktake_items')
        .update({
            counted_qty: countedQty,
            counted_at: new Date().toISOString(),
            counted_by: countedBy,
        })
        .eq('id', itemId);
    if (error) throw error;
}

export async function completeStocktake(
    sessionId: string,
    userId: string,
    applyAdjustments: boolean
): Promise<void> {
    if (applyAdjustments) {
        const { data: items } = await supabase
            .from('inv_stocktake_items')
            .select('product_id, system_qty, counted_qty, variance')
            .eq('stocktake_id', sessionId)
            .not('counted_qty', 'is', null)
            .neq('variance', 0);

        for (const item of items ?? []) {
            // Update stock on the product
            await supabase
                .from('products')
                .update({ stock_available: item.counted_qty })
                .eq('id', item.product_id);

            // Write audit trail to inventory_adjustments
            await supabase.from('inventory_adjustments').insert({
                product_id: item.product_id,
                previous_stock: item.system_qty,
                actual_stock: item.counted_qty,
                difference: item.variance,
                type: 'stocktake',
                reason: `Stocktake adjustment — session ${sessionId}`,
                adjusted_by: userId,
            });
        }
    }

    const { error } = await supabase
        .from('inv_stocktakes')
        .update({
            status: 'completed',
            completed_by: userId,
            completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    if (error) throw error;
}

export async function cancelStocktake(sessionId: string): Promise<void> {
    const { error } = await supabase
        .from('inv_stocktakes')
        .update({ status: 'cancelled' })
        .eq('id', sessionId);
    if (error) throw error;
}
