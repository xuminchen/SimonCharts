# Chart Engine v1.0 Drawing Property Schema Implementation Plan

**Goal:** Add an Engine-owned, host-independent drawing property schema so complete drawing editor property panels can be generated from `@simoncharts/chart-engine` metadata instead of host hardcoding.

## Task 1: Engine Property Schema

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingPropertySchema.ts`
- Create: `packages/chart-engine/src/__tests__/drawingPropertySchema.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

**Steps:**
1. Define neutral property metadata types for style, content, and state properties.
2. Add built-in property definitions for `color`, `lineWidth`, `lineDash`, `fill`, `textColor`, `fontSize`, `text`, `visible`, and `locked`.
3. Add helper predicates for text-capable and fill-capable drawing types.
4. Add `getDrawingPropertySchema(type)` and `getDrawingPropertyDefinitionsForDrawing(drawing)`.
5. Return cloned property definitions so hosts cannot mutate shared Engine metadata.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingPropertySchema.test.ts`

## Task 2: Playground Uses Engine Schema

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

**Steps:**
1. Replace the hardcoded drawing property panel control list with schema-driven controls.
2. Keep the playground as a host/demo layer; do not move DOM code into the Engine package.
3. Preserve existing test ids for color, width, and text controls.
4. Add visible controls for fill, text color, font size, visible, and locked where the schema says they apply.

**Verification:**
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts`

## Task 3: Public API And SDK Consumers

**Files:**
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`

**Steps:**
1. Export property schema APIs from the package root.
2. Update runtime API snapshot intentionally.
3. Update public type API snapshot intentionally.
4. Exercise runtime and type-only package-root consumption.

**Verification:**
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run check:package-consumer`
- `npm run check:package-types`

## Task 4: Documentation And Release Evidence

**Files:**
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Document property schema APIs and intended host usage.
2. Keep DOM rendering, persistence, collaboration, and business workflows outside Engine scope.
3. Record final validation evidence and updated API/package counts.

**Verification:**
- `rg -n "DrawingProperty|getDrawingProperty|property schema" docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-drawing-property-schema-*.md`

## Task 5: Full Validation

**Verification:**
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-artifact`
- `npm run check:package-types`
- `npm run check:performance`
- `npm run check:release-readiness`
- `npm run build`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- Focused Engine schema tests passed: `drawingPropertySchema.test.ts` and `drawingEditorComplete.test.ts`, 2 test files, 18 tests.
- Focused drawing editor e2e passed: `apps/playground/tests/drawing-editor.spec.ts`, 5 browser tests.
- `npm run test` passed: 33 test files, 399 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 143 files scanned.
- `npm run guard:public-api` passed: 114 runtime exports.
- `npm run guard:public-types` passed: 306 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed and covers drawing property schema runtime consumption.
- `npm run check:package-artifact` passed: 113 package files.
- `npm run check:package-types` passed and covers drawing property schema public types.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 113 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 33 browser tests.
