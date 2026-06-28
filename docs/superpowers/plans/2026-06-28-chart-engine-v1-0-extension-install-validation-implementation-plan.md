# Chart Engine Extension Install Validation Implementation Plan

> **For agentic workers:** Use subagent-driven implementation for bounded code slices where possible. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, host-independent install validation diagnostics to `ChartExtensionLifecycle`.

**Architecture:** Extend `packages/chart-engine/src/extensions/chartExtension.ts` with install validation result types and a `validateInstall(extension)` lifecycle method. Reuse `validateChartExtension()` for structure diagnostics and the lifecycle's existing installed extension/contribution owner state for install conflict diagnostics. Do not change `install()` behavior.

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

## Task 1: Lifecycle Install Validation API

**Files:**
- Modify: `packages/chart-engine/src/extensions/chartExtension.ts`
- Modify: `packages/chart-engine/src/__tests__/chartExtension.test.ts`

- [x] **Step 1: Add install validation result types**

Export:

```ts
export type ChartExtensionInstallValidationIssueCode =
  | ChartExtensionValidationIssueCode
  | "install.alreadyInstalled"
  | "install.contributionConflict";

export interface ChartExtensionInstallValidationIssue {
  code: ChartExtensionInstallValidationIssueCode;
  path: string;
  message: string;
  ownerExtensionId?: string;
}

export interface ChartExtensionInstallValidationResult {
  valid: boolean;
  issues: ChartExtensionInstallValidationIssue[];
}
```

- [x] **Step 2: Add lifecycle method**

Extend `ChartExtensionLifecycle`:

```ts
validateInstall(extension: ChartExtension): ChartExtensionInstallValidationResult;
```

Rules:

- do not throw
- do not mutate lifecycle state, registries, or extension input
- include local `validateChartExtension()` issues first
- include `install.alreadyInstalled` when `records` already contains `extension.manifest.id`
- include `install.contributionConflict` when `contributionOwners` already has a contribution key
- preserve contribution order and contribution array order for conflicts

- [x] **Step 3: Add focused tests**

Tests must verify:

- valid candidate returns no issues
- structural validation issues are included without throwing
- already-installed id is reported before contribution conflicts
- installed contribution conflicts include `ownerExtensionId`
- validation does not mutate lifecycle state, registries, or extension input
- existing `install()` throwing behavior remains unchanged

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

Runtime consumer should exercise:

```js
createChartExtensionLifecycle(...).validateInstall(extension)
```

Type fixture should compile against:

```ts
ChartExtensionInstallValidationIssueCode;
ChartExtensionInstallValidationIssue;
ChartExtensionInstallValidationResult;
```

- [x] **Step 2: Update public type snapshots intentionally**

Run before snapshot updates:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
```

Expected: runtime API guard stays unchanged unless new runtime exports were added. Type guard fails only for newly exported install validation symbols and lifecycle method shape.

Then update snapshots if needed and verify:

```bash
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
- Modify: `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-extension-install-validation-implementation-plan.md`

- [x] **Step 1: Document lifecycle install validation**

Docs must state:

- `validateInstall()` inspects local lifecycle state only
- it reports structural validation issues, already installed extension ids, and installed contribution conflicts
- it does not install, uninstall, mutate registries, load code, sandbox code, trust code, persist extensions, or grant permissions
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
git add packages/chart-engine/src packages/chart-engine/api-types.json scripts docs
git commit -m "Add extension install validation diagnostics"
git push origin codex/v0.1-full-engine
```

## Verification Evidence

Completed on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot` passed: 23 tests.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` passed unchanged at 146 runtime exports.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `ChartExtensionInstallValidationIssue`, `ChartExtensionInstallValidationIssueCode`, and `ChartExtensionInstallValidationResult`.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 387 type symbols.
- `npm run guard:public-api` passed: 146 runtime exports.
- `npm run guard:public-types` passed: 387 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run guard:sdk-imports` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 42 test files, 493 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.
