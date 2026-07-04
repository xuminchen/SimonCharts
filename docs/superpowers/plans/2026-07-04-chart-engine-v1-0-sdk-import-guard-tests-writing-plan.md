# Chart Engine v1.0 SDK Import Guard Tests Writing Plan

**Problem:** `npm run guard:sdk-imports` protects the package-root SDK boundary for host-facing code, but the guard currently has no focused fixture tests.

**Goal:** Add small fixture tests for `scripts/check-sdk-imports.mjs` so internal package subpath imports and direct `packages/chart-engine/src` imports fail deterministically.

**Boundary:** Release tooling tests only. Do not change Engine runtime APIs, chart behavior, drawing behavior, extension behavior, package metadata, package publication, host workflows, or TradingReviewSystem integration.

## Contract

Focused tests should prove:

- package-root `@simoncharts/chart-engine` imports pass
- internal subpath imports such as `@simoncharts/chart-engine/internal` fail
- direct source imports containing `packages/chart-engine/src` fail
- ignored directories such as `node_modules` and `dist` do not trigger failures

## Success Criteria

- `npm run test -- scripts/__tests__/check-sdk-imports.test.mjs -- --reporter=dot` passes.
- `npm run guard:sdk-imports` still passes.
- Full release gate remains green.
