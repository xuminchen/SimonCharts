# Chart Engine SDK Import Guard Tests Implementation Plan

> **For agentic workers:** Use a worker subagent for this bounded test slice. Do not revert edits made by others; this repo may have concurrent work.

**Goal:** Add fixture-based tests for `scripts/check-sdk-imports.mjs`.

**Architecture:** Add a Vitest file under `scripts/__tests__`. Each test creates a temporary project root with `apps/` and `scripts/fixtures/`, writes small host-facing source files, and runs the real `scripts/check-sdk-imports.mjs` with `cwd` set to that temp root.

**Tech Stack:** Node.js ESM, Vitest.

## File Structure

- Add `scripts/__tests__/check-sdk-imports.test.mjs`
- Modify `docs/engine/release-candidate.md` if full test counts change
- Modify this implementation plan with final evidence

## Task 1: Add SDK Import Guard Fixture Tests

**Files:**
- Add: `scripts/__tests__/check-sdk-imports.test.mjs`

- [x] **Step 1: Add fixture runner**

Create temp project roots with the scan roots expected by the guard:

- `apps/`
- `scripts/fixtures/`

Run the real `scripts/check-sdk-imports.mjs` with fixture cwd.

Verification:

```bash
npm run test -- scripts/__tests__/check-sdk-imports.test.mjs -- --reporter=dot
```

Expected: PASS.

- [x] **Step 2: Cover pass/fail/ignored paths**

Cover:

1. package-root import passes
2. `@simoncharts/chart-engine/<subpath>` fails
3. `packages/chart-engine/src` fails
4. forbidden text under `node_modules` or `dist` is ignored

Verification:

```bash
npm run test -- scripts/__tests__/check-sdk-imports.test.mjs -- --reporter=dot
```

Expected: PASS.

## Task 2: Release Evidence and Final Checks

**Files:**
- Modify: `docs/engine/release-candidate.md` if full test counts change
- Modify this implementation plan with final evidence

- [x] **Step 1: Run release-relevant checks**

Verification:

```bash
npm run test -- scripts/__tests__/check-sdk-imports.test.mjs -- --reporter=dot
npm run check:release-gate
npm run guard:sdk-imports
npm run guard:public-api
npm run guard:public-types
npm run guard:engine-boundary
git diff --check
```

Expected: all PASS.

- [x] **Step 2: Commit and push**

Commit and push this slice after verification.

Verification:

```bash
git status --short --branch
```

Expected: branch is clean and pushed to `origin/codex/v0.1-full-engine`.

## Evidence

2026-07-04:

- `npm run test -- scripts/__tests__/check-sdk-imports.test.mjs -- --reporter=dot` passed: 1 test file, 4 tests.
- `npm run check:release-gate` passed; full `npm run test` count is now 47 test files, 521 tests.
- `npm run guard:sdk-imports` passed.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `git diff --check` passed.
- Final commit and push completed for this slice.
