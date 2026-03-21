# Technology Stack

> Auto-updated on 2026-03-21

## Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | ^24.10.1 (Types) | Build tool / Package Management Environment |

## Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| React / React DOM | ^19.2.0 | Core UI Library & DOM manipulation |
| React Router DOM | ^7.13.0 | Client-side routing |
| @tanstack/react-query | ^5.90.21 | Server state management & data fetching |
| @tanstack/react-table | ^8.21.3 | Headless UI for building tables |
| @supabase/supabase-js | ^2.96.0 | Backend-as-a-service / Database Client |
| react-hook-form | ^7.71.2 | Form state management |
| zod / @hookform/resolvers | ^4.3.6 / ^5.2.2 | Schema validation |
| lucide-react | ^0.574.0 | Icon library |
| recharts | ^3.7.0 | Data visualization |
| date-fns / date-fns-tz | ^4.1.0 / ^3.2.0 | Date parsing/formatting |
| tailwind-merge / clsx | ^3.4.1 / ^2.1.1 | Tailwind CSS utility merging |
| sonner | ^2.0.7 | Toast notifications |
| exceljs / react-to-print | ^4.4.0 / ^3.0.4 | Export/Print functionality |

### Internal Services & Contexts
| Service | Location | Purpose |
|---------|----------|---------|
| ReportService | `ReportService.ts` | Centralized financial and tax calculations |
| transferService | `transferService.ts` | Inter-branch stock movement logic |
| userService | `userService.ts` | User profile and permission management |
| Workspace Context | `WorkspaceContext.tsx` | Global workspace state management |
| Auth Context | `AuthContext.tsx` | User authentication state management |
| Modal Context | `ModalContext.tsx` | Global modal workflow management |

## Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Database / Auth | Supabase | Managed PostgreSQL, User Auth |
| Hosting | Vercel | Production Hosting environment |

## Configuration

| Variable | Purpose | Location |
|----------|---------|----------|
| `.env` | Environment Variables | Root directory |
| `vite.config.ts` | Dev environment configuration (Vite 7.3.1) | Root directory |
| `tailwind.config.js` | Styling variable tokens (Tailwind 4.1.18) | Root directory |
| `eslint.config.js` | Linter rules (ESLint 9.39.1) | Root directory |
| `tsconfig.*.json` | TS compiler configs (TypeScript 5.9.3) | Root directory |
