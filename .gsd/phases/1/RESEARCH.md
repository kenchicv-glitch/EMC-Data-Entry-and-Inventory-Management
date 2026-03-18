# Phase 1 Research: Code Quality & Linting Baseline

## Automated Checks Output

### TypeScript Compiler (`tsc --noEmit`)
- **Status**: Passed (0 errors). The baseline strictly-typed code is fundamentally sound.

### ESLint (`npm run lint`)
- **Status**: Failed with 104 problems (81 errors, 23 warnings).

#### Error Categories:
1. **`@typescript-eslint/no-explicit-any`** (Many instances): Used across dashboard, inventory, purchases, sales, suppliers, and utils. This reveals a tendency to bypass the type system for complex or dynamic API responses.
2. **`react-hooks/exhaustive-deps`** (Many instances): Missing dependencies or complex expressions in `useEffect`/`useCallback` dependency arrays, specifically around data fetching functions like `fetchData`, `fetchProducts`.
3. **`react-hooks/set-state-in-effect`** (6 instances): Synchronous `setState` calls inside effects that trigger cascading renders. This is a performance bottleneck.
   - Files: `Login.tsx`, `Settings.tsx`, `AdminCommandCenter.tsx`, `AdminPricelist.tsx`, `Calendar.tsx`, `BranchContext.tsx`.
4. **`react-refresh/only-export-components`** (3 instances): Exporting non-component constructs from component files (e.g., in Context files).
   - Files: `AuthContext.tsx`, `BranchContext.tsx`, `WorkspaceContext.tsx`.
5. **`prefer-const`** (4 instances): Variables declared with `let` that are never reassigned.
6. **`react-hooks/incompatible-library`** (1 instance): `useForm().watch()` used in a way that breaks memoization inside `SupplierModal.tsx`.

### Actionable Strategy for Phase 1
Due to the aggressive atomicity requirement (2-3 tasks max per plan), fixing 104 errors should be broken down by error category:

- **Wave 1, Plan 1**: Structural React Errors (Fix Context exports & `setState` in effects).
- **Wave 1, Plan 2**: React Hooks Warnings (Fix exhaustive-deps, prefer-const, and incompatible library).
- **Wave 2, Plan 3**: Strict Typing (Resolve all `any` types by creating or utilizing proper interfaces).
