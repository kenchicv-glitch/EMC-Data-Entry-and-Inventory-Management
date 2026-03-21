# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
To provide a highly accurate, real-time financial reporting layer that correctly reflects business profitability. This includes precise calculation of Gross and Net profits by ensuring revenue figures are correctly handled (with/without VAT) based on user preference.

## Goals
1. **Accurate Profit Computation**: Fix the current bleed in profit analytics where VAT subtraction leads to lower-than-expected profit figures.
2. **Flexible Revenue Analysis**: Implement a "VAT Inclusive" toggle for the revenue dashboard to allow owners to see both raw SRP-based revenue and net tax-exclusive revenue.
3. **Consistent Cost Tracking**: Ensure COGS (Cost of Goods Sold) is accurately matched against revenue periods.

## Non-Goals (Out of Scope)
- Comprehensive tax filing/submission (BIR-specific forms).
- Automated bank reconciliation.

## Users
- **Owners**: Main consumers of profit analytics to make business decisions.
- **Accountants**: Users who need to see the breakdown of VAT and net sales.

## Constraints
- **Financial Precision**: Must match the user's manual calculations (e.g., SRP 7650 - COGS 6375 = Gross Profit 1275).
- **UI Consistency**: Must maintain the existing premium aesthetics while adding new controls.

## Success Criteria
- [ ] Profit Analysis shows Gross Profit of 1275 for SRP 7650 and COGS 6375.
- [ ] A functional toggle in the Net Revenue card switches between VAT-inclusive and VAT-exclusive views.
- [ ] Calculations remain consistent across category-based breakdown charts.
