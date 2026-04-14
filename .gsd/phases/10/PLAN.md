# Phase 10: Inventory Revamp — Execution Plan

## Codebase Audit Findings (Part 13 Answers)

> These findings OVERRIDE the SOP where there is a conflict.

| SOP Question | Actual Answer |
|---|---|
| Supabase client import path | `import { supabase } from '../../../shared/lib/supabase'` (relative — no `@/` alias in inventory feature) |
| `useProducts` query key | `queryKeys.products.all = ['products']`. New keys must start with `'inventory'` to avoid collision |
| Branch context hook | `useBranch()` → `{ activeBranchId: string \| null }` — UUID string, **NOT bigint/number** |
| `/inventory` route | Currently renders `<Inventory />` monolith — new `InventoryPage.tsx` will replace it |
| Shared Table/Modal/Button | None exist. Build per-feature or inline with Tailwind |
| `@/` path alias | NOT used in inventory files — use relative `../../../` paths |

## ⚠️ Critical SOP Override: `branch_id` Type

The SOP specifies `branch_id BIGINT` in new SQL tables and `number` in TypeScript. **This is WRONG for this codebase.**

- `branches.id` is a **UUID** (confirmed from `BranchContext.tsx` and all existing queries)
- `activeBranchId: string | null` from `useBranch()`
- All existing services pass `branchId: string | null`

**Corrected SQL:** All new tables (`inv_locations`, `inv_stocktakes`) use `branch_id UUID` not `BIGINT`.  
**Corrected TypeScript:** `branch_id: string | null` not `number`.

---

## Implementation Waves

### Wave 1 — Database (run in Supabase SQL Editor, in order)

#### Step 1.2: Create `inv_categories`
```sql
CREATE TABLE inv_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  parent_id     UUID REFERENCES inv_categories(id) ON DELETE SET NULL,
  depth         INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  description   TEXT,
  color         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inv_categories_parent ON inv_categories(parent_id);
CREATE INDEX idx_inv_categories_depth  ON inv_categories(depth);
CREATE INDEX idx_inv_categories_slug   ON inv_categories(slug);
ALTER TABLE inv_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON inv_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION update_inv_categories_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_inv_categories_updated_at
  BEFORE UPDATE ON inv_categories
  FOR EACH ROW EXECUTE FUNCTION update_inv_categories_updated_at();
```

#### Step 1.3: Create `inv_locations`
```sql
-- CORRECTED: branch_id is UUID (not BIGINT) to match existing branches.id type
CREATE TABLE inv_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  parent_id     UUID REFERENCES inv_locations(id) ON DELETE SET NULL,
  description   TEXT,
  branch_id     UUID,                -- UUID to match branches.id
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inv_locations_parent ON inv_locations(parent_id);
CREATE INDEX idx_inv_locations_branch ON inv_locations(branch_id);
ALTER TABLE inv_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON inv_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

#### Step 1.4: Create `inv_stocktakes` + `inv_stocktake_items`
```sql
-- CORRECTED: branch_id is UUID
CREATE TABLE inv_stocktakes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  notes         TEXT,
  started_by    UUID REFERENCES profiles(id),
  completed_by  UUID REFERENCES profiles(id),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inv_stocktake_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id  UUID NOT NULL REFERENCES inv_stocktakes(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  system_qty    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  counted_qty   NUMERIC(12, 2),
  variance      NUMERIC(12, 2) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  notes         TEXT,
  counted_at    TIMESTAMPTZ,
  counted_by    UUID REFERENCES profiles(id),
  UNIQUE(stocktake_id, product_id)
);

CREATE INDEX idx_inv_stocktakes_branch       ON inv_stocktakes(branch_id);
CREATE INDEX idx_inv_stocktake_items_session ON inv_stocktake_items(stocktake_id);
CREATE INDEX idx_inv_stocktake_items_product ON inv_stocktake_items(product_id);
ALTER TABLE inv_stocktakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_stocktake_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON inv_stocktakes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON inv_stocktake_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION update_inv_stocktakes_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_inv_stocktakes_updated_at
  BEFORE UPDATE ON inv_stocktakes
  FOR EACH ROW EXECUTE FUNCTION update_inv_stocktakes_updated_at();
```

#### Step 1.5: ALTER products (run LAST, after tables above exist)
```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES inv_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id  UUID REFERENCES inv_locations(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS image_url    TEXT;

CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_location  ON products(location_id);
CREATE INDEX idx_products_is_active ON products(is_active);
```

---

### Wave 2 — Types

**File:** `src/features/inventory/types/product.ts` — APPEND only, do not touch existing `Product` or `StockMovement`.

New fields to add to existing `Product` interface:
```typescript
  // New columns (nullable — all existing rows get defaults)
  category_id: string | null;
  location_id: string | null;
  is_active: boolean;
  image_url: string | null;
  // Joined
  category?: Category | null;
  location?: InventoryLocation | null;
```

New interfaces to append (corrected branch_id types to `string`):
- `Category`, `CategoryTree`, `InventoryLocation` (branch_id: `string | null`)
- `StocktakeSession` (branch_id: `string`)
- `StocktakeItem`
- `InventoryAdjustment` (branch_id: `string`)
- `ProductImportRow`, `ProductImportResult`

---

### Wave 3 — Services (all new files + append to productService)

**Import path for all new services:**
```typescript
import { supabase } from '../../../shared/lib/supabase';
```

**New files:**
- `src/features/inventory/services/categoryService.ts`
- `src/features/inventory/services/locationService.ts`
- `src/features/inventory/services/stocktakeService.ts`
- `src/features/inventory/services/inventoryExportService.ts`

**Append to:** `src/features/inventory/services/productService.ts`
- `getProductsWithDetails(branchId: string)`
- `getProductsByCategory(categoryId, branchId: string)`
- `getLowStockProducts(branchId: string)`
- `importProductsFromRows(rows, branchId: string, userId)`

**Key correction in productService append:** All `branchId` params are `string`, not `number`.

---

### Wave 4 — Hooks

**Query key strategy:** All new inventory query keys start with `'inventory'` (e.g. `['inventory', 'categories']`) to avoid any collision with existing `queryKeys.products.all = ['products']`.

**New files:**
- `src/features/inventory/hooks/useCategories.ts`
- `src/features/inventory/hooks/useLocations.ts`
- `src/features/inventory/hooks/useStocktake.ts`

**Append to:** `src/features/inventory/hooks/useProducts.ts`
- `useProductsWithDetails(branchId: string)`
- `useLowStockProducts(branchId: string)`
- `useImportProducts()`

All new hooks use `useBranch()` to get `activeBranchId`.

---

### Wave 5 — Components

Build in this order (leaf → composite):

1. `LowStockBadge.tsx` — simple badge, no deps
2. `CategoryTree.tsx` — renders CategoryTree[], emits selected `categoryId | null`
3. `ProductFilters.tsx` — search + brand + location + low-stock toggle
4. `ProductTable.tsx` — TanStack Table v8 with the product list
5. `CategoryFormModal.tsx` — create/edit category (Tailwind modal pattern)
6. `LocationFormModal.tsx` — create/edit location
7. `ProductQuickViewModal.tsx` — read-only product detail modal
8. `ProductImportModal.tsx` — 3-step wizard
9. `StocktakeTable.tsx` — inline count entry table
10. Extend `ProductModal.tsx` — add category/location/is_active fields only

---

### Wave 6 — Pages

- `src/features/inventory/pages/InventoryPage.tsx` — sidebar+table hub, sub-nav tabs
- `src/features/inventory/pages/InventoryCategoriesPage.tsx`
- `src/features/inventory/pages/InventoryLocationsPage.tsx`
- `src/features/inventory/pages/StocktakePage.tsx`

---

### Wave 7 — Routing + Print + Nav

**`src/App.tsx` changes:**
- Replace `<Route path="/inventory" element={<Inventory />} />` with `<Route path="/inventory" element={<InventoryPage />} />`
- Add sub-routes inside the same `<EncoderGuard><Layout />` wrapper:
  ```tsx
  <Route path="/inventory/categories" element={<InventoryCategoriesPage />} />
  <Route path="/inventory/locations"  element={<InventoryLocationsPage />} />
  <Route path="/inventory/stocktake"  element={<StocktakePage />} />
  ```

**Print CSS** — append to global CSS file:
```css
@media print {
  .no-print { display: none !important; }
  body { font-size: 12px; }
}
```

**`Layout.tsx` sidebar** — no change needed; `/inventory` NavLink already active-matches all sub-routes.

---

## Verification Checklist

- [ ] SQL runs with no errors; `\d products` shows 4 new columns
- [ ] No existing product data is lost (run `SELECT COUNT(*) FROM products` before and after)
- [ ] Category tree creates/edits/deletes correctly; depth guard at 3 levels enforced
- [ ] Product table loads with category + location joins; filters work
- [ ] Import wizard: upload template → preview → import → summary shown
- [ ] Export: `.xlsx` downloads with styled header row and low-stock highlights
- [ ] Stocktake: start session, enter counts inline, complete → `inventory_adjustments` rows written
- [ ] Print: `react-to-print` fires without console errors
- [ ] `npm run build` exits 0 — no TypeScript errors

---

## Files NOT to Touch

- `src/features/inventory/components/CategoryRenameModal.tsx`
- `src/features/inventory/components/TransferRequestModal.tsx`
- `src/features/inventory/hooks/useInventoryReport.ts`
- `src/features/inventory/Inventory.tsx` (keep as fallback until InventoryPage is stable)
- `inventory_adjustments` DB table — write to it, never alter it
