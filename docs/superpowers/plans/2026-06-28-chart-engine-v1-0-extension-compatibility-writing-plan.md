# Chart Engine v1.0 Extension Compatibility Writing Plan

**Problem:** SimonCharts Engine has a local extension lifecycle and a capability manifest/checker, but an extension consumer still needs to hand-roll the bridge between an extension's actual contribution types and the Engine capability manifest.

**Goal:** Add package-root, host-independent helpers that derive neutral capability requirements from a `ChartExtension` and check whether the current `EngineCapabilityManifest` supports those extension contribution types.

**Boundary:** This does not load remote extensions, sandbox code, define trust policy, grant permissions, persist extensions, create a marketplace, or integrate TradingReviewSystem. It only inspects local `ChartExtension.contributions` and compares contribution type names already present in the Engine capability manifest.

## Contract

Add pure Engine APIs:

```ts
getChartExtensionCapabilityRequirements(extension): EngineCapabilityRequirements
checkChartExtensionCompatibility(manifest, extension): EngineCapabilityCheckResult
```

The requirement helper should include `extensionContributionTypes` for contribution arrays that are present and non-empty:

- `seriesRenderers`
- `visualRenderers`
- `drawingRenderers`
- `drawingTools`
- `figureRenderers`

The compatibility helper should delegate to `checkEngineCapabilityRequirements()` and return the same deterministic result shape.

## Execution Slices

1. Extension helper model and implementation
   - Verify: focused unit tests cover requirement derivation, empty contributions, compatibility pass, missing contribution support, and input immutability.
2. Public API and SDK coverage
   - Verify: package-root runtime/type consumers cover both helpers.
3. Docs and release evidence
   - Verify: platform extensibility/public API/testing/release docs describe the helper and preserve non-goal boundaries.

## Success Criteria

- Helpers are exported from `@simoncharts/chart-engine`.
- Extension requirement derivation is deterministic and based only on local contribution arrays.
- Compatibility checks return missing `extensionContributionTypes` when a manifest does not support a contribution type.
- Engine boundary, public API, public types, package consumer, package type consumer, build, and release gates pass.
