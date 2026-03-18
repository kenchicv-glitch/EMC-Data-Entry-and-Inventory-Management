# ARCHITECTURE.md

## Overview
This system enables branches to coordinate inventory through structured transfers.

## Key Components

### 1. Data Layer (Postgres)
- **`stock_transfers`**: Tracks the state and metadata of every movement.
- **`notifications`**: User-specific alerts for actions required.

### 2. Logic Layer (Transfer Engine)
- **Direct Move**: (Admin/Owner only) Immediate stock relocation.
- **Workflow Move**: (Encoder) Involves approval and digital signature at each stage.

### 3. UI Layer
- **Notification Bell**: Live listener for target-branch alerts.
- **Inventory Actions**: Modal-based request trigger.
- **Transfer Dashboard**: Central monitoring of all in-transit items.
