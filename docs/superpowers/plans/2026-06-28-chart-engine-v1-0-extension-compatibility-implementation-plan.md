# Chart Engine Extension Compatibility Implementation Plan

> **For agentic workers:** Use subagent-driven implementation for bounded code slices where possible. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, host-independent helpers for checking a local `ChartExtension` against `EngineCapabilityManifest`.

**Architecture:** Extend `packages/chart-engine/src/extensions/chartExtension.ts` with pure helpers that derive `EngineCapabilityRequirements` from contribution arrays and call `checkEngineCapabilityRequirements()`. This keeps extension compatibility as diagnostics/preflight metadata without changing install behavior.

**Tech Stack:** TypeScript, Vitest, package-root API/type guards, SDK consumer smoke tests.

## File Structure

- Modify `packages/chart-engine/src/extensions/chartExtension.ts`
- Modify `packages/chart-engine/src/__tests__/chartExtension.test.ts`
- Modify `scripts/check-package-consumer.mjs`
- Modify `scripts/fixtures/package-consumer-types.ts`
- Modify `packages/chart-engine/api-surface.json`
- Modify `packages/chart-engine/api-types.json`
- Modify `docs/engine/platform-extensibility.md`
- Modify `docs/engine/public-api.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Extension Compatibility API

**Files:**
- Modify: `packages/chart-engine/src/extensions/chartExtension.ts`
- Modify: `packages/chart-engine/src/__tests__/chartExtension.test.ts`

- [x] **Step 1: Add extension requirement helper**

Export:

```ts
export function getChartExtensionCapabilityRequirements(
  extension: ChartExtension
): EngineCapabilityRequirements;
```

Rules:

- include `extensionContributionTypes` only when the extension has at least one non-empty contribution array
- preserve fixed contribution order: `seriesRenderers`, `visualRenderers`, `drawingRenderers`, `drawingTools`, `figureRenderers`
- return defensive arrays
- do not mutate the extension

- [x] **Step 2: Add compatibility helper**

Export:

```ts
export function checkChartExtensionCompatibility(
  manifest: EngineCapabilityManifest,
  extension: ChartExtension
): EngineCapabilityCheckResult;
```

Rules:

- call `getChartExtensionCapabilityRequirements(extension)`
- delegate comparison to `checkEngineCapabilityRequirements(manifest, requirements)`
- do not install or mutate extension contributions

- [x] **Step 3: Add focused tests**

Tests must verify:

- requirement derivation for all contribution groups
- empty extensions produce empty requirements
- compatibility passes for the current manifest
- compatibility reports missing `extensionContributionTypes` when a manifest lacks a contribution type
- helper outputs are defensive copies
- extension input is not mutated

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot
npm run typecheck -w @simoncharts/chart-engine
npm run guard:engine-boundary
```

Expected: all PASS.

## Task 2: Public API and SDK Coverage

**Files:**
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`

- [x] **Step 1: Add package-root consumer coverage**

Runtime consumer should import and exercise:

```js
getChartExtensionCapabilityRequirements
checkChartExtensionCompatibility
```

Type fixture should compile against both helper functions and existing `EngineCapabilityRequirements` / `EngineCapabilityCheckResult`.

- [x] **Step 2: Update public API snapshots intentionally**

Run before snapshot updates:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
```

Expected: API/type guards fail only for the newly exported extension helper symbols.

Then update snapshots and verify:

```bash
node -e 'import("@simoncharts/chart-engine").then((m)=>import("node:fs").then((fs)=>fs.writeFileSync("packages/chart-engine/api-surface.json", JSON.stringify(Object.keys(m).sort(), null, 2)+"\n")))'
node scripts/check-public-types.mjs --write
npm run guard:public-api
npm run guard:public-types
npm run check:package-consumer
npm run check:package-types
```

Expected: all PASS.

## Task 3: Documentation and Release Evidence

**Files:**
- Modify: `docs/engine/platform-extensibility.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-extension-compatibility-implementation-plan.md`

- [x] **Step 1: Document extension compatibility helper**

Docs must state:

- helpers inspect local extension contribution arrays only
- helpers compare against neutral Engine manifest contribution support
- helpers do not load, sandbox, trust, persist, install, or distribute extensions
- hosts still own extension loading, trust policy, persistence, and product workflows

- [x] **Step 2: Run release-relevant verification**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run check:release-readiness
npm run build
git diff --check
```

Expected: all PASS.

- [x] **Step 3: Commit and push**

Commit:

```bash
git add packages/chart-engine/src packages/chart-engine/api-surface.json packages/chart-engine/api-types.json scripts docs
git commit -m "Add extension compatibility checks"
git push origin codex/v0.1-full-engine
```

Task 1 evidence recorded on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot` passed: 13 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.

Task 2 evidence recorded on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime exports `checkChartExtensionCompatibility` and `getChartExtensionCapabilityRequirements`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `checkChartExtensionCompatibility` and `getChartExtensionCapabilityRequirements`.
- Runtime API snapshot was intentionally refreshed to 145 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 380 type symbols.
- `npm run guard:public-api` passed: 145 runtime exports.
- `npm run guard:public-types` passed: 380 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.

Release-relevant evidence recorded on 2026-06-28:

- `npm run test` passed: 42 test files, 483 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run guard:public-api` passed: 145 runtime exports.
- `npm run guard:public-types` passed: 380 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- Initial full `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` hit two unrelated timeouts; both failed tests passed individually, and the full e2e suite passed on rerun: 43 browser tests.
- `git diff --check` passed.
