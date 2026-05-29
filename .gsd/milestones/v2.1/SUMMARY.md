# Milestone: v2.1 — Performance & Accuracy Stability

## Completed: 2026-05-29

## Overview
This milestone focused on building a correct, reliable financial reporting layer for the EMC Data Entry and Inventory Management System. The primary goal was to eliminate profit calculation errors, establish a hierarchical inventory system, and stabilize all data flows between the Sales, Inventory, and DSC (Daily Sales & Collection) modules.

---

## Deliverables

### Core Must-Haves
- ✅ Corrected Gross Profit calculation (Revenue - COGS) with optional VAT
- ✅ VAT-Inclusive toggle in Profit Analysis dashboard
- ✅ Accurately reflected category distribution matching raw SRP totals
- ✅ Performant Inventory search without navigation freezes
- ✅ Canonical 10-category system across all inventory modules
- ✅ Universal color-coding and visibility for master categories
- 🔶 Two-way stock synchronization between Sales and Products — *Logic implemented, DB-level trigger verification deferred to v2.2*

---

## Phases Completed

| Phase | Name | Completion |
|-------|------|------------|
| 1–8 | Basic Infrastructure & Dashboard Refinement | 2026-03-28 |
| 16 | Engineering Excellence & System Stability | 2026-04-12 |
| 17 | UI Optimization & Workflow Refinement | 2026-04-12 |
| 10 | Inventory Revamp — Full Module Overhaul | 2026-04-14 |
| FIX | Inventory-Sales Synchronization (Critical) | 2026-05-16 |

---

## Key Accomplishments

### Phase 1–8: Foundation & Dashboard
- Service logic refactor for maintainability
- VAT toggle implementation for revenue dashboards
- Editable invoice numbers for data correction workflows
- Role-based permission guards (`EncoderGuard`, `OwnerGuard`)

### Phase 16–17: Stability & UX
- Resolved all React structural errors and Fast Refresh violations
- Implemented compact Purchase UI with aligned quantity logic
- Optimized sales workflow, redesigned Guide page
- Added branch selector to mobile sidebar for owner/admin access

### Phase 10: Inventory Revamp
- Full hierarchical category system (160+ categories)
- Bulk Excel import pipeline (810 unique products × 3 branches = 2,430 rows)
- Implemented `inv_categories`, `inv_locations`, `inv_stocktakes` table structure
- Category tree UI with collapsible sidebar navigation
- Admin Pricelist connected to live inventory stock
- SKU generator and unit standardization utilities

### Phase FIX: Stock Synchronization
- Atomic stock decrement in `salesService.create`
- Stock restoration in `deleteByInvoice`
- `inventory_adjustments` audit trail for Sale, Delete, and Refund events
- TypeScript build stabilized: all type errors resolved across DSC, Sales, and Inventory modules

---

## Metrics
- **Total commits**: 22 (milestone-scoped)
- **Files changed**: 595
- **Insertions**: ~102,567 lines
- **Deletions**: ~6,122 lines
- **Duration**: ~10 weeks (2026-03-18 → 2026-05-29)
- **Branches**: Main (single-branch workflow)

---

## Architectural Decisions Made

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-01 | Supabase Realtime for Notifications | Minimizes latency for cross-branch coordination |
| ADR-02 | Atomic Transfer via Postgres Function | Ensures stock consistency via single-transaction deduct/add |
| ADR-03 | Centralized ReportService for Metrics | Single source of truth for financial calculations |
| ADR-04 | Role-based Permission Guards | Granular access control via EncoderGuard/OwnerGuard |
| ADR-05 | Dynamic Page Restrictions Table | Toggle beta/in-dev page visibility without deploys |

---

## Lessons Learned

1. **Schema-First Discipline**: The `branch_id` UUID→BigInt mismatch caused significant rework during the inventory import. Future schema changes need to be audited against all foreign key references before code is written.
2. **Type Safety Pays Off**: Keeping `noUnusedLocals` disabled was a pragmatic choice to unblock builds, but accumulated type debt caused cascading fixes in Sales, DSC, and Refund modules. TypeScript strict mode should be a first-class concern per phase, not deferred.
3. **Dead Code is Technical Debt**: The `InventoryCategoriesPage` migration view and `useInventoryAutopilot` hook were removed only after they caused build failures — they should have been cleaned up at the end of the phase that introduced them.
4. **Data Migrations Need Idempotency**: The 810-product bulk import created duplicates in earlier attempts because the upsert logic wasn't guarded. Always add a unique constraint or check before bulk inserts.

---

## Deferred to v2.2

- [ ] **Phase FIX (partial)**: Supabase DB-level trigger verification for stock decrement (race condition audit in production)
- [ ] **Phase 9**: DSC Systems Data Integration — Sync Preview UI, idempotency checks, payment mode mapping
- [ ] **Phase 10 (partial)**: SQL migrations must be run in Supabase (`inv_categories`, `inv_locations`, `inv_stocktakes`, `inv_stocktake_items`, `ALTER TABLE products`)
- [ ] **Phase 11**: DSC Audit Fixes — `unrecordedShort` calculation, `shortenProductName` deduplication, `fetchSystemPurchases` audit
- [ ] **Simulation Tests**: Full encoder-path UAT (create sale → verify stock → DSC sync → verify name)
