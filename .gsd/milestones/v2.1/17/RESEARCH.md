# RESEARCH: Advanced Reporting & Analytics (Phase 17)

## Objective
Standardize reporting logic and improve performance for heavy computations in Tax and Profit analysis.

## Findings

### Current State
1. **TaxDashboard.tsx**:
   - Fetches raw sales and purchases using `useTaxData`.
   - Computes VAT totals, Gross/Net sales, and VAT payable using `useMemo` in the component.
   - Computes BIR-specific classifications (vatable, exempt, zero-rated) on the fly.
2. **ReportModal.tsx**:
   - Performs ad-hoc Supabase queries for sales, expenses, and purchases.
   - Manually iterates through data to build a `ReportRow[]` array.
   - Directly calls `exportToCSV`.
3. **useTaxData.ts**:
   - Fetches data based on date ranges.
   - No centralized "ReportService" for business logic.

### Proposed Architecture

#### 1. Report Service (`src/features/reports/services/reportService.ts`)
- Move all computation logic (VAT sums, net calculations, row preparation) here.
- Add utility functions for BIR compliance calculations.

#### 2. Enhanced Hooks (`src/features/reports/hooks/useReports.ts`)
- Consolidate common reporting queries.
- Use the service layer to transform raw data into "Report View Models".

#### 3. Standardized Export Utils
- Ensure `exportUtils.ts` handles all edge cases for BIR journals.

## Discovery Level: 2 (Standard Research)
- **Decision**: Centralize computation in service layer instead of components.
- **Risk**: Medium (Ensuring accuracy of tax calculations).
