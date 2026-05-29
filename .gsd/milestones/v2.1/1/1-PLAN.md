---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Financial Logic — Revenue & VAT Synchronization

## Objective
Implement a default VAT-exclusive revenue model while enabling a toggle for Gross Sales (VAT-inclusive) reporting. This includes ensuring all service methods use the same logic and account for refund/return deductions.

## Context
- .gsd/SPEC.md
- src/features/reports/services/reportService.ts
- src/features/reports/hooks/useProfitData.ts

## Tasks

<task type="auto">
  <name>Refactor reportService.ts for VAT defaults and Return handling</name>
  <files>
    - src/features/reports/services/reportService.ts
  </files>
  <action>
    - Change default `includeVat` to `false` in `calculateProfitMetrics` and `calculateCategoryProfit`.
    - Update `ProfitMetrics` interface to include `totalRefunds`.
    - Update `calculateProfitMetrics` to accept `refunds: any[]` and `returns: any[]`.
    - Subtract `refunds` from `netRevenue` and `grossProfit`.
    - Subtract `returns` from `totalCOGS` (since inventory is returned).
    - Ensure `calculateCategoryProfit` handles refunds similarly.
  </action>
  <verify>Check interface definitions and service parameters.</verify>
  <done>
    `calculateProfitMetrics` and `calculateCategoryProfit` both default to `includeVat = false`.
  </done>
</task>

<task type="auto">
  <name>Update useProfitData hook to fetch and pass refund/return data</name>
  <files>
    - src/features/reports/hooks/useProfitData.ts
  </files>
  <action>
    - Add `queries` to fetch `refunds` and `returns` from Supabase (mirroring `sales` query).
    - Pass the new data arrays to `ReportService.calculateProfitMetrics`.
    - Pass the new data arrays to `ReportService.calculateCategoryProfit`.
    - Change `includeVat` default to `false`.
  </action>
  <verify>Check that return/refund queries are executed.</verify>
  <done>
    Hook correctly passes all 4 data arrays (sales, expenses, refunds, returns) to the report service.
  </done>
</task>

## Success Criteria
- [ ] `calculateProfitMetrics` defaults to `includeVat = false`.
- [ ] Refunds and Returns are included in the math.
- [ ] Unit tests (if any) or manual verification shows SRP 7650 - COGS 6375 = 1275 ONLY when `includeVat` is true.
