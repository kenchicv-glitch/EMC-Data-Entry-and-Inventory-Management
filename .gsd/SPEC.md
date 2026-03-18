# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
A comprehensive technical debt reduction and codebase stabilization phase for the EMC Retail OS. The goal is to elevate the codebase quality by enforcing consistent architectural patterns, optimizing dependency usage, and ensuring reliable, real-time data consistency across all views.

## Goals
1. **Architectural Cleanup**: Sweep across all features to move business logic from components into dedicated hooks and services. Enforce consistent naming conventions and resolve existing linting errors.
2. **Dependency Audit & Optimization**: Standardize the initialization and usage of core dependencies, specifically `@tanstack/react-query`, `@supabase/supabase-js`, and `react-hook-form`, ensuring they follow best practices for performance and maintainability.
3. **Data Consistency & Synchronization**: Resolve state management issues leading to out-of-sync caches. Ensure real-time updates function correctly and standardize data formatting (dates, currency) globally.

## Non-Goals (Out of Scope)
- Adding new user-facing features (unless required to fix consistency bugs).
- Changing the underlying technology stack (e.g., swapping Vite for Next.js or Supabase for Firebase).
- Major UI/UX redesigns unrelated to data presentation consistency.

## Users
- Future and current developers maintaining the codebase.
- End-users (Owners, Encoders) who will experience a less buggy, more consistent, and robust application.

## Constraints
- **Technical**: Must adhere to the existing React/Vite/Tailwind/Supabase stack outlined in `.gsd/STACK.md`.
- **Architectural**: Must respect the existing domain-driven feature folder structure.

## Success Criteria
- [ ] 0 remaining ESLint/TypeScript errors/warnings across the project.
- [ ] UI components contain minimal business logic (data fetching/mutations are extracted to custom hooks/services).
- [ ] `react-query` query keys and mutations are centralized and strictly typed.
- [ ] Global utility functions are consistently used for all date and currency formatting.
- [ ] Data updates immediately reflect across different components without requiring manual page refreshes (cache invalidation/optimistic updates function correctly).
