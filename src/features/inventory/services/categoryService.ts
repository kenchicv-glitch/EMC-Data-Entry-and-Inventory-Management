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
    if (input.parent_id) {
        const parent = await getCategoryById(input.parent_id);
        depth = parent.depth + 1;
        if (depth > 2) {
            throw new Error('Maximum category depth is 2 (master → category → subcategory)');
        }
    }

    const { data, error } = await supabase
        .from('inv_categories')
        .insert({ ...input, slug: slugify(input.name), depth })
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
    if (input.name) updates.slug = slugify(input.name);

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
