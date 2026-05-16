/**
 * SKU Migration Service
 * 
 * One-time migration that converts all existing breadcrumb-style SKUs
 * to the new human-readable format.
 */
import { supabase } from '../../../shared/lib/supabase';
import { generateSkuBatch, type ProductForSku, type SkuMigrationResult } from '../../../shared/lib/skuGenerator';

export interface MigrationPreview {
    total: number;
    needsMigration: number;
    alreadyMigrated: number;
    samples: SkuMigrationResult[];
}

export interface MigrationReport {
    total: number;
    migrated: number;
    skipped: number;
    errors: Array<{ id: string; error: string }>;
}

/**
 * Preview what the migration would do without committing changes.
 */
export async function previewMigration(): Promise<MigrationPreview> {
    // Fetch all products with their category hierarchy
    const { data: products, error } = await supabase
        .from('products')
        .select(`
            id, name, sku, brand,
            category:inv_categories!category_id (
                id, name, depth,
                parent:inv_categories!parent_id (
                    id, name, depth,
                    parent:inv_categories!parent_id (
                        id, name
                    )
                )
            )
        `)
        .order('name');

    if (error) throw new Error(`Failed to fetch products: ${error.message}`);
    if (!products || products.length === 0) return { total: 0, needsMigration: 0, alreadyMigrated: 0, samples: [] };

    // Categorize: needs migration vs already done
    const needsMigration: ProductForSku[] = [];
    let alreadyMigrated = 0;

    for (const p of products) {
        const hasBreadcrumb = p.sku?.includes(' > ') || false;
        const hasNoSku = !p.sku;

        if (hasBreadcrumb || hasNoSku) {
            // Resolve category hierarchy
            const cat = p.category as any;
            let master = '', subcat = '', catName = '';
            if (cat) {
                if (cat.depth === 2 && cat.parent?.parent) {
                    master  = cat.parent.parent.name || '';
                    catName = cat.parent.name || '';
                    subcat  = cat.name || '';
                } else if (cat.depth === 1 && cat.parent) {
                    master  = cat.parent.name || '';
                    catName = cat.name || '';
                } else {
                    master = cat.name || '';
                }
            } else {
                // Legacy: extract from breadcrumb
                const parts = (p.sku || p.name || '').split(' > ');
                master  = parts[0] || 'UNCATEGORIZED';
                catName = parts[1] || '';
                subcat  = parts.length > 2 ? parts[2] : '';
            }

            needsMigration.push({
                id: p.id,
                name: p.name,
                sku: p.sku,
                brand: p.brand,
                master_name: master,
                category_name: catName,
                subcat_name: subcat,
            });
        } else {
            alreadyMigrated++;
        }
    }

    // Generate new SKUs
    const results = generateSkuBatch(needsMigration);

    return {
        total: products.length,
        needsMigration: needsMigration.length,
        alreadyMigrated,
        samples: results.slice(0, 30), // Show first 30 as preview
    };
}

/**
 * Execute the migration — updates all products with new SKUs.
 */
export async function executeMigration(
    onProgress?: (current: number, total: number) => void
): Promise<MigrationReport> {
    // Fetch all products needing migration
    const { data: products, error } = await supabase
        .from('products')
        .select(`
            id, name, sku, brand, variant_type, size,
            category:inv_categories!category_id (
                id, name, depth,
                parent:inv_categories!parent_id (
                    id, name, depth,
                    parent:inv_categories!parent_id (
                        id, name
                    )
                )
            )
        `)
        .order('name');

    if (error) throw new Error(`Failed to fetch products: ${error.message}`);
    if (!products) return { total: 0, migrated: 0, skipped: 0, errors: [] };

    // Filter to only those needing migration
    const toMigrate: ProductForSku[] = [];
    let skipped = 0;

    for (const p of products) {
        const hasBreadcrumb = p.sku?.includes(' > ') || false;
        const hasNoSku = !p.sku;

        if (hasBreadcrumb || hasNoSku) {
            const cat = p.category as any;
            let master = '', subcat = '', catName = '';
            if (cat) {
                if (cat.depth === 2 && cat.parent?.parent) {
                    master  = cat.parent.parent.name || '';
                    catName = cat.parent.name || '';
                    subcat  = cat.name || '';
                } else if (cat.depth === 1 && cat.parent) {
                    master  = cat.parent.name || '';
                    catName = cat.name || '';
                } else {
                    master = cat.name || '';
                }
            } else {
                const parts = (p.sku || p.name || '').split(' > ');
                master  = parts[0] || 'UNCATEGORIZED';
                catName = parts[1] || '';
                subcat  = parts.length > 2 ? parts[2] : '';
            }

            toMigrate.push({
                id: p.id,
                name: p.name,
                sku: p.sku,
                brand: p.brand,
                master_name: master,
                category_name: catName,
                subcat_name: subcat,
            });
        } else {
            skipped++;
        }
    }

    // Generate new SKUs
    const results = generateSkuBatch(toMigrate);

    // Apply updates in batches of 50
    const BATCH_SIZE = 50;
    let migrated = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (let i = 0; i < results.length; i += BATCH_SIZE) {
        const batch = results.slice(i, i + BATCH_SIZE);
        
        for (const item of batch) {
            try {
                const updateData: Record<string, any> = {
                    sku: item.newSku,
                };

                // Backfill legacy_sku if it had a breadcrumb
                if (item.oldSku?.includes(' > ')) {
                    updateData.legacy_sku = item.oldSku;
                }

                // Set variant_type and size if extracted and not already set
                if (item.extractedVariant) {
                    updateData.variant_type = item.extractedVariant;
                }
                if (item.extractedSize) {
                    updateData.size = item.extractedSize;
                }

                const { error: updateError } = await supabase
                    .from('products')
                    .update(updateData)
                    .eq('id', item.id);

                if (updateError) {
                    errors.push({ id: item.id, error: updateError.message });
                } else {
                    migrated++;
                }
            } catch (err: any) {
                errors.push({ id: item.id, error: err.message || 'Unknown error' });
            }
        }

        onProgress?.(Math.min(i + BATCH_SIZE, results.length), results.length);
    }

    return {
        total: products.length,
        migrated,
        skipped,
        errors,
    };
}
