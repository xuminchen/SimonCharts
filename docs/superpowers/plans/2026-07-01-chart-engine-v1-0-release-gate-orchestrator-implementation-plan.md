# Chart Engine Release Gate Orchestrator Implementation Plan

> **For agentic workers:** Use a worker subagent for the bounded implementation. The worker owns the script and docs listed below. Do not revert edits made by others; this repo may have concurrent work.

**Goal:** Add a single root release gate command that runs the full SimonCharts Engine v1.0 RC validation sequence.

**Architecture:** Add `scripts/check-release-gate.mjs` as a Node.js ESM command runner. The script should define the release gate steps as command/args/env entries, print each step before running it, use inherited stdio, stop on first failure, and set `PLAYWRIGHT_CHANNEL=chrome` only for e2e. Add a root `check:release-gate` script, make release readiness require that script, and update docs to present `npm run check:release-gate` as the primary release command while preserving the expanded command list.

**Tech Stack:** Node.js ESM scripts, npm scripts, Playwright e2e environment.

## File Structure

- Add `scripts/check-release-gate.mjs`
- Modify `package.json`
- Modify `scripts/check-release-readiness.mjs`
- Modify `scripts/__tests__/check-release-readiness.test.mjs`
- Modify `README.md`
- Modify `packages/chart-engine/README.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Add Release Gate Runner

**Files:**
- Add: `scripts/check-release-gate.mjs`

- [x] **Step 1: Define deterministic release gate steps**

Use this sequence:

1. `npm run test`
2. `npm run typecheck`
3. `npm run guard:engine-boundary`
4. `npm run guard:public-api`
5. `npm run guard:public-types`
6. `npm run guard:sdk-imports`
7. `npm run build`
8. `npm run check:host-smoke`
9. `npm run check:package-consumer`
10. `npm run check:package-types`
11. `npm run check:performance`
12. `npm run check:release-readiness`
13. `npm run check:package-artifact`
14. `npm pack --dry-run -w @simoncharts/chart-engine`
15. `npm run test:e2e` with `PLAYWRIGHT_CHANNEL=chrome`

Verification:

```bash
node scripts/check-release-gate.mjs
```

Expected: PASS.

- [x] **Step 2: Fail fast with clear command context**

The script should print the step number and command, inherit stdio, and exit with the failing command status.

Verification:

```bash
npm run check:release-gate
```

Expected: PASS.

## Task 2: Release Readiness Integration

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-release-readiness.mjs`
- Modify: `scripts/__tests__/check-release-readiness.test.mjs`

- [x] **Step 1: Add root script**

Add:

```json
"check:release-gate": "node scripts/check-release-gate.mjs"
```

Verification:

```bash
npm run check:release-readiness
```

Expected: PASS.

- [x] **Step 2: Update release-readiness fixture**

The focused fixture test must include `check:release-gate` in required root scripts.

Verification:

```bash
npm run test -- scripts/__tests__/check-release-readiness.test.mjs -- --reporter=dot
```

Expected: PASS.

## Task 3: Documentation and Release Evidence

**Files:**
- Modify: `README.md`
- Modify: `packages/chart-engine/README.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

- [x] **Step 1: Document primary release gate command**

Docs should show `npm run check:release-gate` as the preferred single command and keep the expanded command sequence for auditability.

Verification:

```bash
rg -n "check:release-gate|expanded release gate|PLAYWRIGHT_CHANNEL=chrome" README.md packages/chart-engine/README.md docs/engine
```

- [x] **Step 2: Run release-relevant verification**

Verification:

```bash
npm run check:release-gate
npm run check:release-readiness
npm run guard:public-api
npm run guard:public-types
npm run guard:engine-boundary
git diff --check
```

Expected: all PASS.

- [x] **Step 3: Commit and push**

Commands:

```bash
git add package.json scripts docs README.md packages/chart-engine/README.md
git commit -m "Add release gate orchestrator"
git push origin codex/v0.1-full-engine
```

Verification:

```bash
git status --short --branch
git log --oneline -5
```

Expected: branch is clean and pushed to `origin/codex/v0.1-full-engine`.

Evidence:

- Completed by the final commit and push for this slice.

## Implementation Evidence

Completed on 2026-07-01:

- Added `scripts/check-release-gate.mjs` with the 15-step RC gate, inherited stdio, progress output, fail-fast command execution, and `PLAYWRIGHT_CHANNEL=chrome` scoped to e2e.
- Added root `check:release-gate` script.
- Updated release readiness required scripts and the focused test fixture to require `check:release-gate`.
- Updated root README, package README, testing strategy, and release candidate docs to make `npm run check:release-gate` the preferred single RC command while retaining the expanded release gate sequence.

Validation:

- `npm run test -- scripts/__tests__/check-release-readiness.test.mjs -- --reporter=dot` passed: 1 test file, 3 tests.
- `rg -n "check:release-gate|expanded release gate|PLAYWRIGHT_CHANNEL=chrome" README.md packages/chart-engine/README.md docs/engine` passed with matches in all requested doc surfaces.
- `npm run check:release-gate` passed:
  - `npm run test` passed: 44 test files, 508 tests.
  - `npm run typecheck` passed.
  - `npm run guard:engine-boundary` passed: 160 files scanned.
  - `npm run guard:public-api` passed: 148 runtime exports.
  - `npm run guard:public-types` passed: 393 type symbols.
  - `npm run guard:sdk-imports` passed.
  - `npm run build` passed for the Engine package and playground.
  - `npm run check:host-smoke` passed.
  - `npm run check:package-consumer` passed.
  - `npm run check:package-types` passed.
  - `npm run check:performance` passed: 1 test file, 2 tests.
  - `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
  - `npm run check:package-artifact` passed: 121 package files.
  - `npm pack --dry-run -w @simoncharts/chart-engine` passed: 121 package files.
  - `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `git diff --check` passed.
