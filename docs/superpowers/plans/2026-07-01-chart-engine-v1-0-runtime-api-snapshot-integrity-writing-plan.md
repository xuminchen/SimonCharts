# Chart Engine v1.0 Runtime API Snapshot Integrity Writing Plan

**Problem:** `scripts/check-public-api.mjs` now supports `--write`, but in guard mode it sorts the expected snapshot before comparison. That means `packages/chart-engine/api-surface.json` could become unsorted or malformed while still passing some comparisons. The type snapshot guard already validates snapshot shape and ordering.

**Goal:** Harden the runtime public API guard so `api-surface.json` itself must be a sorted array of string export names before it can pass.

**Boundary:** This is package-root tooling hardening only. It does not change runtime Engine APIs, type exports, chart behavior, package contents, host workflows, or TradingReviewSystem integration.

## Contract

`npm run guard:public-api` should:

- fail when `api-surface.json` is not an array
- fail when it contains non-string entries
- fail when it is not sorted
- still report added/removed runtime exports deterministically when shape is valid
- still pass when the snapshot matches package-root runtime exports

`node scripts/check-public-api.mjs --write` should continue writing sorted string arrays with a trailing newline.

## Execution Slices

1. Runtime snapshot integrity validation
   - Verify: focused tests cover non-array, non-string, unsorted, mismatch, match, and write mode.
2. Documentation and release evidence
   - Verify: public API/testing docs describe runtime snapshot shape enforcement.
3. Release gates
   - Verify: focused script tests, public guards, SDK gates, boundary guard, build, and tests pass.

## Success Criteria

- Runtime public API snapshots have the same basic integrity guarantees as type snapshots.
- Existing public runtime/type export counts do not change.
- Full test suite includes script tests and passes.
