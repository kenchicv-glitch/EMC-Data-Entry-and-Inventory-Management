# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code and services
- TSX - React components

**Secondary:**
- JavaScript - Build scripts and configuration files

## Runtime

**Environment:**
- Browser - React 19.2 web application
- Node.js ^24.10.1 (Types) - Development and build environment

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.0 - UI Framework
- Vite 7.3.1 - Build tool and dev server

**Testing:**
- Vitest 4.1.0 - Unit and integration testing

**Build/Dev:**
- TypeScript 5.9.3 - Static type checking
- ESLint 9.39.1 - Code linting
- PostCSS / Tailwind CSS 4.1.18 - Styling

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.96.0 - Backend-as-a-service / Database Client
- @tanstack/react-query 5.90.21 - Server state management and caching
- @tanstack/react-table 8.21.3 - Headless table logic
- react-router-dom 7.13.0 - Application routing
- react-hook-form 7.71.2 - Form management
- zod 4.3.6 - Schema validation

**Infrastructure:**
- tailwindcss 4.1.18 - Utility-first CSS framework
- lucide-react 0.574.0 - Icon library
- sonner 2.0.7 - Toast notifications
- date-fns 4.1.0 - Date manipulation

## Configuration

**Environment:**
- `.env` files for Supabase credentials and other secrets
- Environment variables managed in Vercel for production

**Build:**
- `vite.config.ts` - Vite configuration
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `eslint.config.js` - ESLint configuration

## Platform Requirements

**Development:**
- Windows/macOS/Linux with Node.js installed

**Production:**
- Vercel - Primary hosting platform for the frontend
- Supabase - Managed PostgreSQL and Authentication

---

*Stack analysis: 2026-03-24*
