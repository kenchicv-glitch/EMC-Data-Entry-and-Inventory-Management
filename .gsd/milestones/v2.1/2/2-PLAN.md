---
phase: 2
plan: 1
wave: 1
---

# Plan 2.1: UI Context & Toggle Integration

## Objective
Ensure the Profit Analysis UI correctly reflects the new default VAT-exclusive logic and provides a working toggle for VAT-inclusive views.

## Context
- src/features/dashboard/ProfitAnalysis.tsx

## Tasks

<task type="auto">
  <name>Synchronize ProfitAnalysis.tsx with default VAT state</name>
  <files>
    - src/features/dashboard/ProfitAnalysis.tsx
  </files>
  <action>
    - Change `isVatInclusive` state default to `false`.
    - Ensure the `MetricCard` for "Net Revenue" reflects the new default text (e.g., "(excl)" instead of "(incl)").
    - Verify that flipping the toggle correctly triggers a re-fetch or re-calculation through the hook.
  </action>
  <verify>Check state defaults and UI text in `ProfitAnalysis.tsx`.</verify>
  <done>
    `isVatInclusive` defaults to `false`. UI labels indicate "Exclusive" view by default.
  </done>
</task>

## Success Criteria
- [ ] Dashboard opens with VAT-exclusive revenue by default.
- [ ] Toggle button visually reflects the current state (Inclusive vs Exclusive).
- [ ] Labels update dynamically based on the toggle.
