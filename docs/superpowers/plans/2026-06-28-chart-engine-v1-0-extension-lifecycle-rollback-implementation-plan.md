# Chart Engine Extension Lifecycle Rollback Implementation Plan

> **For agentic workers:** Prefer subagent-driven implementation for the bounded code slice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ChartExtensionLifecycle.install()` atomic for local registry mutations when a contribution registry throws during install.

**Architecture:** Keep the public lifecycle contract unchanged. Add internal rollback handling around the existing snapshot registration loop in `packages/chart-engine/src/extensions/chartExtension.ts`. Reuse `ContributionSnapshot.previous` and `restoreContributionSnapshot()` where possible, but ensure rollback applies only to contributions that were actually registered during the failed attempt. Do not change `validateInstall()` behavior.

**Tech Stack:** TypeScript, Vitest, package-root API/type guards, SDK consumer smoke tests.

## File Structure

- Modify `packages/chart-engine/src/extensions/chartExtension.ts`
- Modify `packages/chart-engine/src/__tests__/chartExtension.test.ts`
- Modify `docs/engine/platform-extensibility.md`
- Modify `docs/engine/public-api.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Atomic Lifecycle Install Rollback

**Files:**
- Modify: `packages/chart-engine/src/extensions/chartExtension.ts`
- Modify: `packages/chart-engine/src/__tests__/chartExtension.test.ts`

- [x] **Step 1: Add focused failing tests**

Cover:

1. failed second contribution registration rolls back the first registered contribution
2. failed registration restores a previous registry entry that the failed attempt temporarily replaced
3. failed registration leaves lifecycle state unchanged and extension not installed
4. failed registration does not assign contribution owners, so a later valid extension can install the same contribution
5. duplicate id/conflict behavior remains unchanged

Verification:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot
```

Expected before implementation: new rollback tests fail.

- [x] **Step 2: Implement rollback around registry registration**

Implementation rules:

- only rollback snapshots whose `register()` already succeeded in this install attempt
- rollback in reverse registration order
- preserve the original thrown error
- do not set contribution owners until all registrations succeed
- do not set lifecycle records until all registrations succeed
- do not mutate extension input

Verification:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot
npm run typecheck -w @simoncharts/chart-engine
npm run guard:engine-boundary
```

Expected: all PASS.

## Task 2: Documentation and SDK Stability

**Files:**
- Modify: `docs/engine/platform-extensibility.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`

- [x] **Step 1: Document atomic local rollback semantics**

Docs must state:

- lifecycle install mutates local registries only after install begins
- if a registry throws during install, already-applied local contributions from that attempt are rolled back
- lifecycle records and owner tracking are only committed after all contribution registrations succeed
- rollback is local mutation cleanup, not plugin sandboxing, trust policy, persistence, or host workflow compensation

Verification:

```bash
rg -n "rollback|atomic|partial" docs/engine/platform-extensibility.md docs/engine/public-api.md docs/engine/testing-strategy.md docs/engine/release-candidate.md
```

Expected: docs mention atomic rollback and preserve host boundary wording.

- [x] **Step 2: Confirm public API and SDK stability**

No new public runtime exports or type symbols are expected.

Verification:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
npm run check:package-consumer
npm run check:package-types
```

Expected: all PASS without snapshot updates.

## Task 3: Release-Relevant Verification and Commit

- [x] **Step 1: Run release-relevant gates**

Verification:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run check:release-readiness
npm run build
git diff --check
```

Expected: all PASS.

- [x] **Step 2: Commit and push**

Commands:

```bash
git add packages/chart-engine/src docs
git commit -m "Harden extension lifecycle install rollback"
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

- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot` passed: 25 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run build -w @simoncharts/chart-engine` passed.
- `rg -n "rollback|atomic|partial|committed only after" docs/engine/platform-extensibility.md docs/engine/public-api.md docs/engine/testing-strategy.md docs/engine/release-candidate.md` verified docs mention atomic rollback semantics.
- `npm run guard:public-api` passed unchanged: 146 runtime exports.
- `npm run guard:public-types` passed unchanged: 387 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run guard:sdk-imports` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run typecheck` passed.
- `npm run build` passed for the Engine package and playground.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run test` passed: 42 test files, 495 tests.
- `git diff --check` passed.
