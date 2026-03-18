# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.0 Inventory Coordination

## Must-Haves (from SPEC)
- [ ] Real-time "Stock Request" notification system via Bell icon.
- [ ] Full "Request → Approve → Ship → Receive" lifecycle tracking.
- [ ] Atomic stock updates (deduct from source, add to dest) with zero desync.
- [ ] Historical audit log for all branch transfers.

## Phases

### Phase 1: Infrastructure & Real-time Base
**Status**: [x] Completed
**Objective**: Provision the `stock_transfers` and `notifications` tables. Set up real-time subscriptions and basic services.
**Requirements**: REQ-SETUP-01, REQ-SETUP-02

### Phase 2: Global Notification System
**Status**: [x] Completed
**Objective**: Build the notification modal reachable from the Bell icon. Implement the "New Request" alert logic.
**Requirements**: REQ-UI-01

### Phase 3: The Transfer Request Engine
**Status**: [x] Completed
**Objective**: Create the "Request Stock" UI in the Inventory dashboard. Implement the logic to create transfer records.
**Requirements**: REQ-TX-01

### Phase 4: Approval & Fulfillment Logic
**Status**: [x] Completed
**Objective**: Build the "Pending Transfers" view for target branches. Implement the "Approve/Ship" logic with stock deductions.
**Requirements**: REQ-TX-02, REQ-TX-03

### Phase 5: Receiving & Closing
**Status**: [x] Completed
**Objective**: Implement the receiving workflow. Update destination inventory levels and finalize the transfer state.
**Requirements**: REQ-TX-04

### Phase 10: Multi-Item & Calendar Integration
**Status**: [x] Completed
**Objective**: Transition to bulk transfers. Add `items` JSONB support and a smart calendar filter to the dashboard.

### Phase 11: UI Modernization (Compact Mode)
**Status**: [x] Completed
**Objective**: Refactor the Transfers interface into a compact, invoice-like layout with better text visibility and reduced white space.

### Phase 12: Reversal Fix & Phantom Stock
**Status**: [x] Completed
**Objective**: Solve the "swapped" source/destination issue. Refactor modal to be bidirectional and fix action button visibility.

### Phase 13: Voiding & Stock Rollback
**Status**: [x] Completed
**Objective**: Implement an owner-only "Delete X" button that automatically reverses stock movements across branches for voided transfers.

### Phase 14: Editing & Undo for Transfers
**Status**: [x] Completed
**Objective**: Allow users to edit pending requests and grant owners the authority to restore/reactivate cancelled transfers.

### Phase 15: Modal UX & Scroll Locking
**Status**: [x] Completed
**Objective**: Implement consistent scroll locking and centered positioning for all system-wide modals to ensure a premium, focused user experience.

### Phase 16: Engineering Excellence & System Stability
**Status**: [ ] Planned
**Objective**: Hardening the system by refactoring business logic, resolving TS/Lint errors, standardizing Supabase/React Query usage, and verifying real-time data integrity.
**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08
