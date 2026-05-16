# STATE.md

## Last Session Summary
Phase FIX (Inventory-Sales Sync) & DSC Refinement — **EXECUTED AND VERIFIED**.

### Accomplishments
- **Phase FIX**: Implemented atomic-like stock decrement in `salesService.create` and correctly handled restoration in `deleteByInvoice`.
- **Audit Trails**: Added `inventory_adjustments` logging for Sales, Deletions, and Refunds.
- **Refund Stabilization**: Fixed `RefundModal.tsx` to restore stock and log adjustments via `salesService.createRefund`.
- **DSC Name Refinement**: Implemented token-based deduplication in `shortenProductName` to prevent redundant brand/category tags.
- **Roadmap Update**: Refined the roadmap to prioritize data integrity and clearly mark pending SQL migrations.

### Current Position
- **Inventory Sync**: ✅ Verified (Logic level)
- **Phase 10**: 🟡 Code complete — **PENDING**: SQL migrations must be run in Supabase.
- **Phase 9**: ⬜ Not Started (DSC Systems Data Integration)
- **Milestone**: v2.1 Performance & Accuracy Stability

### ⚠️ Action Required — SQL Migrations
The following tables must be created via Supabase SQL Editor for Phase 10 (Hierarchical Inventory) to be fully functional:
1. `inv_categories`
2. `inv_locations`
3. `inv_stocktakes`
4. `inv_stocktake_items`
5. `ALTER TABLE products` (Add category_id, location_id, etc.)

### Next Steps
1. **Sync Preview**: Implement the "Sync Preview" UI for DSC integration (Phase 9).
2. **UAT**: Cross-workspace validation of a full daily cycle.
