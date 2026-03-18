# DECISIONS.md - Architectural Decision Log (ADR)

| ID | Date | Decision | Rationale | Status |
|----|------|----------|-----------|--------|
| ADR-01 | 2026-03-18 | Use Supabase Realtime for Notifications | Minimizes latency for cross-branch coordination. | Accepted |
| ADR-02 | 2026-03-18 | Atomic Transfer via Postgres Function | Ensures stock consistency by wrapping deduct/add in a single transaction. | Accepted |
