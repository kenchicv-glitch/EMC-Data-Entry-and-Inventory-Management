# ROADMAP.md

> **Current Phase**: Post-Implementation Maintenance
> **Milestone**: v2.1 Performance & Accuracy Stability

## Milestone Goals
- [x] Corrected Gross Profit calculation (Revenue - COGS) with optional VAT.
- [x] VAT-Inclusive toggle in Profit Analysis dashboard.
- [x] Accurately reflected category distribution matching raw SRP totals.
- [x] Performant Inventory search without navigation freezes.
- [x] **Canonical 10-category system across all inventory modules.**
- [x] **Universal color-coding and visibility for master categories.**

## Phases

### Phase 1-7: Feature Parity & Stability (Legacy GSD)
**Status**: ✅ Completed
**Objective**: Initial build and stability fixes for profit logic, inventory categorization, and navigation freezes.

### Phase 8: GSD Codebase Mapping & Modernization
**Status**: 🚀 Active
**Objective**: Transition from legacy `.gsd` to `.planning` structure and create comprehensive codebase maps.
- [x] Technical Stack Mapping (`STACK.md`, `INTEGRATIONS.md`).
- [x] Architectural & Structural Documentation (`ARCHITECTURE.md`, `STRUCTURE.md`).
- [x] Code Quality & Testing Audit (`CONVENTIONS.md`, `TESTING.md`).
- [x] Identification of Technical Debt (`CONCERNS.md`).

### Phase 9: Quality & Verification (Wave 3)
**Status**: ⏳ Pending
**Objective**: Implement automated tests for `ReportService.ts` and audit UI patterns.

### Phase 10: Sales Window Refinements
**Status**: 🚀 Active
**Objective**: Refine Sales Window logic (counters, UX, summary format) and remove fulfillment.
- [ ] OS daily counter reset logic.
- [ ] Editable invoice number enforcement.
- [ ] Hover-based customer selection UX.
- [ ] Adjustment container styling & naming.
- [ ] Invoice summary layout update in dashboard.

---
*Roadmap updated: 2026-03-24*
