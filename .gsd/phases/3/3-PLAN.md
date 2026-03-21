---
phase: 3
plan: 1
wave: 1
---

# Plan 3.1: Verification & Analytics Parity

## Objective
Audit the entire Profit Analysis dashboard to ensure all charts, labels, and KPI cards correctly reflect the chosen VAT mode.

## Context
- src/features/dashboard/ProfitAnalysis.tsx
- src/features/reports/services/reportService.ts

## Tasks

<task type="checkpoint:human-verify">
  <name>Verify Toggle Parity — Pie & Bar Charts</name>
  <files>
    - src/features/dashboard/ProfitAnalysis.tsx
  </files>
  <action>
    - Open the Profit Analysis page.
    - Toggle VAT-Inclusive ON and OFF.
    - Observe the "Profit by Master Category" Pie Chart.
    - Confirm the "Revenue vs Margin" Bar Chart values shift accordingly.
  </action>
  <verify>Visual confirmation of data shifting on toggle.</verify>
  <done>
    All chart values update dynamically based on the toggle.
  </done>
</task>

<task type="auto">
  <name>Final Audit: Effective Gross Margin calculation</name>
  <files>
    - src/features/dashboard/ProfitAnalysis.tsx
  </files>
  <action>
    - Re-check line 131 in `ProfitAnalysis.tsx`.
    - Ensure `stats.grossProfit` and `stats.totalRevenue` from the service are used.
    - Ensure the logic for "Negative Margin Alert" (line 216) correctly triggers in both modes.
  </action>
  <verify>Check component source code for calculation logic.</verify>
  <done>
    KPI card correctly calculates % using the current toggle state.
  </done>
</task>

## Success Criteria
- [ ] No "bleed" exists (Margins are raw when Inclusive, tax-exclusive when Exclusive).
- [ ] Performance remains high during toggle transitions.
