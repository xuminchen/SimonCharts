# Chart Engine v0.9 Platform Extensibility Writing Plan

**Problem:** SimonCharts Engine has separate registries for series renderers, visual renderers, drawing renderers, figure renderers, and drawing tools, but hosts still need to wire each extension point manually. Custom drawing types are also blocked by the built-in `DrawingType` union, which prevents third-party tools from using the neutral drawing editor and serialization pipeline.

**Goal:** Add a small Engine-owned extension kernel that lets hosts install neutral chart extensions into existing registries without importing host APIs or business models. v0.9 should support custom namespaced drawing types, extension manifests, deterministic install results, and tests that prove external extension code can use the public package root.

**Boundary:**
- Engine code must not import TradingReviewSystem APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Engine code must not import `apps/*`.
- Extension metadata must be neutral: ids, labels, versions, capabilities, and Engine contributions only.
- Custom drawing types must be namespaced, for example `acme.measurement-box`, so unscoped host business terms remain rejected.
- v0.9 does not add remote plugin loading, sandbox execution, marketplace behavior, or host persistence.

## Success Criteria

1. A host can describe an extension with a manifest and Engine contributions.
   - Verify with unit tests for `createChartExtension()` and `applyChartExtension()`.
2. Extension installation can register drawing tools/renderers, figure renderers, series renderers, and visual renderers into existing registries.
   - Verify registry contents after apply.
3. Custom drawing types can round-trip through neutral parsing and serialization only when namespaced.
   - Verify `acme.customTool` succeeds and `hostReview` still fails.
4. Extension installation is deterministic and reports installed contribution counts.
   - Verify returned install result and duplicate extension id handling.
5. External package consumers can type-check extension usage from `@simoncharts/chart-engine`.
   - Verify `npm run check:package-types`.

## Non-Goals

- No host app integration.
- No network-loaded plugins.
- No plugin sandbox.
- No compatibility wrapper around internal Engine paths.
- No changes to built-in drawing coverage semantics.

## Proposed v0.9 Scope

1. Custom drawing type contract
   - Split built-in and custom drawing type types.
   - Keep `drawingTypes` as built-in source of truth.
   - Accept custom drawing type strings only when they match the namespace rule.

2. Extension kernel
   - Add `ChartExtensionManifest`, `ChartExtension`, `ChartExtensionInstallContext`, `ChartExtensionInstallResult`, and `createChartExtensionRegistry()`.
   - Add `applyChartExtension(extension, context)` to install contributions into existing registries.

3. Registry safety
   - Preserve deterministic list order.
   - Fail duplicate extension ids in the extension registry.
   - Let existing renderer registries keep their current last-register-wins behavior.

4. SDK coverage
   - Add unit tests for extension install and custom drawing parsing.
   - Extend package type fixture and package runtime smoke with extension API usage.

5. Documentation and versioning
   - Document extension boundaries and namespaced drawing types.
   - Advance package version to `0.9.0`.

## Validation Gate

Run before accepting v0.9:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run build
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
