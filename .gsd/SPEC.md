# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
To build a seamless, real-time coordination layer for the EMC Retail OS that enables branches to request, transfer, and receive stock efficiently. This system will replace manual communication with a structured "Request → Approve → Ship → Receive" workflow, ensuring data consistency and inventory accuracy across all locations.

## Goals
1. **Inter-Branch Stock Transfers**: Implement a robust workflow for moving inventory between branches with clear status tracking (Pending, Approved, Shipped, Received).
2. **Real-time Notifications**: Integrate a notification system into the global UI (Bell icon) to alert encoders in target branches of new requests or status updates.
3. **Data Integrity & Consistency**: Ensure that every transfer accurately reflects in the `products` table stock levels at each stage (e.g., deducting on ship, adding on receive) without reconciliation errors.

## Non-Goals (Out of Scope)
- Automatic reordering from suppliers (covered by a separate procurement module).
- Physical logistics/shipping courier integration.
- General user-to-user chat system.

## Users
- **Encoders**: Primary users who will request stock and process incoming/outgoing transfers.
- **Owners/Admins**: Users who will monitor global stock movement and approve/audit transfers.

## Constraints
- **Technical**: Must support real-time updates using Supabase Realtime/Triggers.
- **Consistency**: Must adhere strictly to the existing Excel-based category hierarchy and product naming conventions.

## Success Criteria
- [ ] Users receive a visual notification (Bell icon update) within 2 seconds of a transfer request being made.
- [ ] Stock levels in the `products` table correctly update at each stage of the transfer lifecycle.
- [ ] A dedicated "Transfers" dashboard or modal allows users to track all active and historical movements.
- [ ] 0 items lost in transit due to system-level data desync.
