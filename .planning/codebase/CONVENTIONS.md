# Coding Conventions

**Analysis Date:** 2026-03-24

## Naming Patterns

**Files:**
- `PascalCase.tsx`: React components (e.g., `Inventory.tsx`, `AdminPricelist.tsx`).
- `camelCase.ts`: Services, hooks, and logic modules (e.g., `reportService.ts`, `useAuth.ts`).
- `*.test.ts`: Test files, collocated with the source (e.g., `reportService.test.ts`).

**Functions:**
- `camelCase`: All functions and methods.
- `handle[Event]`: Event handlers (e.g., `handleAuthAction`).

**Variables:**
- `camelCase`: Local variables and state.
- `UPPER_SNAKE_CASE`: Constants (implied standard, though few seen).

**Types:**
- `PascalCase`: Interfaces and type aliases.
- No `I` prefix for interfaces.

## Code Style

**Formatting:**
- Indentation: 4 spaces (observed in `App.tsx` and `AuthContext.tsx`).
- Quotes: Single quotes for strings.
- Semicolons: Required.

**Linting:**
- ESLint 9.x with `eslint.config.js`.
- Rules extend `@eslint/js`, `typescript-eslint`, and `react-hooks`.

## Import Organization

**Order:**
1. React and third-party libraries (`@supabase/supabase-js`, `lucide-react`, etc.).
2. Internal shared modules (`./shared/lib`, etc.).
3. Feature-specific imports.
4. Relative imports.
5. Type imports.

## Error Handling

**Patterns:**
- `try/catch`: Used in async services and auth logic.
- `console.error`: Used for logging errors in development.
- `sonner`: Used for user-facing error notifications.

## Comments

**When to Comment:**
- Documenting complex business rules (e.g., "1275 Profit Rule").
- Explaining the "why" behind specific logic branches.

---

*Convention analysis: 2026-03-24*
