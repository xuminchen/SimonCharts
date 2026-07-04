# Chart Engine v1.0 Public Type Guard Tests Writing Plan

**Problem:** Runtime public API guard has fixture tests, but the TypeScript public symbol guard does not. That leaves `scripts/check-public-types.mjs` behavior verified only by the full release gate.

**Goal:** Add focused fixture tests for the public type API guard without changing the current type snapshot or Engine runtime code.

**Boundary:** Release tooling tests only. Do not change Engine public APIs, runtime behavior, chart behavior, drawing behavior, extension behavior, package metadata, publication, host workflows, or TradingReviewSystem integration.

## Contract

The focused tests should prove:

- matching type exports pass
- added/removed type symbols fail with clear diagnostics
- malformed snapshots fail
- unsorted snapshots fail
- `--write` writes sorted JSON with a trailing newline

## Success Criteria

- `npm run test -- scripts/__tests__/check-public-types.test.mjs -- --reporter=dot` passes.
- `npm run guard:public-types` still passes at the existing symbol count unless the full test count changes.
- Full release gate remains green.
