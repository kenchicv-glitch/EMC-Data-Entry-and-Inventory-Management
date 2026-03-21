---
phase: 4
plan: 1
wave: 1
---

# Plan 4.1: Inventory Search & Navigation Stability

## Objective
Prevent the application from freezing when navigating away from a filtered inventory search. This is achieved by offloading heavy filtering/expansion logic and limiting the amount of DOM nodes rendered simultaneously.

## Context
- src/features/inventory/Inventory.tsx

## Tasks

<task type="auto">
  <name>Implement Deferred Search and Expansion Thresholds</name>
  <files>
    - src/features/inventory/Inventory.tsx
  </files>
  <action>
    - Import `useDeferredValue` from 'react'.
    - Use `useDeferredValue(searchTerm)` to calculate `deferredSearchTerm`.
    - Update the `filtered` useMemo/logic to depend on `deferredSearchTerm`.
    - Update the auto-expansion `useEffect` to only run if `filtered.length < 100`.
    - If `filtered.length >= 100`, only expand the first level (L1) to keep the UI responsive.
  </action>
  <verify>Check that searching "a" (broad) doesn't freeze the unmount cycle.</verify>
  <done>
    Inventory remains interactive during broad searches and navigation is instantaneous.
  </done>
</task>

## Success Criteria
- [ ] Navigating to a different tab while a search is active does not cause a freeze.
- [ ] Large search results (>100 items) do not force-expand every sub-category.
