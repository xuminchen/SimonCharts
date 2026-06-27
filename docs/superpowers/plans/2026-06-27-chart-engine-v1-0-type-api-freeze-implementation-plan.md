# Chart Engine v1.0 Type API Freeze Implementation Plan

**Goal:** Freeze package-root TypeScript public symbols for `@simoncharts/chart-engine@1.0.0-rc.0` with a dedicated guard and release documentation.

## Task 1: Public Type Snapshot

**Files:**
- Create: `packages/chart-engine/api-types.json`
- Create: `scripts/check-public-types.mjs`
- Modify: `package.json`

**Steps:**
1. Add a TypeScript compiler API script that resolves exports from `packages/chart-engine/src/index.ts`.
2. Add `--write` mode for intentional snapshot updates.
3. Generate the initial sorted type-symbol snapshot.
4. Add `npm run guard:public-types`.

**Verification:**
- `npm run guard:public-types`

## Task 2: Release Readiness Integration

**Files:**
- Modify: `scripts/check-release-readiness.mjs`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `README.md`
- Modify: `packages/chart-engine/README.md`
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-writing-plan.md`
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-implementation-plan.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Add `guard:public-types` to the documented release gate.
2. Require `guard:public-types` in release readiness.
3. Document the distinction between runtime API and type-symbol API guards.

**Verification:**
- `npm run check:release-readiness`
- `rg -n "guard:public-types|api-types" README.md packages/chart-engine/README.md docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-*.md scripts package.json`

## Task 3: Full Validation

**Steps:**
1. Run the full validation gate.
2. Record acceptance evidence.
3. Confirm git status contains only intended type API freeze changes.

**Verification:**
- `npm run guard:public-types`
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-types`
- `npm run check:performance`
- `npm run check:release-readiness`
- `npm run build`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- `node scripts/check-public-types.mjs --write` generated `packages/chart-engine/api-types.json`.
- `npm run guard:public-types` passed: 291 type symbols.
- `npm run test` passed: 32 test files, 393 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 141 files scanned.
- `npm run guard:public-api` passed: 110 runtime exports.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 112 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
