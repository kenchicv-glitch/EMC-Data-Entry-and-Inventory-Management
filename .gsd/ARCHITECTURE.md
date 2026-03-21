# ARCHITECTURE.md

## Overview
This system enables branches to coordinate inventory through structured transfers, centralized price control, and unified category management. It follows a feature-based architecture with centralized shared services for data consistency and performance.

## Core Architectural Patterns

### 1. Unified Category Ecosystem
The system enforces a **Canonical Category List** of 10 master categories (Steel, Plywood, Electricals, etc.) across the entire Inventory, Branch Inventory, and Admin Pricelist modules.
- **Visibility**: All 10 categories are visible even if stock is zero.
- **Visual Identity**: Standardized color tokens (`getMasterColor`) are used application-wide.

### 2. Logic Layer & Reporting
- **`ReportService`**: A centralized singleton service for calculating complex profit metrics, handling VAT toggles, and processing returns/refunds data.
- **Service Layer**: Common operations are encapsulated in `transferService` and `userService` to ensure reusability and maintainability.

### 3. Data Flow & Performance
- **Optimized Searching**: Use of `useDeferredValue` in high-volume views (Inventory, Sales) to keep the UI responsive while filtering.
- **Lazy Loading**: Major feature modules are lazily loaded using `React.lazy` and `Suspense` to optimize initial bundle size.
- **Concurrency Protection**: Navigation and unmount checks in complex effects prevent state-update collisions and UI freezes during route transitions.

### 4. Authentication & Permissions
- **Role-Based Guards**: Access is controlled via `EncoderGuard` and `OwnerGuard` in `App.tsx`.
- **Permission Hooks**: `usePermissions` and `useAuth` provide granular access control within components.

## Key Components

### 1. Feature Modules
The application is divided into several feature-focused directories under `src/features/`:
- **Auth**: Login, settings, and user management.
- **Sales & Customer Refunds**: POS/Sales entry, express sales, and refund processing.
- **Inventory & Pricing**: Central inventory, branch inventory, and admin price control.
- **Purchases & Returns**: Supplier purchase orders and purchase returns.
- **Transfers**: Inter-branch stock movement lifecycle.
- **Expenses**: Tracking branch-specific expenses.
- **Dashboard & Analytics**: Daily summaries, profit analysis, and the Admin Command Center.
- **Reports**: Tax dashboards and generated summaries.
- **CRM**: Supplier and customer management.

### 2. Data Layer (Postgres)
- **`inventory` / `branch_inventory`**: Core product and stock tracking.
- **`stock_transfers`**: Lifecycle management for cross-branch movements.
- **`notifications`**: User-specific alerts for actions required.

### 3. UI Layer
- **Global Design System**: Standardized layouts, modals, and color tokens for a premium experience.
- **Modal Context**: Key workflows (Sales/Purchases) are globally accessible via hotkeys ('N'/'P').
- **Workspace/Branch Context**: Global state providers for automatic scoping of data based on current context.
