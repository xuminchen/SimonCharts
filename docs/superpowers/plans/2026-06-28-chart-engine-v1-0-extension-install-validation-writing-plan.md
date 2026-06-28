# Chart Engine v1.0 Extension Install Validation Writing Plan

**Problem:** SimonCharts Engine now validates local extension structure and can preflight manifest compatibility, but `ChartExtensionLifecycle.install()` still requires hosts to catch thrown errors to know whether an extension id is already installed or a contribution type conflicts with an installed extension.

**Goal:** Add a local lifecycle install validation API that returns deterministic diagnostics for install-time conflicts without installing the extension or mutating registries.

**Boundary:** This is not remote plugin loading, sandboxing, trust policy, marketplace review, permissions, persistence, or TradingReviewSystem integration. It only inspects local lifecycle state, local extension structure, and contribution keys already tracked by the Engine lifecycle.

## Contract

Add a lifecycle method:

```ts
lifecycle.validateInstall(extension): ChartExtensionInstallValidationResult
```

The result should include:

- `valid: boolean`
- deterministic `issues`

Validation should cover:

- local `validateChartExtension()` issues
- extension id already installed in the lifecycle
- contribution key conflicts with already installed extensions
- stable contribution order: `seriesRenderers`, `visualRenderers`, `drawingRenderers`, `drawingTools`, `figureRenderers`

The method must not mutate lifecycle records, contribution owner state, registries, or the extension input.

## Execution Slices

1. Lifecycle validation model and method
   - Verify: focused unit tests cover valid install, structural issues passthrough, duplicate extension id, contribution conflicts, deterministic issue order, and no mutation.
2. Public API and SDK coverage
   - Verify: package-root runtime/type consumers cover new lifecycle method and validation types.
3. Docs and release evidence
   - Verify: platform extensibility/public API/testing/release docs describe lifecycle install validation and preserve non-goal boundaries.

## Success Criteria

- `createChartExtensionLifecycle(...).validateInstall(extension)` is available from `@simoncharts/chart-engine`.
- Valid install candidates return `valid: true`.
- Already installed ids and installed contribution conflicts return deterministic issue arrays without throwing.
- Existing `install()` throwing behavior is unchanged.
- Engine boundary, public API, public types, package consumer, package type consumer, build, and release gates pass.
