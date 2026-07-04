# Chart Engine Release Gate Focused Test Implementation Plan

> **For agentic workers:** Use a worker subagent for the bounded tooling change. Do not revert edits made by others; this repo may have concurrent work.

**Goal:** Add a focused test for the release gate orchestrator sequence.

**Architecture:** Refactor `scripts/check-release-gate.mjs` just enough to export the step list and a `runReleaseGate()` function, while keeping CLI behavior unchanged when executed directly. Add one small Vitest file that imports the step list and asserts the sequence and Chrome e2e environment. Update release evidence counts if the full gate count changes.

**Tech Stack:** Node.js ESM scripts, Vitest.

## File Structure

- Modify `scripts/check-release-gate.mjs`
- Add `scripts/__tests__/check-release-gate.test.mjs`
- Modify `docs/engine/release-candidate.md` if test counts change
- Modify this implementation plan with final evidence

## Task 1: Make Release Gate Steps Testable

**Files:**
- Modify: `scripts/check-release-gate.mjs`

- [x] **Step 1: Export step metadata without running the gate on import**

Keep CLI behavior unchanged for `node scripts/check-release-gate.mjs`.

Verification:

```bash
npm run check:release-gate
```

Expected: PASS.

Evidence: `npm run check:release-gate` passed on 2026-07-04 with the existing 15-step CLI sequence preserved.

## Task 2: Add Focused Sequence Test

**Files:**
- Add: `scripts/__tests__/check-release-gate.test.mjs`

- [x] **Step 1: Assert release gate sequence**

The test should assert exact command strings and `PLAYWRIGHT_CHANNEL=chrome` for e2e.

Verification:

```bash
npm run test -- scripts/__tests__/check-release-gate.test.mjs -- --reporter=dot
```

Expected: PASS.

Evidence: `npm run test -- scripts/__tests__/check-release-gate.test.mjs -- --reporter=dot` passed on 2026-07-04: 1 test file, 3 tests.

## Task 3: Evidence and Final Checks

**Files:**
- Modify: `docs/engine/release-candidate.md` if test counts change
- Modify this implementation plan with final evidence

- [x] **Step 1: Run release-relevant checks**

Verification:

```bash
npm run test -- scripts/__tests__/check-release-gate.test.mjs -- --reporter=dot
npm run check:release-gate
npm run check:release-readiness
npm run guard:public-api
npm run guard:public-types
npm run guard:engine-boundary
git diff --check
```

Expected: all PASS.

Evidence on 2026-07-04:

- `npm run test -- scripts/__tests__/check-release-gate.test.mjs -- --reporter=dot` passed: 1 test file, 3 tests.
- `npm run check:release-gate` passed; full suite count is now 45 test files, 511 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `git diff --check` passed.

- [x] **Step 2: Commit and push**

Commands:

```bash
git add scripts docs/engine/release-candidate.md docs/superpowers/plans/2026-07-04-chart-engine-v1-0-release-gate-focused-test-*.md
git commit -m "Add release gate sequence test"
git push origin codex/v0.1-full-engine
```

Verification:

```bash
git status --short --branch
git log --oneline -5
```

Expected: branch is clean and pushed to `origin/codex/v0.1-full-engine`.

Evidence: completed by the final commit and push for this slice.
