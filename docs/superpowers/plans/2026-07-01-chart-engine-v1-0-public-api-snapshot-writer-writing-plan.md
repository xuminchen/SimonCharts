# Chart Engine v1.0 Public API Snapshot Writer Writing Plan

**Problem:** SimonCharts Engine has package-root runtime API guards through `scripts/check-public-api.mjs`, but the runtime snapshot guard lacks a `--write` mode. Type snapshots can be refreshed intentionally with `scripts/check-public-types.mjs --write`; runtime snapshots currently require manual JSON edits after reviewing guard output, which is slower and easier to misorder.

**Goal:** Add a deterministic `--write` mode to the runtime public API guard so package-root runtime exports can be intentionally refreshed with the same workflow as type exports.

**Boundary:** This is Engine package tooling hardening only. It does not add runtime chart features, change public Engine APIs, alter snapshots by itself, publish packages, implement host feature flags, or integrate TradingReviewSystem. The script must keep validating the package-root runtime surface from `@simoncharts/chart-engine`.

## Contract

`node scripts/check-public-api.mjs --write` should:

- import `@simoncharts/chart-engine`
- collect and sort runtime export names
- write `packages/chart-engine/api-surface.json` with stable two-space JSON and trailing newline
- print the refreshed runtime export count
- exit 0

`npm run guard:public-api` should keep its current behavior:

- compare actual package-root runtime exports to `api-surface.json`
- report added/removed exports deterministically
- exit non-zero when snapshots differ
- exit zero when snapshots match

## Execution Slices

1. Runtime snapshot writer implementation
   - Verify: focused script tests cover matching guard behavior and write mode.
2. Documentation and release evidence
   - Verify: public API docs and release evidence mention the matching runtime/type snapshot workflow.
3. Release gates
   - Verify: `guard:public-api`, `guard:public-types`, SDK gates, boundary guard, build, and tests pass.

## Success Criteria

- `node scripts/check-public-api.mjs --write` works and keeps `api-surface.json` sorted.
- `npm run guard:public-api` continues to pass with the current snapshot.
- No public runtime/type Engine API symbols change in this slice.
- Engine boundary remains clean.
