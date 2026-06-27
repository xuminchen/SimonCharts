# Chart Engine v1.0 Package Artifact Integrity Implementation Plan

**Goal:** Add a package artifact integrity gate that verifies `@simoncharts/chart-engine@1.0.0-rc.0` dry-run tarball contents without publishing.

## Task 1: Artifact Integrity Script

**Files:**
- Create: `scripts/check-package-artifact.mjs`
- Modify: `package.json`

**Steps:**
1. Add `check:package-artifact`.
2. Spawn `npm pack --dry-run --json -w @simoncharts/chart-engine`.
3. Parse the JSON result.
4. Verify package name and version.
5. Verify required package files.
6. Reject forbidden source, test, app, script, docs, node_modules, config, and workspace-only files.

**Verification:**
- `npm run build`
- `npm run check:package-artifact`

## Task 2: Release Readiness And Docs

**Files:**
- Modify: `scripts/check-release-readiness.mjs`
- Modify: `README.md`
- Modify: `packages/chart-engine/README.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-writing-plan.md`
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-implementation-plan.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Require `check:package-artifact` in release readiness.
2. Add `check:package-artifact` to release gate docs.
3. Record artifact count and validation evidence.

**Verification:**
- `npm run check:release-readiness`
- `rg -n "check:package-artifact|artifact integrity|tarball" README.md packages/chart-engine/README.md docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-*.md scripts package.json`

## Task 3: Full Validation

**Verification:**
- `npm run build`
- `npm run check:package-artifact`
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-types`
- `npm run check:performance`
- `npm run check:release-readiness`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm run check:package-artifact` passed for `@simoncharts/chart-engine@1.0.0-rc.0`: 112 package files.
- `npm run test` passed: 32 test files, 393 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 141 files scanned.
- `npm run guard:public-api` passed: 110 runtime exports.
- `npm run guard:public-types` passed: 291 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 112 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
