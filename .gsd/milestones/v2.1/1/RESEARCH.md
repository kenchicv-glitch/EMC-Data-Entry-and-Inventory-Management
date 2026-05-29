# Research: Phase 1 — Financial Logic Refactor

## Objective
Reconcile the "profit bleed" reported by the user and implement a default-exclusive, toggle-inclusive VAT logic for the Profit Analysis dashboard.

## Findings

### 1. Current State of `reportService.ts`
- **Logic**: `calculateProfitMetrics` supports an `includeVat` toggle.
- **Default**: `includeVat = true` (Revenue = Gross - Discounts).
- **Profit Calculation**: `Gross Profit = Revenue - COGS`.
- **The "Bleed"**: If the user is seeing "lower than expected" figures, it might be due to:
    - `vat_amount` being deducted from `total_price` in the database query before reaching the service (unlikely).
    - Or, the existing implementation might be subtracting VAT by default in some areas while the user expects Gross margins.
    - Actually, `calculateProfitMetrics` at line 105: `netRevenue = grossRevenue - totalVAT - totalDiscounts` (VAT sub).

### 2. User Requirement Re-Analysis
- **Desired Result**: SRP (7650) - COGS (6375) = 1275 Gross Profit.
- **User Preference**: "at default do not include the vat, instead put a toggle ... for vat inclusive."
- **Interpretation**: 
    - **Default (VAT Exclusive)**: Revenue = Net Sales (excl. VAT). Profit = Net Sales - COGS. (This will be lower than 1275).
    - **Toggled (VAT Inclusive)**: Revenue = Gross Sales (incl. VAT). Profit = Gross Sales - COGS. (This will be 1275).
- **Current Issue**: The user feels the system is "bleeding" profit because it currently defaults (or is stuck) in the exclusive view/subtraction mode in their perspective.

### 3. Missing Data Points
- **Returns & Refunds**: `calculateProfitMetrics` only takes `sales` and `expenses`. It does not account for `returns` or `refunds` which would lower revenue and profit.
- **Service Parity**: `calculateCategoryProfit` and `calculateProfitMetrics` must use identical logic.

## Proposed Logic Update
1. Change `includeVat` default to `false` in `ReportService`.
2. Ensure `ProfitAnalysis` state starts as `false`.
3. Add `returns` and `refunds` to the `useProfitData` hook and passing them to `calculateProfitMetrics`.
4. Audit `total_price` source to ensure it really matches the 7650/SRP inclusive figure.

## Verification Plan
1. Mock data with SRP 7650, COGS 6375.
2. Verify Profit = 1275 when Toggle = ON.
3. Verify Profit = (7650/1.12) - 6375 when Toggle = OFF.
