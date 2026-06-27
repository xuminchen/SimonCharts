# Chart Engine v1.0 Capability Requirements Writing Plan

**Problem:** SimonCharts Engine now exposes a deterministic capability manifest, but consumers still need to hand-roll compatibility checks when they want to know whether the current package supports a required set of series, drawings, indicators, visual outputs, interactions, or extension contribution types.

**Goal:** Add a package-root, host-independent requirements checker that compares neutral capability requirements against an `EngineCapabilityManifest` and returns deterministic missing capability groups.

**Boundary:** This is not a host feature flag system, product permission system, plugin trust policy, persistence layer, routing layer, or TradingReviewSystem integration. It only compares neutral Engine capability names already present in the manifest.

## Contract

Add pure Engine APIs:

```ts
checkEngineCapabilityRequirements(manifest, requirements): EngineCapabilityCheckResult
```

The checker should accept optional required values for:

- `seriesTypes`
- `drawingTypes`
- `coreIndicatorIds`
- `visualOutputTypes`
- `drawingEditorCapabilities`
- `interactionCapabilities`
- `extensionContributionTypes`

The result should include:

- `compatible: boolean`
- deterministic `missing` groups with the requirement key and missing values

Requirement values should be strings so external config or future package versions can be checked without type casts. The checker must not mutate input manifests or requirements.

## Execution Slices

1. Engine checker model and implementation
   - Verify: focused unit tests cover compatible requirements, missing groups, deterministic order, unknown values, and input immutability.
2. Public API and SDK coverage
   - Verify: package-root runtime and type consumer gates cover checker symbols.
3. Docs and release evidence
   - Verify: public API and testing/release docs describe compatibility checks while preserving host boundary language.

## Success Criteria

- `checkEngineCapabilityRequirements()` is available from `@simoncharts/chart-engine`.
- Consumers can pass manifest-derived requirements and get `compatible: true`.
- Consumers can pass unknown future capability strings and get deterministic missing groups.
- Engine boundary, public API, public types, package consumer, package type consumer, and build gates pass.
