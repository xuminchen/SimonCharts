# Chart Engine v1.0 API Version Compatibility Writing Plan

**Problem:** `createEngineCapabilityManifest()` exposes package name, package version, release channel, and capability lists, but consumers do not have a neutral API contract version or a focused version compatibility diagnostic. Hosts can inspect capabilities, yet cannot distinguish "wrong Engine API contract" from "missing feature capability" without custom host logic.

**Goal:** Add Engine-owned API version metadata and deterministic version compatibility diagnostics at the package root. This should let any host or extension authoring tool verify the Engine API contract before relying on package-root APIs.

**Boundary:** This is metadata and diagnostics only. It is not package publication automation, semantic-version range solving, host feature flags, permissions, routing, persistence, remote plugin loading, trust policy, marketplace behavior, or TradingReviewSystem integration. The Engine must not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, product persistence, or product workflow modules.

## Contract

Expose a stable Engine API version model:

- `engineApiVersion`
- `EngineReleaseChannel`
- `EngineApiVersionRequirement`
- `EngineApiVersionMismatch`
- `EngineApiVersionCheckResult`
- `checkEngineApiVersionCompatibility(manifest, requirement)`

`EngineCapabilityManifest` should include:

- `apiVersion`
- `releaseChannel`
- existing package/capability fields unchanged

The version checker should:

- compare exact package name when provided
- compare exact API version when provided
- compare exact package version when provided
- compare release channel when provided
- return deterministic mismatch arrays
- avoid semver parsing or range solving in v1.0 RC

## Execution Slices

1. API version model and checker
   - Verify: focused manifest tests cover manifest metadata, compatible requirements, deterministic mismatches, and unknown/future requested strings.
2. Public API and SDK coverage
   - Verify: runtime and type package consumers import and exercise the checker and types from `@simoncharts/chart-engine`.
3. Documentation and release evidence
   - Verify: public API, testing strategy, and release candidate docs explain API version diagnostics and boundaries.

## Success Criteria

- Package-root consumers can read `engineApiVersion` and `manifest.apiVersion`.
- Package-root consumers can call `checkEngineApiVersionCompatibility()`.
- Version mismatch diagnostics are deterministic and host-independent.
- Runtime/type API snapshots are updated intentionally only for the new public contract.
- Engine boundary and release-relevant gates pass.
