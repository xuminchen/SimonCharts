# Chart Engine Isolated Host Smoke Implementation Plan

> **For agentic workers:** Use a worker subagent for the bounded implementation. The worker owns the script and docs listed below. Do not revert edits made by others; this repo may have concurrent work.

**Goal:** Add a release gate proving the packed `@simoncharts/chart-engine` package can be installed into a clean neutral host project and consumed from the package root.

**Architecture:** Add `scripts/check-host-smoke.mjs`. It should create a temp host project, pack the Engine package into that temp directory, install the produced `.tgz`, write a neutral ESM smoke script, run it with Node, and remove the temp directory in `finally`. Add `check:host-smoke` to root scripts and release readiness. Document the gate in host integration, testing strategy, release candidate evidence, and this implementation plan.

**Tech Stack:** Node.js ESM scripts, npm pack/install, temporary filesystem fixtures, package-root SDK imports.

## File Structure

- Add `scripts/check-host-smoke.mjs`
- Modify `package.json`
- Modify `scripts/check-release-readiness.mjs`
- Modify `README.md`
- Modify `packages/chart-engine/README.md`
- Modify `docs/engine/host-integration.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Add Isolated Host Smoke Script

**Files:**
- Add: `scripts/check-host-smoke.mjs`

- [x] **Step 1: Create temp host project and pack Engine tarball**

The script should create a temporary directory, run `npm pack --json -w @simoncharts/chart-engine --pack-destination <temp>`, and locate the generated tarball.

Verification:

```bash
npm run build
node scripts/check-host-smoke.mjs
```

Expected: PASS.

Evidence:

- `npm run build` passed for the Engine package and playground.
- `node scripts/check-host-smoke.mjs` passed through root script coverage below; it created a temporary host outside the workspace, packed `@simoncharts/chart-engine`, verified `dist/index.js` and `dist/index.d.ts` were present, and removes the temp directory in `finally` on success or failure.

- [x] **Step 2: Install tarball and run neutral host script**

The script should write a minimal `package.json`, install the tarball into the temp host, write `host-smoke.mjs`, and run it with Node. The host script must import only from `@simoncharts/chart-engine`.

Representative checks:

1. `createEngineCapabilityManifest()` reports package name, API version, 17 series types, and 63 drawing types.
2. `createChartEngine()` accepts `fixtureDailyCandleSeries`, emits neutral state, and round-trips a serialized layout.
3. `createDrawingEditor()` creates and edits a neutral drawing through commands.
4. `calculateCoreIndicator("MA", fixtureDailyCandleSeries)` returns line output.
5. `createChartExtensionLifecycle()` installs/uninstalls a namespaced neutral extension contribution.

Verification:

```bash
npm run check:host-smoke
```

Expected: PASS.

Evidence:

- `npm run check:host-smoke` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- The gate installed the generated tarball by absolute path into a temporary non-workspace host project, asserted the installed package was not a symlink, and ran a neutral ESM script importing only from `@simoncharts/chart-engine`.
- The host smoke covered capability manifest counts, chart engine state/events, layout snapshot round-trip, drawing editor command flow, MA line output, and extension lifecycle install/uninstall.

## Task 2: Release Gate Integration

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-release-readiness.mjs`

- [x] **Step 1: Add root script**

Add:

```json
"check:host-smoke": "node scripts/check-host-smoke.mjs"
```

Verification:

```bash
npm run check:host-smoke
```

Evidence:

- `package.json` now defines `check:host-smoke` as `node scripts/check-host-smoke.mjs`.
- `npm run check:host-smoke` passed.

- [x] **Step 2: Require the script in release readiness**

Add `check:host-smoke` to the required release scripts.

Verification:

```bash
npm run check:release-readiness
```

Expected: PASS.

Evidence:

- `scripts/check-release-readiness.mjs` now requires `check:host-smoke`.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `scripts/__tests__/check-release-readiness.test.mjs` fixture was updated to mirror the new required script so the release-readiness unit test matches the gate.

## Task 3: Documentation and Release Evidence

**Files:**
- Modify: `docs/engine/host-integration.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

- [x] **Step 1: Document the host smoke gate**

Docs should state that `check:host-smoke` installs the packed tarball into a temporary non-workspace host and imports from the package root only.

Verification:

```bash
rg -n "check:host-smoke|isolated host|temporary host" docs/engine package.json scripts/check-release-readiness.mjs
```

Evidence:

- `README.md`, `packages/chart-engine/README.md`, `docs/engine/host-integration.md`, `docs/engine/testing-strategy.md`, and `docs/engine/release-candidate.md` now document the `check:host-smoke` release gate. Engine docs state that the gate installs the packed tarball into a temporary non-workspace host and uses package-root imports only.
- `rg -n "check:host-smoke|isolated host|temporary host" docs/engine package.json scripts/check-release-readiness.mjs` found the expected script and documentation references.

- [x] **Step 2: Run release-relevant gates**

Verification:

```bash
npm run build
npm run check:host-smoke
npm run check:release-readiness
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run typecheck
npm run guard:engine-boundary
npm run test -- --run
git diff --check
```

Expected: all PASS.

Evidence:

- `npm run build` passed for the Engine package and playground.
- `npm run check:host-smoke` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run test -- --run` passed: 44 test files, 508 tests.
- `git diff --check` passed.

- [x] **Step 3: Commit and push**

Commands:

```bash
git add package.json scripts docs
git commit -m "Add isolated host smoke gate"
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
