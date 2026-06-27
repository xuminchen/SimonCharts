# Chart Engine Extension Validation Implementation Plan

> **For agentic workers:** Use subagent-driven implementation for bounded code slices where possible. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, host-independent diagnostics for validating local `ChartExtension` definitions before registration or install.

**Architecture:** Extend `packages/chart-engine/src/extensions/chartExtension.ts` with pure validation types and `validateChartExtension()`. Reuse Engine-owned drawing type validation for drawing extension contribution types. Do not change install or registry behavior.

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

## Task 1: Extension Validation API

**Files:**
- Modify: `packages/chart-engine/src/extensions/chartExtension.ts`
- Modify: `packages/chart-engine/src/__tests__/chartExtension.test.ts`

- [x] **Step 1: Add validation result types**

Export:

```ts
export type ChartExtensionValidationIssueCode =
  | "manifest.id"
  | "manifest.label"
  | "manifest.version"
  | "contribution.duplicate"
  | "contribution.invalidDrawingType";

export interface ChartExtensionValidationIssue {
  code: ChartExtensionValidationIssueCode;
  path: string;
  message: string;
}

export interface ChartExtensionValidationResult {
  valid: boolean;
  issues: ChartExtensionValidationIssue[];
}
```

- [x] **Step 2: Add pure validator**

Export:

```ts
export function validateChartExtension(extension: ChartExtension): ChartExtensionValidationResult;
```

Rules:

- do not throw
- do not mutate the extension
- validate manifest `id`, `label`, and `version` as non-empty strings
- detect duplicate `type` values within each contribution group in a stable contribution order
- validate `drawingRenderers[].type` and `drawingTools[].type` with `isDrawingType()`
- do not reject built-in override contribution types for series, visual, or figure renderers

- [x] **Step 3: Add focused tests**

Tests must verify:

- valid extension has no issues
- invalid manifest values are reported without throwing
- duplicate contribution keys are reported in deterministic order
- invalid drawing renderer/tool types are reported
- validator does not mutate the extension
- `createChartExtension()` and lifecycle install behavior remain unchanged for existing tests

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
validateChartExtension
```

Type fixture should compile against:

```ts
ChartExtensionValidationIssueCode;
ChartExtensionValidationIssue;
ChartExtensionValidationResult;
```

- [x] **Step 2: Update public API snapshots intentionally**

Run before snapshot updates:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
```

Expected: API/type guards fail only for the newly exported validation symbols.

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
- Modify: `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-extension-validation-implementation-plan.md`

- [x] **Step 1: Document extension validation diagnostics**

Docs must state:

- validation inspects local `ChartExtension` structure only
- validation returns deterministic issues and does not install the extension
- validation is not security review, sandboxing, trust policy, marketplace review, persistence, or permissioning
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
git commit -m "Add extension validation diagnostics"
git push origin codex/v0.1-full-engine
```

Task 1 evidence recorded on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot` passed: 18 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed.

Task 2 evidence recorded on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `validateChartExtension`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `ChartExtensionValidationIssue`, `ChartExtensionValidationIssueCode`, `ChartExtensionValidationResult`, and `validateChartExtension`.
- Runtime API snapshot was intentionally refreshed to 146 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 384 type symbols.
- `npm run guard:public-api` passed: 146 runtime exports.
- `npm run guard:public-types` passed: 384 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.

Release-relevant evidence recorded on 2026-06-28:

- `npm run test` passed: 42 test files, 488 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run guard:public-api` passed: 146 runtime exports.
- `npm run guard:public-types` passed: 384 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.
