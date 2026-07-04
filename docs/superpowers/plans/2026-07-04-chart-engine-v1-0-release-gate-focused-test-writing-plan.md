# Chart Engine v1.0 Release Gate Focused Test Writing Plan

**Problem:** `scripts/check-release-gate.mjs` now owns the RC validation sequence, but the sequence itself has no focused test. A later edit could reorder build after tarball-dependent checks or drop the Chrome e2e environment without a small, fast failure.

**Goal:** Add the smallest focused test that locks the release gate sequence and e2e environment without running the full release gate.

**Boundary:** Release tooling only. Do not change Engine runtime APIs, chart behavior, drawing behavior, extension behavior, package metadata, package publication, host workflows, or TradingReviewSystem integration.

## Contract

The focused test should prove:

- release gate steps remain in the documented order
- `npm run build` stays before dist/tarball-dependent checks
- e2e runs with `PLAYWRIGHT_CHANNEL=chrome`
- importing the script for tests does not execute the full release gate

## Success Criteria

- A focused Vitest test covers the gate sequence.
- `npm run test -- scripts/__tests__/check-release-gate.test.mjs -- --reporter=dot` passes.
- Full `npm run check:release-gate` still passes.
- Current acceptance evidence is refreshed if test counts change.
