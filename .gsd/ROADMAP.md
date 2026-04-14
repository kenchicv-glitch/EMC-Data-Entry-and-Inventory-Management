# ROADMAP.md

> **Current Phase**: Post-Implementation Maintenance
> **Milestone**: v2.1 Performance & Accuracy Stability

## Must-Haves (from SPEC)
- [x] Corrected Gross Profit calculation (Revenue - COGS) with optional VAT.
- [x] VAT-Inclusive toggle in Profit Analysis dashboard.
- [x] Accurately reflected category distribution matching raw SRP totals.
- [x] Performant Inventory search without navigation freezes.
- [x] **Canonical 10-category system across all inventory modules.**
- [x] **Universal color-coding and visibility for master categories.**

## Phases

### Phase 1: Service Logic Refactor
**Status**: ✅ Completed
**Objective**: Update `ReportService.ts` to support VAT-inclusive revenue as the default calculation for profit metrics.

### Phase 2: UI Context & Toggle
**Status**: ✅ Completed
**Objective**: Implement state management for the VAT toggle in `ProfitAnalysis.tsx`.

### Phase 3: Verification & Analytics Parity
**Status**: ✅ Completed
**Objective**: Ensure charts (Pie/Bar) update correctly with VAT toggle.

### Phase 4: Inventory Search & Navigation Stability
**Status**: ✅ Completed
**Objective**: Prevent page freezes when navigating away from a filtered inventory search.

### Phase 5: Performance & Global Modals
**Status**: ✅ Completed
**Objective**: Fix application lagging and hotkey unresponsiveness.

### Phase 6: Navigation Stability
**Status**: ✅ Completed
**Objective**: Resolve UI stuck issue during page transitions.

### Phase 7: Inventory Category Synchronization
**Status**: ✅ Completed
**Objective**: Enforce 10 canonical categories across Inventory, Branch Inventory, and Admin Pricelist.
**Implementation**:
- [x] Standardized `getMasterColor` application-wide.
- [x] Injected missing categories into all relevant views.
- [x] Resolved AdminPricelist TypeError (empty category recursion crash).
- [x] Added cross-module navigation links.

---

### Phase 8: Editable Invoice & Purchase Numbers
**Status**: ✅ Completed
**Objective**: Enable manual editing of invoice/reference numbers in Sales and Purchase modals while preserving auto-increment behavior for new entries.
**Depends on**: Phase 7

**Tasks**:
- [x] Convert `invoiceNumber` display in `SalesModal.tsx` to an editable `input`.
- [x] Verify `PurchaseModal.tsx` reference number input and state synchronization.
- [x] Ensure auto-increment logic correctly populates the next number after successful creation.
- [x] Audit `stepInvoice` logic to ensure it works with manual edits.

**Verification**:
- [x] Manually edit invoice number in Sales Modal and save.
- [x] Verify next invoice number is +1 from the *last saved* number.
- [x] Repeat for Purchase Modal.

---

### Phase 9: Systems Data Integration for DSC
**Status**: ⬜ Not Started
**Objective**: Strengthen the data bridge between the Systems and DSC workspaces to ensure real-time accuracy and eliminate redundant data entry for sales, collections, and purchases.
**Depends on**: Phase 8

**Tasks**:
- [ ] Audit `dscSyncService` to include missing data points (Collections, Refunds, Expenses).
- [ ] Implement a "Sync Preview" UI in `DscDailyPage.tsx` to allow users to review data before importing.
- [ ] Map `payment_mode` from Systems Sales to DSC Collections.
- [ ] Integrate Systems Expenses into the DSC daily workflow.
- [ ] Add visual indicators (badges) in DSC sections for entries synced from Systems.
- [ ] Verify handling of cancelled/voided invoices during the sync process.

**Verification**:
- [ ] Successfully sync a day's sales where payments are split across Cash and GCash.
- [ ] Verify that a refund in the Systems workspace correctly reflects as a deduction or entry in DSC.
- [ ] Ensure no duplicate entries occur when re-syncing a day.
- [ ] Manual confirmation from user on the UI/UX of the "Sync Center".

---

### Phase 10: Inventory Revamp — Full Module Overhaul
**Status**: ⬜ Not Started
**Objective**: Deliver a complete, production-grade inventory management system inside `src/features/inventory/` — covering hierarchical product categorization, shelf/bin locations, bulk Excel import/export, a full-page inventory UI with TanStack Table, and physical stocktake sessions with variance reconciliation.
**Depends on**: Phase 8 (Phase 9 is parallel/independent)

**Tasks**:
- [ ] **DB — Part 1**: Run SQL migrations in order: `inv_categories` → `inv_locations` → `inv_stocktakes` + `inv_stocktake_items` → `ALTER TABLE products`
- [ ] **Types — Part 2**: Extend `src/features/inventory/types/product.ts` with `Category`, `CategoryTree`, `InventoryLocation`, `StocktakeSession`, `StocktakeItem`, `ProductImportRow`, `ProductImportResult` (append, do NOT delete existing types)
- [ ] **Services — Part 4**: Create `categoryService.ts`, `locationService.ts`, `stocktakeService.ts`, `inventoryExportService.ts`; append to existing `productService.ts`
- [ ] **Hooks — Part 5**: Create `useCategories.ts`, `useLocations.ts`, `useStocktake.ts`; append to existing `useProducts.ts`
- [ ] **Components**: Create `CategoryTree.tsx`, `ProductTable.tsx` (TanStack Table v8), `ProductFilters.tsx`, `CategoryFormModal.tsx`, `LocationFormModal.tsx`, `ProductImportModal.tsx` (3-step wizard), `ProductQuickViewModal.tsx`, `StocktakeTable.tsx`, `LowStockBadge.tsx`
- [ ] **Extend existing**: Add `category_id`, `location_id`, `is_active` fields to `ProductModal.tsx` form (do NOT rewrite; append only)
- [ ] **Pages — Part 6**: Create `InventoryPage.tsx` (split sidebar+table layout), `InventoryCategoriesPage.tsx`, `InventoryLocationsPage.tsx`, `StocktakePage.tsx`
- [ ] **Routing — Part 9**: Register all four routes; add sub-nav tabs inside `InventoryPage`
- [ ] **Print — Part 10**: Wire `react-to-print` refs in `InventoryPage` and `StocktakePage`; add `@media print` CSS

**Constraints**:
- ⚠️ `products` table has 2,466 live rows — ALTER ONLY, never DROP/RECREATE
- ⚠️ `branch_id` is `bigint` (TypeScript `number`) — not UUID
- ⚠️ Do NOT delete `CategoryRenameModal.tsx`, `ProductModal.tsx`, or `TransferRequestModal.tsx`
- ⚠️ Tailwind v4 only — no shadcn/ui, no tailwind.config.js patterns
- ⚠️ Max category depth = 2 (master → category → subcategory)

**Verification**:
- [ ] SQL migrations run cleanly; `products` table gains 4 new columns without data loss
- [ ] Category tree renders 3 levels; creating, renaming, deleting categories works with guard against assigned products
- [ ] Product table filters correctly by category (includes all descendants), location, brand, and low-stock toggle
- [ ] Bulk Excel import: upload template file → preview → import → result summary with error rows listed
- [ ] Export downloads a valid `.xlsx` with all columns and low-stock rows highlighted
- [ ] Stocktake session: start → count items inline → complete with variance → `inventory_adjustments` records written
- [ ] Print: product list and stocktake sheet both print cleanly via `react-to-print`
- [ ] No TypeScript errors; all new hooks follow TanStack Query v5 syntax
