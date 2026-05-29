# ROADMAP.md

> **Current Phase**: Planning
> **Milestone**: v2.2 — Data Integrity & DSC Integration

## Must-Haves (from SPEC)
- [ ] **STABLE**: Two-way stock synchronization verified end-to-end in production (DB trigger audit)
- [ ] SQL migrations deployed to Supabase (`inv_categories`, `inv_locations`, `inv_stocktakes`, `inv_stocktake_items`, `ALTER TABLE products`)
- [ ] DSC Sync Preview UI — show pending sync items before committing
- [ ] DSC idempotency — re-sync protection (no duplicate records)
- [ ] `unrecordedShort` calculation fixed in `DailySummarySection.tsx`
- [ ] `shortenProductName` deduplication fix in `dscSyncService.ts`

---

## Phases

### Phase FIX-2: Stock Sync Production Verification
**Status**: ⬜ Not Started
**Objective**: Empirically verify the stock decrement logic in production via the Supabase dashboard and simulated encoder workflow.
**Tasks**:
- [ ] Simulation 1: Create sale for 10 units → Verify `products` table -10 in Supabase.
- [ ] Simulation 2: Delete invoice → Verify `products` table returns to original count.
- [ ] Simulation 3: Create refund → Verify `inventory_adjustments` log entry created.
- [ ] Audit `useSales` and `SalesModal` for race conditions during rapid entry.

---

### Phase DB: Supabase SQL Migrations
**Status**: ⬜ Not Started
**Objective**: Deploy pending schema to production Supabase so Phase 10 inventory features are fully functional.
**Tasks**:
- [ ] Create `inv_categories` table.
- [ ] Create `inv_locations` table.
- [ ] Create `inv_stocktakes` table.
- [ ] Create `inv_stocktake_items` table.
- [ ] `ALTER TABLE products` — add `category_id`, `location_id`, `low_stock_threshold` columns.

---

### Phase 9: Systems Data Integration for DSC
**Status**: ⬜ Not Started
**Objective**: Strengthen the data bridge between the Systems and DSC workspaces.
**Tasks**:
- [ ] Audit `dscSyncService` for missing data (Collections, Expenses).
- [ ] Implement "Sync Preview" UI in `DscDailyPage.tsx`.
- [ ] Map all payment modes correctly.
- [ ] Add "Re-sync" protection (idempotency check).

---

### Phase 11: DSC Audit Fixes & Product Accuracy
**Status**: ⬜ Not Started
**Objective**: Fix reconciliation logic and product name duplication.
**Tasks**:
- [ ] Fix `unrecordedShort` calculation in `DailySummarySection.tsx`.
- [ ] Refine `shortenProductName` in `dscSyncService.ts` to prevent redundant category/item name duplication (e.g. "MAKAPAL #6 MAKAPAL").
- [ ] Audit `fetchSystemPurchases` for duplication.

---

## Verification & Simulation (Encoder Path)
- [ ] Simulation 1: Create sale for 10 units → Verify `products` table -10.
- [ ] Simulation 2: Delete invoice → Verify `products` table returns to original.
- [ ] Simulation 3: Sync to DSC → Verify name is "Subcategory Item" without redundancy.
