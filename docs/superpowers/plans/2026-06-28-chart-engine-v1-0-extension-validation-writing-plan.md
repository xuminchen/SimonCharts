# Chart Engine v1.0 Extension Validation Writing Plan

**Problem:** SimonCharts Engine can register, install, uninstall, and preflight extension compatibility, but hosts still need to rely on thrown errors or duplicate install attempts to diagnose malformed local extension definitions. That is awkward for SDK diagnostics, docs, onboarding, and extension authoring tools.

**Goal:** Add a package-root, host-independent validation API that inspects a local `ChartExtension` and returns deterministic validation issues without installing, loading, trusting, sandboxing, persisting, or distributing the extension.

**Boundary:** This is not remote plugin security, marketplace review, permissioning, product feature flags, host persistence, or TradingReviewSystem integration. It only validates neutral local `ChartExtension` structure already understood by the Engine package.

## Contract

Add pure Engine APIs:

```ts
validateChartExtension(extension): ChartExtensionValidationResult
```

The result should include:

- `valid: boolean`
- deterministic `issues`

Validation should cover:

- manifest `id`, `label`, and `version` are non-empty strings
- duplicate contribution keys within one extension contribution group
- duplicate contribution keys across the same contribution group are reported in stable order
- drawing tool and drawing renderer custom types must be valid built-in or namespaced drawing types
- validation does not mutate the extension

## Execution Slices

1. Extension validation model and implementation
   - Verify: focused unit tests cover valid extension, manifest issues, duplicate contribution keys, invalid drawing contribution types, deterministic order, and immutability.
2. Public API and SDK coverage
   - Verify: package-root runtime/type consumers cover validation symbols.
3. Docs and release evidence
   - Verify: platform extensibility/public API/testing/release docs describe validation diagnostics and preserve non-goal boundaries.

## Success Criteria

- `validateChartExtension()` is exported from `@simoncharts/chart-engine`.
- Valid local extensions return `valid: true`.
- Invalid local extensions return deterministic issue arrays without throwing.
- Existing create/install behavior is not weakened.
- Engine boundary, public API, public types, package consumer, package type consumer, build, and release gates pass.
