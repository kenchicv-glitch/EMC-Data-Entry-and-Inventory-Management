# ROADMAP.md

> **Current Phase**: Post-Implementation Maintenance & Bug Scrub
> **Milestone**: v2.1 Performance & Accuracy Stability

## Must-Haves (from SPEC)
- [x] Corrected Gross Profit calculation (Revenue - COGS) with optional VAT.
- [x] VAT-Inclusive toggle in Profit Analysis dashboard.
- [x] Accurately reflected category distribution matching raw SRP totals.
- [x] Performant Inventory search without navigation freezes.
- [x] **Canonical 10-category system across all inventory modules.**
- [x] **Universal color-coding and visibility for master categories.**
- [ ] **STABLE: Two-way stock synchronization between Sales and Products.**

## Phases

### Phase 1-8: [COMPLETED] Basic Infrastructure & Dashboard Refinement
- Service logic refactor, VAT toggles, UI stability, and editable invoice numbers.

---

### Phase FIX: Inventory-Sales Synchronization (CRITICAL)
**Status**: ⬜ Not Started
**Objective**: Fix the "Phantom Stock" bug where creating a sale does not decrease inventory, but deleting one increases it.
**Tasks**:
- [ ] Implement stock decrement in `salesService.create`.
- [ ] Implement `inventory_adjustments` logging for all sales transactions (Sale, Delete, Refund).
- [ ] Add backend validation to prevent "Selling more than available" at the service layer.
- [ ] Audit `useSales` and `SalesModal` for race conditions during rapid entry.

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

### Phase 10: Inventory Revamp — Full Module Overhaul
**Status**: 🟡 Code Complete / Pending Verification
**Objective**: Hierarchical product categorization, locations, and stocktakes.
**Action Required**:
- [ ] **Run SQL Migrations** in Supabase (Categories, Locations, Stocktake tables).
- [ ] Verify hierarchical tree rendering in Sidebar.
- [ ] Verify Excel Bulk Import with new category mapping.

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
- [ ] Simulation 1: Create sale for 10 units -> Verify `products` table -10.
- [ ] Simulation 2: Delete invoice -> Verify `products` table returns to original.
- [ ] Simulation 3: Sync to DSC -> Verify name is "Subcategory Item" without redundancy.
