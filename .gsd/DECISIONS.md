# DECISIONS.md - Architectural Decision Log (ADR)

| ID | Date | Decision | Rationale | Status |
|----|------|----------|-----------|--------|
| ADR-01 | 2026-03-18 | Use Supabase Realtime for Notifications | Minimizes latency for cross-branch coordination. | Accepted |
| ADR-02 | 2026-03-18 | Atomic Transfer via Postgres Function | Ensures stock consistency by wrapping deduct/add in a single transaction. | Accepted |
| ADR-03 | 2026-03-21 | Centralized ReportService for Metrics | Ensures a single source of truth for financial and tax calculations across all dashboards. | Accepted |
| ADR-04 | 2026-03-21 | Role-based Permission Guards | Secures routes and components using `EncoderGuard` and `OwnerGuard` for granular access control. | Accepted |
