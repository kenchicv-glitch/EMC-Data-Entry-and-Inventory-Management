# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.1 Refactor & Stabilization

## Must-Haves (from SPEC)
- [ ] 0 remaining ESLint/TypeScript errors/warnings across the project.
- [ ] UI components contain minimal business logic.
- [ ] Global utility functions are consistently used for all date and currency formatting.
- [ ] Data updates immediately reflect across different components.

## Phases

### Phase 1: Code Quality & Linting Baseline
**Status**: ⬜ Not Started
**Objective**: Resolve all existing ESLint and TypeScript errors to establish a clean baseline. Standardize formatting and naming conventions.
**Requirements**: REQ-02, REQ-03

### Phase 2: Dependency & State Audit
**Status**: ⬜ Not Started
**Objective**: Standardize the usage of `react-query` and `supabase-js`. Ensure query keys are typed and centralized.
**Requirements**: REQ-04, REQ-05

### Phase 3: Architectural Refactoring
**Status**: ⬜ Not Started
**Objective**: Extract business logic and data fetching from UI components into custom hooks and services across all features.
**Requirements**: REQ-01

### Phase 4: Data Consistency & Formatting
**Status**: ⬜ Not Started
**Objective**: Standardize currency/date formatting app-wide. Resolve any cache invalidation or real-time sync issues.
**Requirements**: REQ-06, REQ-07, REQ-08
