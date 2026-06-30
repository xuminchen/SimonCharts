# Chart Engine v1.0 Release Readiness API Snapshots Writing Plan

**Problem:** `scripts/check-release-readiness.mjs` verifies the type API snapshot file exists, but it does not require the runtime API snapshot file. After adding runtime snapshot write mode and runtime snapshot integrity validation, release readiness should treat `packages/chart-engine/api-surface.json` as a required RC artifact too.

**Goal:** Harden release readiness so an Engine RC cannot pass without both public API snapshots: runtime (`api-surface.json`) and type (`api-types.json`).

**Boundary:** This is package release tooling only. It does not change Engine runtime APIs, chart behavior, drawing behavior, extension behavior, package publication, host integration, or TradingReviewSystem.

## Contract

`npm run check:release-readiness` should:

- continue validating package metadata, required scripts, required docs, and workspace version alignment
- require `packages/chart-engine/api-surface.json`
- require `packages/chart-engine/api-types.json`
- report missing required artifacts deterministically

Focused tests should cover:

- a minimal valid fixture passes
- missing runtime API snapshot fails with the expected required-file message
- missing type API snapshot fails with the expected required-file message

## Execution Slices

1. Release readiness required artifact update
   - Verify: `npm run check:release-readiness` passes in the real repo.
2. Focused script tests
   - Verify: fixture tests cover pass and missing snapshot failures.
3. Documentation and release evidence
   - Verify: release docs and testing strategy mention both API snapshots in readiness coverage.

## Success Criteria

- Release readiness requires both runtime and type API snapshots.
- Script tests are included in the full `npm run test` suite.
- Existing public API/type counts do not change.
- Engine boundary remains clean.
