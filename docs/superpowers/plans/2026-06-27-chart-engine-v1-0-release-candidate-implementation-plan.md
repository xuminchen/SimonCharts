# Chart Engine v1.0 Release Candidate Implementation Plan

**Goal:** Prepare SimonCharts Engine as `@simoncharts/chart-engine@1.0.0-rc.0`, with release documentation, package metadata, a release readiness guard, and full validation evidence while preserving host independence.

## Task 1: Package Identity And Versioning

**Files:**
- Modify: `packages/chart-engine/package.json`
- Modify: `apps/playground/package.json`
- Modify: `package-lock.json`

**Steps:**
1. Advance `@simoncharts/chart-engine` to `1.0.0-rc.0`.
2. Update the playground workspace dependency to `1.0.0-rc.0`.
3. Add package metadata: description, keywords, repository, homepage, and explicit unpublished-license status if no license file exists.
4. Refresh lockfile metadata.

**Verification:**
- `npm install --package-lock-only`
- `node -e "console.log(require('./packages/chart-engine/package.json').version)"`

## Task 2: Consumer And Release Documentation

**Files:**
- Create: `README.md`
- Create: `packages/chart-engine/README.md`
- Create: `CHANGELOG.md`
- Create: `docs/engine/release-candidate.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Document repository purpose and Engine package scope.
2. Document package install, root imports, supported capabilities, extension model, validation commands, and non-goals.
3. Document `1.0.0-rc.0` release scope, gates, and residual risks.
4. Add release readiness to the testing strategy RC gate.

**Verification:**
- `test -f README.md`
- `test -f packages/chart-engine/README.md`
- `test -f CHANGELOG.md`
- `test -f docs/engine/release-candidate.md`
- `rg -n "1.0.0-rc.0|check:release-readiness|TradingReviewSystem" README.md packages/chart-engine/README.md CHANGELOG.md docs/engine/release-candidate.md docs/engine/testing-strategy.md`

## Task 3: Release Readiness Guard

**Files:**
- Create: `scripts/check-release-readiness.mjs`
- Modify: `package.json`

**Steps:**
1. Add `npm run check:release-readiness`.
2. Verify package version, package metadata, root export map, `files`, side-effect flag, required docs, and required root scripts.
3. Keep the guard independent from host APIs and business concepts.

**Verification:**
- `npm run check:release-readiness`

## Task 4: Full RC Validation

**Files:**
- Modify: this implementation plan with final evidence
- Modify: `docs/engine/release-candidate.md` with final evidence

**Steps:**
1. Run the full Engine validation gate.
2. Record evidence and package dry-run result.
3. Confirm git status only contains intended release-readiness changes.

**Verification:**
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-types`
- `npm run check:release-readiness`
- `npm run build`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- `npm install --package-lock-only` passed and synchronized `@simoncharts/chart-engine@1.0.0-rc.0` into `package-lock.json`.
- Version verification passed: `packages/chart-engine/package.json`, `apps/playground/package.json`, and `package-lock.json` all reference `1.0.0-rc.0`.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run test` passed: 32 test files, 386 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 141 files scanned.
- `npm run guard:public-api` passed: 109 runtime exports.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 112 files including package `README.md`, `dist/index.js`, `dist/index.d.ts`, and extension declarations.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
- `npm install --package-lock-only` reported 4 existing dependency audit findings: 2 moderate, 1 high, and 1 critical. They remain outside this RC hardening scope because `npm audit fix --force` may introduce breaking dependency changes.
