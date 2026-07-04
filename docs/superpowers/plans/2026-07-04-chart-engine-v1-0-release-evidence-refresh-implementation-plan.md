# Chart Engine Release Evidence Refresh Implementation Plan

> **For agentic workers:** Use a worker subagent for the bounded verification and doc update. Do not revert edits made by others; this repo may have concurrent work.

**Goal:** Refresh current v1.0 RC acceptance evidence from `npm run check:release-gate`.

**Architecture:** Run the single release gate, then update only the current acceptance evidence section in `docs/engine/release-candidate.md` plus this plan's evidence. Leave historical focused evidence sections untouched.

**Tech Stack:** Markdown docs, existing npm release gate.

## File Structure

- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Run Current Release Gate

**Files:**
- No file changes.

- [x] **Step 1: Run the release gate**

Verification:

```bash
npm run check:release-gate
```

Result: PASS on 2026-07-04. `[release-gate] passed.`

## Task 2: Refresh Current Acceptance Evidence

**Files:**
- Modify: `docs/engine/release-candidate.md`

- [x] **Step 1: Update current evidence date and gate summary**

Change the current acceptance evidence date to 2026-07-04 and include `npm run check:release-gate` as the first evidence item.

Verification:

```bash
rg -n "Current acceptance evidence refreshed on 2026-07-04|check:release-gate" docs/engine/release-candidate.md
```

Result: PASS. Current evidence now uses 2026-07-04 and lists `npm run check:release-gate` first.

## Task 3: Final Checks

**Files:**
- Modify this implementation plan with final evidence.

- [x] **Step 1: Run focused guards**

Verification:

```bash
npm run check:release-readiness
npm run guard:public-api
npm run guard:public-types
npm run guard:engine-boundary
git diff --check
```

Result: all PASS on 2026-07-04.

- [x] **Step 2: Commit and push**

Commands:

```bash
git add docs/engine/release-candidate.md docs/superpowers/plans/2026-07-04-chart-engine-v1-0-release-evidence-refresh-*.md
git commit -m "Refresh release gate evidence"
git push origin codex/v0.1-full-engine
```

Verification:

```bash
git status --short --branch
```

Result: PASS after final commit and push for this slice.

## Verification Evidence

- `npm run check:release-gate` passed: 44 test files, 508 tests; 160 boundary files; 148 runtime exports; 393 type symbols; 121 package files; 43 browser tests.
- `rg -n "Current acceptance evidence refreshed on 2026-07-04|check:release-gate" docs/engine/release-candidate.md` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `git diff --check` passed.
