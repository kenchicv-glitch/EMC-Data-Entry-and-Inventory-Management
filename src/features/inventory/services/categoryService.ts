import { supabase } from '../../../shared/lib/supabase';
import type { Category, CategoryTree } from '../types/product';

// ---- HELPERS ----

function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
}

function buildTree(categories: Category[]): CategoryTree[] {
    const map = new Map<string, CategoryTree>();
    const roots: CategoryTree[] = [];

    categories.forEach(cat => {
        map.set(cat.id, { ...cat, children: [] });
    });

    map.forEach(cat => {
        if (cat.parent_id && map.has(cat.parent_id)) {
            map.get(cat.parent_id)!.children.push(cat);
        } else {
            roots.push(cat);
        }
    });

    const sortChildren = (nodes: CategoryTree[]) => {
        nodes.sort((a, b) => a.display_order - b.display_order);
        nodes.forEach(n => sortChildren(n.children));
    };
    sortChildren(roots);

    return roots;
}

// ---- QUERIES ----

export async function getAllCategories(): Promise<Category[]> {
    const { data, error } = await supabase
        .from('inv_categories')
        .select('*')
        .order('depth')
        .order('display_order');
    if (error) throw error;
    return data ?? [];
}

export async function getCategoryTree(): Promise<CategoryTree[]> {
    const categories = await getAllCategories();
    return buildTree(categories);
}

export async function getCategoryById(id: string): Promise<Category> {
    const { data, error } = await supabase
        .from('inv_categories')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

// ---- MUTATIONS ----

export async function createCategory(
    input: Pick<Category, 'name' | 'description' | 'color' | 'display_order'> & {
        parent_id?: string | null;
    }
): Promise<Category> {
    let depth = 0;
    let baseSlug = slugify(input.name);
    let slug = baseSlug;

    if (input.parent_id) {
        const parent = await getCategoryById(input.parent_id);
        depth = parent.depth + 1;
        if (depth > 2) {
            throw new Error('Maximum category depth is 2 (master → category → subcategory)');
        }
        // Prefix subcategory slugs with parent slug to avoid global unique constraint violations
        // e.g. "Boysen > Paint" -> "boysen-paint", "Davies > Paint" -> "davies-paint"
        slug = `${parent.slug}-${baseSlug}`;
    }

    // Double check for existing slug to prevent constraint errors
    const { data: existing } = await supabase
        .from('inv_categories')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
    
    if (existing) {
        // If conflict exists, append a random suffix to ensure uniqueness
        slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const { data, error } = await supabase
        .from('inv_categories')
        .insert({ ...input, slug, depth })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateCategory(
    id: string,
    input: Partial<Pick<Category, 'name' | 'description' | 'color' | 'display_order' | 'parent_id'>>
): Promise<Category> {
    const updates: Record<string, unknown> = { ...input };
    
    if (input.name || input.parent_id !== undefined) {
        // Fetch current category to see if we need parent info for slug
        const current = await getCategoryById(id);
        const name = input.name || current.name;
        const parentId = input.parent_id !== undefined ? input.parent_id : current.parent_id;
        
        let baseSlug = slugify(name);
        let slug = baseSlug;

        if (parentId) {
            const parent = await getCategoryById(parentId);
            slug = `${parent.slug}-${baseSlug}`;
        }
        
        // Ensure slug is unique even on update
        const { data: conflict } = await supabase
            .from('inv_categories')
            .select('id')
            .eq('slug', slug)
            .neq('id', id)
            .maybeSingle();

        if (conflict) {
            slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
        }
        
        updates.slug = slug;
    }

    const { data, error } = await supabase
        .from('inv_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteCategory(id: string): Promise<void> {
    const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);

    if (productCount && productCount > 0) {
        throw new Error(
            `Cannot delete: ${productCount} product(s) are assigned to this category. Reassign them first.`
        );
    }

    const { count: childCount } = await supabase
        .from('inv_categories')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', id);

    if (childCount && childCount > 0) {
        throw new Error(
            `Cannot delete: this category has ${childCount} subcategory/ies. Delete or move them first.`
        );
    }

    const { error } = await supabase.from('inv_categories').delete().eq('id', id);
    if (error) throw error;
}

// ---- CATEGORY PATH RESOLVER (for import) ----
// Resolves 'Plumbing > Pipes > PVC' to a category id, creating if necessary
export async function resolveCategoryPath(
    path: string,
    allCategories: Category[]
): Promise<string | null> {
    if (!path?.trim()) return null;

    const parts = path.split('>').map(p => p.trim()).filter(Boolean);
    let parentId: string | null = null;
    let resolvedId: string | null = null;

    for (const part of parts) {
        const existing = allCategories.find(
            c => c.name.toLowerCase() === part.toLowerCase() && c.parent_id === parentId
        );

        if (existing) {
            parentId = existing.id;
            resolvedId = existing.id;
        } else {
            const created = await createCategory({
                name: part,
                parent_id: parentId,
                display_order: 0,
                description: null,
                color: null,
            });
            allCategories.push(created);
            parentId = created.id;
            resolvedId = created.id;
        }
    }

    return resolvedId;
}

// ---- PRODUCT COUNT PER CATEGORY ----
export async function getCategoryProductCounts(
    branchId: string | null
): Promise<Record<string, number>> {
    let query = supabase
        .from('products')
        .select('category_id')
        .eq('is_active', true)
        .not('category_id', 'is', null);

    if (branchId) query = query.eq('branch_id', branchId);

    const { data } = await query;
    const counts: Record<string, number> = {};
    (data ?? []).forEach(p => {
        if (p.category_id) {
            counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
        }
    });
    return counts;
}

/**
 * Validates the integrity of the inventory hierarchy.
 * Finds products with no category or inconsistent name/category relationships.
 */
export async function validateHierarchy(branchId: string | null) {
    let query = supabase
        .from('products')
        .select('id, name, sku, category_id, branch_id')
        .eq('is_active', true);
    
    if (branchId) query = query.eq('branch_id', branchId);
    
    const { data: products, error } = await query;
    if (error) throw error;

    const issues = {
        uncategorized: [] as any[],
        legacyFormat: [] as any[], // Products that still have " > " in name
    };

    products?.forEach(p => {
        if (!p.category_id) issues.uncategorized.push(p);
        const hasPathInName = p.name.includes(' > ');
        const hasPathInSku = p.sku?.includes(' > ');
        if (hasPathInName || hasPathInSku) issues.legacyFormat.push(p);
    });

    return issues;
}

// ---- ONE-TIME DATA MIGRATION ----
// Migrates products from name-path format to category_id + clean name
// e.g. "STEEL > STEEL MATTING > MANIPIS #6 > #6 WIRE MESH" →
//       name = "#6 WIRE MESH", sku = old_path, category_id = <id of MANIPIS #6>
export interface MigrationResult {
    migrated: number;
    skipped: number;
    errors: string[];
}

export async function runProductMigration(
    branchId: string | null,
    onProgress?: (current: number, total: number) => void
): Promise<MigrationResult> {
    // 1. Fetch products that either:
    //    a) still have breadcrumb paths in name or sku, OR
    //    b) have no category_id assigned (orphaned from partial migration)
    let query = supabase
        .from('products')
        .select('id, name, sku, category_id')
        .or('name.ilike.% > %,sku.ilike.% > %,category_id.is.null');
    if (branchId) query = query.eq('branch_id', branchId);

    const { data: products, error } = await query;
    if (error) throw error;

    if (!products || products.length === 0) {
        return { migrated: 0, skipped: 0, errors: [] };
    }

    // 2. Load the full category list once (resolveCategoryPath mutates it in place)
    const allCategories = await getAllCategories();

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 3. To avoid race conditions in resolveCategoryPath with parallel updates,
    // we first pre-resolve all unique category paths sequentially.
    const uniquePaths = Array.from(new Set(products.map(p => {
        const isSkuPath = p.sku?.includes(' > ');
        const rawPath = isSkuPath ? (p.sku || '') : p.name;
        const parts = rawPath.split(' > ').map((part: string) => part.trim());
        return parts.length >= 2 ? parts.slice(0, -1).join(' > ') : null;
    }).filter(Boolean)));

    for (const path of uniquePaths) {
        if (path) await resolveCategoryPath(path, allCategories);
    }

    // 4. Update products in parallel chunks to maximize throughput
    const CHUNK_SIZE = 50;
    const total = products.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = products.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(chunk.map(async (product) => {
            try {
                const isSkuPath = product.sku?.includes(' > ');
                const isNamePath = product.name.includes(' > ');
                
                // If no breadcrumb exists in either field, skip (can't auto-categorize)
                if (!isSkuPath && !isNamePath) {
                    skipped++;
                    return;
                }
                
                // Prefer sku path (partially migrated products have breadcrumb in sku)
                const rawPath = isSkuPath ? (product.sku || '') : product.name;
                const parts = rawPath.split(' > ').map((p: string) => p.trim());
                
                if (parts.length < 2) {
                    skipped++;
                    return;
                }

                const cleanName = parts[parts.length - 1];
                const categoryPath = parts.slice(0, -1).join(' > ');

                // This should now hit the local allCategories cache every time
                const categoryId = await resolveCategoryPath(categoryPath, allCategories);

                const shouldSetSkuToPath = isSkuPath || !product.sku || product.sku === product.name;

                const { error: updateError } = await supabase
                    .from('products')
                    .update({
                        name:        cleanName,
                        sku:         shouldSetSkuToPath ? rawPath : product.sku,
                        category_id: categoryId,
                    })
                    .eq('id', product.id);

                if (updateError) throw updateError;
                migrated++;
            } catch (err: any) {
                errors.push(`[${product.name}] ${err.message}`);
            }
        }));

        if (onProgress) {
            onProgress(Math.min(i + CHUNK_SIZE, total), total);
        }
    }

    return { migrated, skipped, errors };
}

