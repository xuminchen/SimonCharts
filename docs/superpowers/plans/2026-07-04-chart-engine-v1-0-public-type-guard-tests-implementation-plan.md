# Chart Engine Public Type Guard Tests Implementation Plan

> **For agentic workers:** Use a worker subagent for this bounded test slice. Do not revert edits made by others; this repo may have concurrent work.

**Goal:** Add fixture-based tests for `scripts/check-public-types.mjs`.

**Architecture:** Add a Vitest file under `scripts/__tests__`. Each test creates a temporary project root with `packages/chart-engine/src/index.ts` and `packages/chart-engine/api-types.json`, then runs the real `scripts/check-public-types.mjs` with `cwd` set to that temp root. Use the real script path from the repository so the existing TypeScript dependency resolves from the workspace; do not copy dependencies into the fixture.

**Tech Stack:** Node.js ESM, Vitest, TypeScript compiler already installed in the workspace.

## File Structure

- Add `scripts/__tests__/check-public-types.test.mjs`
- Modify `docs/engine/release-candidate.md` if full test counts change
- Modify this implementation plan with final evidence

## Task 1: Add Public Type Guard Fixture Tests

**Files:**
- Add: `scripts/__tests__/check-public-types.test.mjs`

- [x] **Step 1: Add fixture runner**

Create temp project roots with:

- `packages/chart-engine/src/index.ts`
- `packages/chart-engine/api-types.json`

Run the real `scripts/check-public-types.mjs` with fixture cwd.

Verification:

```bash
npm run test -- scripts/__tests__/check-public-types.test.mjs -- --reporter=dot
```

Expected: PASS.

- [x] **Step 2: Cover pass/fail/write behavior**

Cover:

1. matching exported type symbols pass
2. added and removed symbols fail with expected diagnostics
3. snapshot is not an array
4. snapshot contains non-string entries
5. snapshot is unsorted
6. `--write` writes sorted JSON with trailing newline

Verification:

```bash
npm run test -- scripts/__tests__/check-public-types.test.mjs -- --reporter=dot
```

Expected: PASS.

## Task 2: Release Evidence and Final Checks

**Files:**
- Modify: `docs/engine/release-candidate.md` if full test counts change
- Modify this implementation plan with final evidence

- [x] **Step 1: Run release-relevant checks**

Verification:

```bash
npm run test -- scripts/__tests__/check-public-types.test.mjs -- --reporter=dot
npm run check:release-gate
npm run guard:public-types
npm run guard:public-api
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

Evidence:

- `npm run test -- scripts/__tests__/check-public-types.test.mjs -- --reporter=dot` passed: 1 test file, 6 tests.
- `npm run check:release-gate` passed; full `npm run test` inside the gate passed: 46 test files, 517 tests.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `git diff --check` passed.
- Release candidate evidence updated from 45 files / 511 tests to 46 files / 517 tests.
- Final commit and push completed for this slice.
