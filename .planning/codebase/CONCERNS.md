# Codebase Concerns

**Analysis Date:** 2026-03-24

## Tech Debt

**Low Automated Test Coverage:**
- Issue: Only one test file (`reportService.test.ts`) exists for a codebase with 12+ feature modules.
- Impact: High risk of regressions in critical financial calculations (Sales, Taxes, Profits).
- Fix approach: Gradually implement unit tests for all services in `src/shared/services/` and feature-specific logic.

**Inconsistent Modal UX:**
- Issue: Modals across different features may lack consistent centering and scroll-locking behavior.
- Files: `SalesModal.tsx`, `PurchaseModal.tsx`, `ProductModal.tsx`, etc.
- Why: Organic growth and varying implementation dates.
- Impact: Degraded user experience and visual jitter.
- Fix approach: Audit all modal components and standardize using a shared `Modal` wrapper or consistent CSS patterns.

## Known Bugs

**No critical bugs currently identified via grepping or initial audit.**

## Security Considerations

**Role-Based Access Control (RBAC):**
- Risk: Potential for unauthorized access if permission guards (`EncoderGuard`, `OwnerGuard`) are not consistently applied to all sensitive routes/components.
- Current mitigation: Route-level guards in `App.tsx` and some component-level checks.
- Recommendations: Audit all features (especially `reports/` and `inventory/` prices) to ensure SRP data and admin functions are only accessible to the correct roles.

## Fragile Areas

**Financial Calculations in `ReportService.ts`:**
- Why fragile: Handles core tax (VAT) and profit logic. Small changes can have large accounting impacts.
- Common failures: Incorrect tax subtraction or rounding errors.
- Safe modification: Always run `npm test` and add a new test case for any logic change in this service.

## Missing Critical Features

**Audit Logging:**
- Problem: No comprehensive audit trail for sensitive actions (e.g., price changes, deletions).
- Current workaround: Relying on Supabase timestamps and manual review.
- Blocks: Accountability in multi-user environments.

---

*Concerns audit: 2026-03-24*
