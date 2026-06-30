# Chart Engine Runtime API Snapshot Integrity Implementation Plan

> **For agentic workers:** Prefer subagent-driven implementation for this bounded tooling slice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `scripts/check-public-api.mjs` validate the runtime API snapshot shape and sort order before comparing exports.

**Architecture:** Add explicit snapshot validation to `scripts/check-public-api.mjs`, mirroring the integrity checks already present in `scripts/check-public-types.mjs`. Extend `scripts/__tests__/check-public-api.test.mjs` with fixture-based negative cases. Do not change package runtime exports or snapshot content.

**Tech Stack:** Node.js ESM scripts, Vitest, package-root runtime import guard.

## File Structure

- Modify `scripts/check-public-api.mjs`
- Modify `scripts/__tests__/check-public-api.test.mjs`
- Modify `docs/engine/public-api.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Snapshot Integrity Validation

**Files:**
- Modify: `scripts/check-public-api.mjs`

- [x] **Step 1: Validate snapshot array shape**

Rules:

- if parsed snapshot is not an array, print `Public API snapshot must be an array of export names.` and exit 1
- if any entry is not a string, print `Public API snapshot must contain only string export names.` and exit 1

Verification:

```bash
npm run test -- scripts/__tests__/check-public-api.test.mjs -- --reporter=dot
```

- [x] **Step 2: Validate snapshot sort order**

Rules:

- compare snapshot against `[...snapshot].sort()`
- if order differs, print `Public API snapshot must be sorted.` and exit 1
- keep added/removed export reporting unchanged after shape/order validation passes

Verification:

```bash
npm run guard:public-api
node scripts/check-public-api.mjs --write
git diff -- packages/chart-engine/api-surface.json
```

Expected: guard passes and write mode leaves the real snapshot unchanged.

## Task 2: Focused Script Tests

**Files:**
- Modify: `scripts/__tests__/check-public-api.test.mjs`

- [x] **Step 1: Add negative integrity fixtures**

Add tests for:

1. non-array snapshot exits 1 with snapshot array message
2. non-string entry exits 1 with string entry message
3. unsorted snapshot exits 1 with sorted message
4. existing mismatch test still reports added/removed after valid snapshot shape

Verification:

```bash
npm run test -- scripts/__tests__/check-public-api.test.mjs -- --reporter=dot
```

Expected: PASS.

## Task 3: Documentation and Release Evidence

**Files:**
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

- [x] **Step 1: Document runtime snapshot integrity**

Docs must state:

- runtime API snapshot must be a sorted string array
- `--write` writes that canonical format
- this remains package-root SDK tooling, not host API validation

Verification:

```bash
rg -n "sorted string array|api-surface|check-public-api\\.mjs --write|package-root SDK" docs/engine/public-api.md docs/engine/testing-strategy.md docs/engine/release-candidate.md
```

- [x] **Step 2: Run release-relevant gates**

Verification:

```bash
npm run test -- scripts/__tests__/check-public-api.test.mjs -- --reporter=dot
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run typecheck
npm run guard:engine-boundary
npm run check:release-readiness
npm run build
npm run test
git diff --check
```

Expected: all PASS.

- [x] **Step 3: Commit and push**

Commands:

```bash
git add scripts docs
git commit -m "Harden runtime API snapshot integrity"
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

- `npm run test -- scripts/__tests__/check-public-api.test.mjs -- --reporter=dot` passed: 6 tests.
- `node scripts/check-public-api.mjs --write` passed and left `packages/chart-engine/api-surface.json` unchanged.
- `npm run guard:public-api` passed: 148 runtime exports.
- `rg -n "sorted string array|api-surface|check-public-api\\.mjs --write|package-root SDK" docs/engine/public-api.md docs/engine/testing-strategy.md docs/engine/release-candidate.md` verified docs coverage.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 43 test files, 505 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.
