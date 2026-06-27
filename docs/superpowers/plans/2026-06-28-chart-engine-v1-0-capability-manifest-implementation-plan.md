# Chart Engine Capability Manifest Implementation Plan

> **For agentic workers:** Use subagent-driven implementation for bounded code slices where possible. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, package-root Engine capability manifest that summarizes SimonCharts Engine support without coupling to any host app.

**Architecture:** Create a pure `engineCapabilityManifest` module under `packages/chart-engine/src/engine/`. It imports Engine-owned constants only, returns defensive array copies, and is exported through `packages/chart-engine/src/index.ts`.

**Tech Stack:** TypeScript, Vitest, package-root API/type guards, SDK consumer smoke tests.

## File Structure

- Create `packages/chart-engine/src/engine/engineCapabilityManifest.ts`
- Create `packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts`
- Modify `packages/chart-engine/src/index.ts`
- Modify `scripts/check-package-consumer.mjs`
- Modify `scripts/fixtures/package-consumer-types.ts`
- Modify `packages/chart-engine/api-surface.json`
- Modify `packages/chart-engine/api-types.json`
- Modify `docs/engine/overview.md`
- Modify `docs/engine/public-api.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Engine Capability Manifest API

**Files:**
- Create: `packages/chart-engine/src/engine/engineCapabilityManifest.ts`
- Create: `packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [x] **Step 1: Add manifest model and factory**

Create a module that exports:

```ts
export interface EngineCapabilityManifest {
  packageName: "@simoncharts/chart-engine";
  packageVersion: "1.0.0-rc.0";
  releaseChannel: "rc";
  seriesTypes: SeriesType[];
  drawingTypes: BuiltInDrawingType[];
  drawingTools: EngineDrawingToolCapability[];
  coreIndicatorIds: CoreIndicatorId[];
  visualOutputTypes: VisualOutputType[];
  drawingEditorCapabilities: DrawingEditorCapability[];
  interactionCapabilities: InteractionCapability[];
  extensionContributionTypes: ExtensionContributionType[];
}

export function createEngineCapabilityManifest(): EngineCapabilityManifest;
```

Use only Engine-owned constants and literal capability names. Do not import host packages or product vocabulary.

- [x] **Step 2: Add focused tests**

Unit tests must verify:

- package metadata and release channel
- count alignment with `supportedSeriesTypes`, `drawingTypes`, and `coreIndicatorIds`
- drawing tool summaries mirror `builtInDrawingToolDefinitions`
- returned arrays are defensive copies
- no host/business vocabulary appears in stringified manifest

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot
npm run typecheck -w @simoncharts/chart-engine
npm run guard:engine-boundary
```

Expected: all PASS.

## Task 2: Public API and SDK Coverage

**Files:**
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`

- [x] **Step 1: Add package-root consumer coverage**

Runtime consumer should import and exercise:

```js
createEngineCapabilityManifest
```

Type fixture should import and use:

```ts
EngineCapabilityManifest;
EngineDrawingToolCapability;
DrawingEditorCapability;
InteractionCapability;
ExtensionContributionType;
VisualOutputType;
```

- [x] **Step 2: Update public API snapshots intentionally**

Run before snapshot updates:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
```

Expected: API/type guards fail only for the newly exported manifest symbols.

Then update snapshots and verify:

```bash
node -e 'import("@simoncharts/chart-engine").then((m)=>import("node:fs").then((fs)=>fs.writeFileSync("packages/chart-engine/api-surface.json", JSON.stringify(Object.keys(m).sort(), null, 2)+"\n")))'
node scripts/check-public-types.mjs --write
npm run guard:public-api
npm run guard:public-types
npm run check:package-consumer
npm run check:package-types
```

Expected: all PASS.

## Task 3: Documentation and Release Evidence

**Files:**
- Modify: `docs/engine/overview.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-capability-manifest-implementation-plan.md`

- [x] **Step 1: Document capability manifest**

Docs must state:

- the manifest is host-independent
- hosts can use it for diagnostics, docs, compatibility checks, and onboarding
- the manifest does not control host feature flags, product permissions, persistence, remote plugins, or collaboration
- current counts: 17 series types, 63 built-in drawing types, 16 core indicators

- [x] **Step 2: Run release-relevant verification**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot
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

- [x] **Step 3: Commit and push**

Commit:

```bash
git add packages/chart-engine/src packages/chart-engine/api-surface.json packages/chart-engine/api-types.json scripts docs
git commit -m "Add engine capability manifest"
git push origin codex/v0.1-full-engine
```

Task 1 evidence recorded on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot` passed: 5 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed.

Task 2 evidence recorded on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `createEngineCapabilityManifest`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `DrawingEditorCapability`, `EngineCapabilityManifest`, `EngineDrawingToolCapability`, `ExtensionContributionType`, `InteractionCapability`, and `createEngineCapabilityManifest`.
- Runtime API snapshot was intentionally refreshed to 142 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 373 type symbols.
- `npm run guard:public-api` passed: 142 runtime exports.
- `npm run guard:public-types` passed: 373 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.

Release-relevant evidence recorded on 2026-06-28:

- `npm run test` passed: 42 test files, 471 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run guard:public-api` passed: 142 runtime exports.
- `npm run guard:public-types` passed: 373 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.
