# Chart Engine Capability Requirements Implementation Plan

> **For agentic workers:** Use subagent-driven implementation for bounded code slices where possible. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, package-root compatibility checker for `EngineCapabilityManifest`.

**Architecture:** Extend `packages/chart-engine/src/engine/engineCapabilityManifest.ts` with neutral requirement/check result types and a pure checker function. It must compare only manifest fields, return deterministic missing groups, and avoid host/product vocabulary.

**Tech Stack:** TypeScript, Vitest, package-root API/type guards, SDK consumer smoke tests.

## File Structure

- Modify `packages/chart-engine/src/engine/engineCapabilityManifest.ts`
- Modify `packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts`
- Modify `scripts/check-package-consumer.mjs`
- Modify `scripts/fixtures/package-consumer-types.ts`
- Modify `packages/chart-engine/api-surface.json`
- Modify `packages/chart-engine/api-types.json`
- Modify `docs/engine/public-api.md`
- Modify `docs/engine/testing-strategy.md`
- Modify `docs/engine/release-candidate.md`
- Modify this implementation plan with final evidence

## Task 1: Engine Requirements Checker API

**Files:**
- Modify: `packages/chart-engine/src/engine/engineCapabilityManifest.ts`
- Modify: `packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts`

- [x] **Step 1: Add requirement and result types**

Export:

```ts
export type EngineCapabilityRequirementKey =
  | "seriesTypes"
  | "drawingTypes"
  | "coreIndicatorIds"
  | "visualOutputTypes"
  | "drawingEditorCapabilities"
  | "interactionCapabilities"
  | "extensionContributionTypes";

export type EngineCapabilityRequirements = Partial<
  Record<EngineCapabilityRequirementKey, readonly string[]>
>;

export interface EngineCapabilityRequirementGap {
  key: EngineCapabilityRequirementKey;
  values: string[];
}

export interface EngineCapabilityCheckResult {
  compatible: boolean;
  missing: EngineCapabilityRequirementGap[];
}
```

- [x] **Step 2: Add pure checker**

Export:

```ts
export function checkEngineCapabilityRequirements(
  manifest: EngineCapabilityManifest,
  requirements: EngineCapabilityRequirements
): EngineCapabilityCheckResult;
```

Rules:

- compare every supported requirement key in a fixed order
- ignore omitted requirement groups
- return only missing values for groups with gaps
- preserve caller value order inside each missing group
- do not mutate `manifest` or `requirements`

- [x] **Step 3: Add focused tests**

Tests must verify:

- all manifest-derived requirements are compatible
- unknown future values are reported as missing
- multiple missing groups preserve deterministic group order
- missing values preserve caller order
- inputs are not mutated
- stringified result remains free of host/business vocabulary

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
checkEngineCapabilityRequirements
```

Type fixture should import and use:

```ts
EngineCapabilityRequirements;
EngineCapabilityRequirementKey;
EngineCapabilityRequirementGap;
EngineCapabilityCheckResult;
```

- [x] **Step 2: Update public API snapshots intentionally**

Run before snapshot updates:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
```

Expected: API/type guards fail only for the newly exported checker symbols.

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
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-capability-requirements-implementation-plan.md`

- [x] **Step 1: Document requirements checker**

Docs must state:

- the checker compares neutral manifest fields only
- it is for diagnostics, docs, onboarding, and compatibility checks
- it is not a host feature flag, permission, persistence, routing, plugin trust, or collaboration system
- unknown future strings are reported as missing rather than rejected

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
git commit -m "Add engine capability requirement checks"
git push origin codex/v0.1-full-engine
```

Task 1 evidence recorded on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot` passed: 11 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed.

Task 2 evidence recorded on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `checkEngineCapabilityRequirements`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `EngineCapabilityCheckResult`, `EngineCapabilityRequirementGap`, `EngineCapabilityRequirementKey`, `EngineCapabilityRequirements`, and `checkEngineCapabilityRequirements`.
- Runtime API snapshot was intentionally refreshed to 143 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 378 type symbols.
- `npm run guard:public-api` passed: 143 runtime exports.
- `npm run guard:public-types` passed: 378 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.

Release-relevant evidence recorded on 2026-06-28:

- `npm run test` passed: 42 test files, 477 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run guard:public-api` passed: 143 runtime exports.
- `npm run guard:public-types` passed: 378 type symbols.
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
