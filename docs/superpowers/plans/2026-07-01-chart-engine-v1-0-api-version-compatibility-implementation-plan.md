# Chart Engine API Version Compatibility Implementation Plan

> **For agentic workers:** Prefer subagent-driven implementation for the bounded code slice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Engine-owned API version metadata and deterministic compatibility diagnostics to the package root.

**Architecture:** Extend `packages/chart-engine/src/engine/engineCapabilityManifest.ts` with API version constants, types, manifest fields, and an exact-match checker. Keep capability requirement checking separate. Update focused tests, SDK consumer fixtures, public API/type snapshots, and docs. Do not add semver range parsing or host policy logic.

**Tech Stack:** TypeScript, Vitest, package-root API/type guards, SDK consumer smoke tests.

## File Structure

- Modify `packages/chart-engine/src/engine/engineCapabilityManifest.ts`
- Modify `packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts`
- Modify `scripts/check-package-consumer.mjs`
- Modify `scripts/fixtures/package-consumer-types.ts`
- Modify `packages/chart-engine/api-surface.json`
- Modify `packages/chart-engine/api-types.json`
- Modify `docs/engine/public-api.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: API Version Model and Checker

**Files:**
- Modify: `packages/chart-engine/src/engine/engineCapabilityManifest.ts`
- Modify: `packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts`

- [x] **Step 1: Add API version contract**

Add exports:

```ts
export const engineApiVersion = "1.0.0-rc.0";
export type EngineReleaseChannel = "rc";

export interface EngineApiVersionRequirement {
  packageName?: string;
  packageVersion?: string;
  apiVersion?: string;
  releaseChannel?: string;
}

export interface EngineApiVersionMismatch {
  key: keyof EngineApiVersionRequirement;
  expected: string;
  actual: string;
}

export interface EngineApiVersionCheckResult {
  compatible: boolean;
  mismatches: EngineApiVersionMismatch[];
}
```

Extend `EngineCapabilityManifest` with `apiVersion: typeof engineApiVersion` and `releaseChannel: EngineReleaseChannel`.

Verification:

```bash
npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot
```

Expected before implementation: new tests fail.

- [x] **Step 2: Add deterministic exact-match checker**

Add:

```ts
checkEngineApiVersionCompatibility(manifest, requirement)
```

Rules:

- only checks provided requirement keys
- compares exact strings
- mismatch order: `packageName`, `packageVersion`, `apiVersion`, `releaseChannel`
- unknown/future requested strings are reported as mismatches, not thrown
- no semver range parsing

Verification:

```bash
npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot
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

- [x] **Step 1: Add package-root runtime/type consumers**

Runtime consumer should exercise:

```js
engineApiVersion;
checkEngineApiVersionCompatibility(createEngineCapabilityManifest(), { apiVersion: engineApiVersion });
```

Type fixture should compile:

```ts
EngineApiVersionRequirement;
EngineApiVersionMismatch;
EngineApiVersionCheckResult;
EngineReleaseChannel;
```

- [x] **Step 2: Update public snapshots intentionally**

Run before snapshot updates:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
```

Expected: guards fail only for the new runtime/type API symbols.

Then update and verify:

```bash
# api-surface.json is updated intentionally after reviewing guard output.
node scripts/check-public-types.mjs --write
npm run guard:public-api
npm run guard:public-types
npm run check:package-consumer
npm run check:package-types
```

Expected: all PASS.

## Task 3: Documentation, Release Gates, Commit

**Files:**
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

- [x] **Step 1: Document version compatibility diagnostics**

Docs must state:

- API version diagnostics are exact-match metadata checks
- they are separate from capability requirement checks
- they do not implement semver ranges, host feature flags, permissions, persistence, routing, plugin trust, or TradingReviewSystem workflows

Verification:

```bash
rg -n "apiVersion|engineApiVersion|checkEngineApiVersionCompatibility|semver|feature flag" docs/engine/public-api.md docs/engine/testing-strategy.md docs/engine/release-candidate.md
```

- [x] **Step 2: Run release-relevant gates**

Verification:

```bash
npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run check:release-readiness
npm run build
npm run test
git diff --check
```

Expected: all PASS.

- [x] **Step 3: Commit and push**

Commands:

```bash
git add packages/chart-engine/src packages/chart-engine/api-surface.json packages/chart-engine/api-types.json scripts docs
git commit -m "Add engine API version compatibility diagnostics"
git push origin codex/v0.1-full-engine
```

Verification:

```bash
git status --short --branch
git log --oneline -5
```

Expected: branch is clean and pushed to `origin/codex/v0.1-full-engine`.

## Verification Evidence

Completed on 2026-07-01:

- `npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot` passed: 15 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime exports `checkEngineApiVersionCompatibility` and `engineApiVersion`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `EngineApiVersionCheckResult`, `EngineApiVersionMismatch`, `EngineApiVersionRequirement`, `EngineReleaseChannel`, `checkEngineApiVersionCompatibility`, and `engineApiVersion`.
- `packages/chart-engine/api-surface.json` was intentionally refreshed to 148 runtime exports after reviewing guard output.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 393 type symbols.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:sdk-imports` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 42 test files, 499 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.
