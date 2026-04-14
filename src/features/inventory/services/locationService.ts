import { supabase } from '../../../shared/lib/supabase';
import type { InventoryLocation } from '../types/product';

export async function getAllLocations(branchId?: string | null): Promise<InventoryLocation[]> {
    let query = supabase.from('inv_locations').select('*').order('display_order').order('name');
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

export async function createLocation(
    input: Omit<InventoryLocation, 'id' | 'created_at' | 'children'>
): Promise<InventoryLocation> {
    const { data, error } = await supabase
        .from('inv_locations')
        .insert(input)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateLocation(
    id: string,
    input: Partial<Omit<InventoryLocation, 'id' | 'created_at'>>
): Promise<InventoryLocation> {
    const { data, error } = await supabase
        .from('inv_locations')
        .update(input)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteLocation(id: string): Promise<void> {
    const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', id);

    if (count && count > 0) {
        throw new Error(`Cannot delete: ${count} product(s) are assigned to this location.`);
    }

    const { error } = await supabase.from('inv_locations').delete().eq('id', id);
    if (error) throw error;
}

export async function resolveLocationCode(
    code: string,
    allLocations: InventoryLocation[]
): Promise<string | null> {
    if (!code?.trim()) return null;
    const match = allLocations.find(l => l.code.toLowerCase() === code.toLowerCase());
    return match?.id ?? null;
}
