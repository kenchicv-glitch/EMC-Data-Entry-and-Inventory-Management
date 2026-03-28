# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
[project-root]/
├── .agent/             # GSD workflows and skills
├── .gsd/               # Legacy project state (to be migrated)
├── .planning/          # New project state and codebase maps
├── public/             # Static assets (favicons, etc.)
├── src/                # Source code
│   ├── assets/         # Images, fonts, and shared styles
│   ├── features/       # Feature-modular application code
│   │   ├── auth/       # Login and settings
│   │   ├── dashboard/  # Analytics and command center
│   │   ├── inventory/  # Central and branch inventory
│   │   ├── sales/      # POS and refunds
│   │   └── transfers/  # Inter-branch stock movement
│   └── shared/         # Common code used across features
│       ├── components/ # Generic UI components
│       ├── context/    # Shared React contexts
│       ├── hooks/      # Common application hooks
│       ├── lib/        # Third-party library initializations
│       ├── services/   # Centralized business logic
│       └── types/      # Global TypeScript definitions
├── package.json        # Project manifest
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite build configuration
```

## Directory Purposes

**src/features/:**
- Purpose: Business domain modules.
- Contains: Feature-specific components, hooks, services, and types.
- Subdirectories: `auth/`, `inventory/`, `sales/`, `transfers/`, etc.

**src/shared/:**
- Purpose: Reusable application infrastructure.
- Contains: Global services (`services/`), shared hooks (`hooks/`), and UI library (`components/`).
- Key locations: `src/shared/lib/` for Supabase and TanStack Query setup.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React application mount point.
- `src/App.tsx`: Routing, global providers, and guarded routes.

**Configuration:**
- `package.json`: Dependencies and scripts.
- `vite.config.ts`: Dev server and bundling options.
- `tsconfig.json`: TypeScript compiler rules.
- `.env`: Environment-specific variables (Supabase URL/Key).

**Core Logic:**
- `src/shared/services/ReportService.ts`: Centralized financial and tax logic.
- `src/shared/lib/supabase.ts`: Supabase client instance.

## Naming Conventions

**Files:**
- `PascalCase.tsx`: React components (e.g., `Inventory.tsx`).
- `camelCase.ts`: Utilities, services, and hooks (e.g., `useAuth.ts`, `userService.ts`).
- `kebab-case.css`: Style files (e.g., `index.css`).

**Directories:**
- `kebab-case`: All directories in `src/features/` and `src/shared/`.

## Where to Add New Code

**New Feature (e.g., "Expenses"):**
- Create `src/features/expenses/`.
- Add `Expenses.tsx` (main view).
- Add `hooks/`, `services/`, `components/` subdirectories as needed.
- Register route in `src/App.tsx`.

**New Shared Logic:**
- Add to `src/shared/services/` if it's a domain service.
- Add to `src/shared/hooks/` if it's a reusable UI/State hook.

**Global Types:**
- Add to `src/shared/types/` for data models shared across features.

---

*Structure analysis: 2026-03-24*
