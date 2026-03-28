# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**Backend-as-a-Service:**
- Supabase - Primary backend provider
  - Usage: Database, Authentication, Real-time subscriptions
  - SDK: `@supabase/supabase-js` v2.96.0
  - Auth: API URL and Anon Key via environment variables

## Data Storage

**Databases:**
- PostgreSQL on Supabase - Primary relational data store
  - Connection: via Supabase client SDK
  - Features: RLS (Row Level Security) enabled, profiles table for roles

**Local Storage:**
- Browser LocalStorage
  - Usage: `emc-active-branch` for persisting branch selection

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: `AuthProvider` in `AuthContext.tsx`
  - Features: Email/Password login, session management via JWT
  - Table: `profiles` table maps user IDs to roles (`owner`, `admin`, `encoder`) and `branch_id`

## CI/CD & Deployment

**Hosting:**
- Vercel
  - Deployment: Automatic deployments from connected repository
  - Configuration: `vercel.json` present

**Source Control:**
- GitHub (implied by workflow/conventions)

## Environment Configuration

**Development:**
- Required env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Secrets location: `.env` file (gitignored)

**Production:**
- Secrets management: Managed in Vercel project settings

---

*Integration audit: 2026-03-24*
