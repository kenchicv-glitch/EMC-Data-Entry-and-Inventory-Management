export interface Product {
    id?: string;
    sku: string;
    name: string;
    description: string | null;
    brand: string | null;
    variant_type: string | null;   // e.g., MAKAPAL, MANIPIS, FLAT WALL
    size: string | null;           // e.g., 5.5MM, 1/4"x1", 40KG
    legacy_sku: string | null;     // old breadcrumb path preserved for reference
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
    selling_price: number | null;
    buying_price: number | null;
    supplier_selling_price: number | null;
    low_stock_threshold: number | null;
    supplier_id: string | null;
    unit: string | null;
    branch_id?: string;
    created_at?: string;
    // ---- NEW FIELDS (added by Phase 10) ----
    category_id?: string | null;
    location_id?: string | null;
    is_active?: boolean;
    image_url?: string | null;
    // ---- JOINED (from select with joins) ----
    category?: Category | null;
    location?: InventoryLocation | null;
}

export interface StockMovement {
    id: string;
    product_id: string;
    type: 'sale' | 'purchase' | 'adjustment' | 'refund' | 'return';
    quantity: number;
    reason: string | null;
    date: string;
    user_id: string | null;
}

// ---- NEW TYPES (Phase 10) ----

export interface Category {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    depth: number;           // 0 = master, 1 = category, 2 = subcategory
    display_order: number;
    description: string | null;
    color: string | null;
    created_at: string;
    updated_at: string;
    // joined
    parent?: Category | null;
    children?: Category[];
    product_count?: number;
}

export interface CategoryTree extends Category {
    children: CategoryTree[];
}

export interface InventoryLocation {
    id: string;
    name: string;
    code: string;
    parent_id: string | null;
    description: string | null;
    branch_id: string | null;  // UUID string — matches branches.id type
    display_order: number;
    created_at: string;
    children?: InventoryLocation[];
}

export interface StocktakeSession {
    id: string;
    branch_id: string;         // UUID string
    status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
    notes: string | null;
    started_by: string | null;
    completed_by: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface StocktakeItem {
    id: string;
    stocktake_id: string;
    product_id: string;
    system_qty: number;
    counted_qty: number | null;
    variance: number | null;   // generated column
    notes: string | null;
    counted_at: string | null;
    counted_by: string | null;
    // joined
    product?: Pick<Product, 'id' | 'sku' | 'name' | 'unit' | 'category_id' | 'location_id'>;
}

export interface InventoryAdjustment {
    id: string;
    product_id: string;
    branch_id: string;
    previous_stock: number;
    actual_stock: number;
    difference: number;
    type: string;
    reason: string | null;
    adjusted_by: string | null;
    created_at: string;
}

// ---- IMPORT / EXPORT TYPES ----

export interface ProductImportRow {
    sku: string;
    name: string;
    description?: string;
    brand?: string;
    variant_type?: string;    // e.g., MAKAPAL, MANIPIS
    size?: string;            // e.g., 5.5MM, 1/4X1
    unit?: string;
    selling_price: number;
    buying_price: number;
    supplier_selling_price?: number;
    stock_available?: number;
    low_stock_threshold?: number;
    category_path?: string;   // e.g. 'Plumbing > Pipes > PVC'
    location_code?: string;   // e.g. 'SH-A'
}

export interface ProductImportResult {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; sku: string; error: string }>;
}
