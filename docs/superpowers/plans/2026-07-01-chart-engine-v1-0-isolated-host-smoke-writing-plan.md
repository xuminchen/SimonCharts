# Chart Engine v1.0 Isolated Host Smoke Writing Plan

**Problem:** Existing package consumer checks run inside the SimonCharts workspace. They verify package-root SDK usage, but they do not prove the built package can be installed into a clean host project from the npm tarball and consumed without workspace internals.

**Goal:** Add an isolated host smoke gate that packs `@simoncharts/chart-engine`, installs the tarball into a temporary neutral host project, and runs a package-root ESM smoke script against the installed package.

**Boundary:** This is release tooling only. It does not change Engine runtime behavior, chart behavior, drawing behavior, extension behavior, package publication, remote plugin loading, host persistence, collaboration, or TradingReviewSystem integration.

## Contract

`npm run check:host-smoke` should:

- build or require the existing built Engine package before packing
- create a temporary host project outside the repository
- run `npm pack --json -w @simoncharts/chart-engine --pack-destination <temp>`
- install the generated tarball into the temporary host project with no workspace links
- run a neutral ESM host script importing only from `@simoncharts/chart-engine`
- verify representative Engine package-root behavior: capability manifest, chart engine state, layout serialization, drawing editor command flow, core indicator output, and extension lifecycle
- clean up the temporary host project after completion

## Execution Slices

1. Isolated host smoke script
   - Verify: `npm run build` then `npm run check:host-smoke` passes.
2. Release gate integration
   - Verify: root scripts and release readiness require `check:host-smoke`.
3. Documentation and release evidence
   - Verify: release docs and host integration docs explain the isolated host smoke gate.

## Success Criteria

- The smoke gate installs the packed tarball into a temporary non-workspace host.
- The host script imports only `@simoncharts/chart-engine`.
- The gate does not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, persistence, or product workflow modules.
- Existing public API/type snapshots do not change.
- Engine boundary remains clean.
