# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

**Runner:**
- Vitest 4.1.0
- Integration: `vitest` script in `package.json`

**Assertion Library:**
- Vitest built-in `expect`.
- Matchers: `toBe`, `toEqual`, `toThrow`.

**Run Commands:**
```bash
npm test                              # Run all tests via vitest
```

## Test File Organization

**Location:**
- Collocated with source files: `src/features/reports/services/reportService.test.ts` for `reportService.ts`.

**Naming:**
- `*.test.ts` for logic/service tests.

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('ServiceName', () => {
    describe('functionName', () => {
        it('should perform expected behavior', () => {
            // arrange
            // act
            // assert
        });
    });
});
```

**Patterns:**
- Clear naming for test cases, often referencing specific business rules or edge cases.
- Use of manual mock data for complex objects (e.g., sales, refunds).

## Mocking

**Framework:**
- Vitest built-in mocking utilities (implied).

**What to Mock:**
- Database responses (Supabase) and external API results.
- Complex data structures to isolate logic under test.

## Coverage

**Requirements:**
- No strictly enforced coverage thresholds detected.

---

*Testing analysis: 2026-03-24*
