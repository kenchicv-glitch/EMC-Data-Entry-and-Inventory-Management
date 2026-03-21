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
