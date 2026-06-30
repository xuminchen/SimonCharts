# Chart Engine Release Readiness API Snapshots Implementation Plan

> **For agentic workers:** Prefer subagent-driven implementation for this bounded tooling slice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make release readiness require both runtime and type public API snapshot artifacts, with focused script tests.

**Architecture:** Update `scripts/check-release-readiness.mjs` required docs/artifacts list to include `packages/chart-engine/api-surface.json`. Add a fixture-based Vitest test file for the release readiness script. Tests should run the real script against temporary project roots and not mutate the real repository.

**Tech Stack:** Node.js ESM scripts, Vitest, package metadata fixtures.

## File Structure

- Modify `scripts/check-release-readiness.mjs`
- Add `scripts/__tests__/check-release-readiness.test.mjs`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Require Runtime API Snapshot in Release Readiness

**Files:**
- Modify: `scripts/check-release-readiness.mjs`

- [x] **Step 1: Add required runtime API snapshot artifact**

Add `packages/chart-engine/api-surface.json` to the required artifact list alongside `api-types.json`.

Verification:

```bash
npm run check:release-readiness
```

Expected: PASS in the real repo.

## Task 2: Focused Release Readiness Tests

**Files:**
- Add: `scripts/__tests__/check-release-readiness.test.mjs`

- [x] **Step 1: Add fixture helper**

Create temporary project roots containing:

- root `package.json` with required scripts
- `packages/chart-engine/package.json`
- `apps/playground/package.json`
- `package-lock.json`
- required docs/artifacts

- [x] **Step 2: Add focused tests**

Cover:

1. minimal valid fixture exits 0
2. missing `packages/chart-engine/api-surface.json` exits 1 with required-file message
3. missing `packages/chart-engine/api-types.json` exits 1 with required-file message

Verification:

```bash
npm run test -- scripts/__tests__/check-release-readiness.test.mjs -- --reporter=dot
```

Expected: PASS.

## Task 3: Documentation and Release Evidence

**Files:**
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

- [x] **Step 1: Document readiness coverage**

Docs must state release readiness checks both API snapshots.

Verification:

```bash
rg -n "api-surface|api-types|release readiness" docs/engine/testing-strategy.md docs/engine/release-candidate.md
```

- [x] **Step 2: Run release-relevant gates**

Verification:

```bash
npm run test -- scripts/__tests__/check-release-readiness.test.mjs -- --reporter=dot
npm run check:release-readiness
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run typecheck
npm run guard:engine-boundary
npm run build
npm run test
git diff --check
```

Expected: all PASS.

- [x] **Step 3: Commit and push**

Commands:

```bash
git add scripts docs
git commit -m "Require API snapshots in release readiness"
git push origin codex/v0.1-full-engine
```

Verification:

```bash
git status --short --branch
git log --oneline -5
```

Expected: branch is clean and pushed to `origin/codex/v0.1-full-engine`.

## Verification Evidence

Completed before commit on 2026-07-01:

- `npm run test -- scripts/__tests__/check-release-readiness.test.mjs -- --reporter=dot` passed: 1 test file, 3 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run build` passed for the Engine package and playground.
- `npm run test -- --run` passed: 44 test files, 508 tests.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed: 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `lsof -nP -iTCP:5173 -sTCP:LISTEN` returned no listener after e2e.
