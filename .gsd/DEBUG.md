# Debug Session: Purchase Modal Navigation

## Symptom
Verified visibility and scrolling for product dropdown.

**When:** During data entry.
**Expected:** Tab cycles through list with clear black border on all sides; list scrolls to keep active item visible.
**Actual:** Initial 'outline' was clipped by overflow; scrolling was not automatic.

## Hypotheses
| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | Outline clipped by overflow-hidden | 100% | CONFIRMED |
| 2 | Missing scrollIntoView logic | 100% | CONFIRMED |

## Attempts
### Attempt 1
**Action:** Switched to ring-inset and added ref-based scrollIntoView.
**Result:** PASS. Verified in browser.

## Resolution
**Root Cause:** CSS 'outline' behavior and missing programmatic scroll sync.
**Fix:** Used ring-inset and scrollIntoView({ block: 'nearest' }).
**Verified:** Browser subagent confirmed all 4 sides visible and smooth scrolling.
