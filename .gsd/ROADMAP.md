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
**Status**: ⬜ Not Started
**Objective**: Provision the `stock_transfers` and `notifications` tables. Set up real-time subscriptions and basic services.
**Requirements**: REQ-SETUP-01, REQ-SETUP-02

### Phase 2: Global Notification System
**Status**: ⬜ Not Started
**Objective**: Build the notification modal reachable from the Bell icon. Implement the "New Request" alert logic.
**Requirements**: REQ-UI-01

### Phase 3: The Transfer Request Engine
**Status**: ⬜ Not Started
**Objective**: Create the "Request Stock" UI in the Inventory dashboard. Implement the logic to create transfer records.
**Requirements**: REQ-TX-01

### Phase 4: Approval & Fulfillment Logic
**Status**: ⬜ Not Started
**Objective**: Build the "Pending Transfers" view for target branches. Implement the "Approve/Ship" logic with stock deductions.
**Requirements**: REQ-TX-02, REQ-TX-03

### Phase 5: Receiving & Closing
**Status**: ⬜ Not Started
**Objective**: Implement the receiving workflow. Update destination inventory levels and finalize the transfer state.
**Requirements**: REQ-TX-04
