# STATE.md

## Current Milestone
**v2.2 — Data Integrity & DSC Integration** *(just started)*

---

## Last Session Summary
**Milestone v2.1 — Performance & Accuracy Stability**: ✅ **COMPLETE & ARCHIVED**

### v2.1 Key Accomplishments
- Corrected Gross Profit calculations with VAT toggle
- Full hierarchical inventory system (160+ categories, 810 products × 3 branches)
- Admin Pricelist connected to live inventory stock
- `inventory_adjustments` audit trail for Sales, Deletes, Refunds
- Atomic stock decrement/restore logic in `salesService`
- All TypeScript build errors resolved — project deploys cleanly
- Milestone archive at `.gsd/milestones/v2.1/SUMMARY.md`

---

## Current Position
- **Milestone**: v2.2 — Data Integrity & DSC Integration
- **Active Phase**: None — ready to plan
- **Next Action**: Run `/plan` or `/progress` to begin Phase FIX-2 or Phase DB

---

## ⚠️ Highest Priority Items

### 1. SQL Migrations (BLOCKING)
The following tables must be created in Supabase before Phase 10 inventory features are fully usable:
1. `inv_categories`
2. `inv_locations`
3. `inv_stocktakes`
4. `inv_stocktake_items`
5. `ALTER TABLE products` (add `category_id`, `location_id`, `low_stock_threshold`)

### 2. Stock Sync Verification
Stock decrement logic is implemented but has NOT been verified in production.
Run the encoder simulation path to confirm end-to-end integrity.

---

## Open Decisions
- None pending. All ADRs from v2.1 are accepted and stable.

## Known Risks
- Race condition in `SalesModal` during rapid multi-item entry (unaudited)
- DSC sync may create duplicate records if re-triggered without idempotency guard
