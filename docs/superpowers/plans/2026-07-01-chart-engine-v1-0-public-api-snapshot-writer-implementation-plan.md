# Chart Engine Public API Snapshot Writer Implementation Plan

> **For agentic workers:** Prefer subagent-driven implementation for the bounded tooling slice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic `--write` support to `scripts/check-public-api.mjs` and verify it without changing the current public API snapshot content.

**Architecture:** Mirror the existing `scripts/check-public-types.mjs --write` behavior for runtime exports. Keep `npm run guard:public-api` behavior unchanged when `--write` is not passed. Add focused tests for the script through a small Node test file that creates temporary fixtures and invokes the script in both read and write modes. Include script tests in the repo Vitest configuration so the focused command and full `npm run test` both execute them.

**Tech Stack:** Node.js ESM scripts, Vitest, package-root runtime import guard.

## File Structure

- Modify `scripts/check-public-api.mjs`
- Add `scripts/__tests__/check-public-api.test.mjs`
- Modify `vitest.config.ts`
- Modify `docs/engine/public-api.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Add Runtime Snapshot Write Mode

**Files:**
- Modify: `scripts/check-public-api.mjs`

- [x] **Step 1: Refactor script around reusable functions**

Keep behavior:

- reads `packages/chart-engine/api-surface.json`
- imports `@simoncharts/chart-engine`
- sorts actual runtime exports
- compares added/removed exports when `--write` is not passed

Verification:

```bash
npm run guard:public-api
```

Expected: PASS with current snapshot.

- [x] **Step 2: Add `--write` behavior**

Rules:

- if `process.argv.includes("--write")`, write actual sorted runtime export names to `api-surface.json`
- format with `JSON.stringify(actual, null, 2)` plus trailing newline
- print `Public API snapshot written (<count> runtime exports).`
- do not compare expected snapshot in write mode

Verification:

```bash
node scripts/check-public-api.mjs --write
npm run guard:public-api
git diff -- packages/chart-engine/api-surface.json
```

Expected: guard passes and api-surface diff is empty in this slice.

## Task 2: Focused Script Tests

**Files:**
- Add: `scripts/__tests__/check-public-api.test.mjs`

- [x] **Step 1: Add script tests**

Test through temporary fixture directories:

1. matching snapshot exits 0 and prints guard count
2. changed snapshot exits non-zero and prints added/removed exports
3. `--write` writes sorted JSON with trailing newline and exits 0

Implementation note:

- Prefer spawning `node scripts/check-public-api.mjs` with a temporary `cwd`.
- Create temporary `packages/chart-engine/api-surface.json` and `node_modules/@simoncharts/chart-engine` ESM fixture.
- Do not mutate the real snapshot from tests.

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

- [x] **Step 1: Document matching runtime/type snapshot workflow**

Docs must state:

- `node scripts/check-public-api.mjs --write` intentionally refreshes runtime snapshots
- `node scripts/check-public-types.mjs --write` intentionally refreshes type snapshots
- both guards remain package-root-only and are not host API checks

Verification:

```bash
rg -n "check-public-api\\.mjs --write|check-public-types\\.mjs --write|runtime snapshot" docs/engine/public-api.md docs/engine/testing-strategy.md docs/engine/release-candidate.md
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
git commit -m "Add public API snapshot write mode"
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

- `npm run test -- scripts/__tests__/check-public-api.test.mjs -- --reporter=dot` passed: 3 tests.
- `node scripts/check-public-api.mjs --write` passed and left `packages/chart-engine/api-surface.json` unchanged.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 43 test files, 502 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.
