# Chart Engine v1.0 Capability Manifest Writing Plan

**Problem:** SimonCharts Engine already exposes many independent capabilities, but hosts currently need to inspect separate exports such as `supportedSeriesTypes`, `drawingTypes`, `coreIndicatorIds`, registries, docs, and API snapshots to understand what the package supports. That makes Engine completion harder to verify and makes host integration depend on scattered knowledge.

**Goal:** Add a package-root, host-independent capability manifest that describes the current Engine feature surface in one neutral object. The manifest must be derived from Engine-owned constants and stay free of TradingReviewSystem, route, store, persistence, review, strategy, watchlist, AI, auth, account, and product workflow concepts.

**Boundary:** The manifest describes Engine capabilities only. It must not implement host configuration, feature flags controlled by a product app, remote plugin loading, marketplace behavior, persistence, user permissions, or collaboration.

## Contract

Add a pure Engine API:

```ts
createEngineCapabilityManifest(): EngineCapabilityManifest
```

The manifest should include:

- package name and current package version
- supported series types
- built-in drawing types
- built-in drawing tool summaries
- core indicator ids
- visual output renderer families
- drawing editor capability names
- interaction capability names
- extension contribution types
- release channel metadata for the current package version

The manifest should be deterministic and safe for hosts to render in docs, diagnostics, onboarding, or compatibility checks.

## Execution Slices

1. Engine manifest model and factory
   - Verify: focused unit tests prove deterministic counts and no mutation leaks.
2. Public API and SDK coverage
   - Verify: `guard:public-api`, `guard:public-types`, `check:package-consumer`, and `check:package-types` include the manifest API.
3. Docs and release evidence
   - Verify: public API, overview/testing/release docs explain the manifest and keep host boundary language intact.

## Success Criteria

- `createEngineCapabilityManifest()` is available from `@simoncharts/chart-engine`.
- Manifest counts match current Engine-owned constants: 17 series types, 63 drawing types, and 16 core indicators.
- The manifest is immutable from consumer mutation through defensive copies.
- Engine boundary guard passes.
- SDK consumer and type consumer gates pass from the package root.
