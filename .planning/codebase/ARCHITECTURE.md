# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Feature-based React SPA with Centralized Shared Services.

**Key Characteristics:**
- **Feature-Modular**: Code is organized by domain features (Sales, Inventory, Transfers, etc.) in `src/features/`.
- **Shared Service Layer**: Centralized business logic in `src/shared/services/`.
- **Global Context Management**: App-wide state (Auth, Workspace, Branch) managed in `src/shared/lib/` and `src/shared/context/`.
- **Role-Based Routing**: Access control enforced at the routing level via `EncoderGuard` and `OwnerGuard`.

## Layers

**UI Layer (Components):**
- Purpose: Render data and handle user interaction.
- Contains: React components, styled with Tailwind CSS.
- Location: `src/features/*/components/` and `src/shared/components/`.
- Depends on: Hooks and Services.

**Logic Layer (Hooks & Services):**
- Purpose: Encapsulate shared business logic and state synchronization.
- Contains: `ReportService.ts`, `transferService.ts`, `userService.ts`, and various custom hooks.
- Location: `src/shared/services/` and `src/shared/hooks/`.
- Depends on: Lib (Supabase, react-query).

**Data Layer (Lib & External):**
- Purpose: Data fetching, persistence, and external communication.
- Contains: Supabase client, query client, and types.
- Location: `src/shared/lib/` and `src/shared/types/`.
- Depends on: Supabase, TanStack Query.

## Data Flow

**Typical Feature Workflow (e.g., Sales Entry):**
1. **Entry**: User interacts with a component in `src/features/sales/`.
2. **Action**: Component calls a mutation hook from `src/features/sales/hooks/` or a shared service.
3. **Logic**: Service processes the data (e.g., calculating tax in `ReportService.ts`).
4. **Persistence**: Data is sent to Supabase via the client in `src/shared/lib/supabase.ts`.
5. **Update**: `react-query` invalidates relevant keys, triggering a UI refresh across the app (Real-time updates often used).

**State Management:**
- **Server State**: Managed by `@tanstack/react-query`.
- **Global UI State**: Managed via React Context in `src/shared/lib/` (Auth, Workspace).
- **Local state**: Standard `useState` / `useReducer` within components.

## Key Abstractions

**Feature Module:**
- Purpose: Encapsulate all logic, components, and types for a specific business domain.
- Examples: `src/features/inventory/`, `src/features/transfers/`.

**Shared Service:**
- Purpose: Centralized logic that spans multiple features.
- Examples: `ReportService.ts` for financial logic, `userService.ts` for profile management.
- Pattern: Modular exports.

**Context Provider:**
- Purpose: Provide global access to critical state (Auth, Branch context).
- Examples: `AuthContext.tsx`, `WorkspaceContext.tsx`.

## Entry Points

**Main Entry:**
- Location: `src/main.tsx`
- Triggers: Browser load.
- Responsibilities: Mount the React app and initialize styles.

**Routing & Guards:**
- Location: `src/App.tsx`
- Responsibilities: Define all routes and wrap protected routes in permission guards (`EncoderGuard`, `OwnerGuard`).

## Error Handling

**Strategy:** Exception bubbling with global toast notifications for feedback.

**Patterns:**
- `sonner` for displaying success/error messages to the user.
- `try/catch` blocks in services and mutation hooks to handle Supabase/API errors.
- Null checks and "maybe" queries (e.g., `maybeSingle()`) for robust data fetching.

## Cross-Cutting Concerns

**Logging:**
- `console.error` for dev-time error tracking.

**Validation:**
- `zod` schemas for form validation and data integrity.

**Styling:**
- Utility-first CSS using Tailwind CSS 4.1.

---

*Architecture analysis: 2026-03-24*
