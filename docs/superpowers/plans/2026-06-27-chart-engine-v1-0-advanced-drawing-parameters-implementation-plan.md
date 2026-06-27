# Chart Engine v1.0 Advanced Drawing Parameters Implementation Plan

**Goal:** Add advanced drawing parameter metadata, editor commands, and rendering consumption so Fibonacci, Gann, position, and range tools can be configured through Engine-owned neutral APIs.

## Task 1: Property Schema Parameters

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingPropertySchema.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingPropertySchema.test.ts`

**Steps:**
1. Add a `parameters` property scope with `metadataKey`.
2. Add `numberList` as a property value type.
3. Add parameter definitions for Fibonacci levels, Gann fan ratios, range label, and position label.
4. Keep schema outputs cloned and safe for host mutation.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingPropertySchema.test.ts`

## Task 2: Drawing Editor Metadata Command

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`

**Steps:**
1. Add `updateSelectedMetadata(metadata)` to `DrawingEditor`.
2. Add `updateSelectedMetadata` to `DrawingEditorCommand`.
3. Shallow-merge metadata into editable selected drawings.
4. Preserve locked drawing behavior and undo/redo.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`

## Task 3: Figure And Renderer Consumption

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingFigures.ts`
- Modify: `packages/chart-engine/src/render/drawing/renderers/fibonacciDrawingRenderer.ts`
- Modify: `packages/chart-engine/src/render/drawing/renderers/positionDrawingRenderer.ts`
- Modify: `packages/chart-engine/src/render/drawing/renderers/rangeDrawingRenderer.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingCoverage.test.ts`

**Steps:**
1. Use metadata Fibonacci levels when valid; otherwise keep existing defaults.
2. Use metadata Gann fan ratios when valid; otherwise keep existing defaults.
3. Use metadata labels for position/range labels where supported.
4. Keep invalid metadata harmless by falling back to defaults.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingCoverage.test.ts`

## Task 4: Playground And SDK Consumers

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`

**Steps:**
1. Render parameter controls from schema in the playground property panel.
2. Preserve existing generic style/content/state controls.
3. Exercise metadata commands and schema types from package-root consumers.
4. Update runtime and type API snapshots intentionally.

**Verification:**
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts`
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run check:package-consumer`
- `npm run check:package-types`

## Task 5: Docs And Full Validation

**Files:**
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Document advanced drawing parameters and metadata command behavior.
2. Update release evidence counts after full validation.
3. Keep host responsibilities explicit.

**Verification:**
- `rg -n "advanced drawing|updateSelectedMetadata|numberList|metadata" docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-advanced-drawing-parameters-*.md`
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

- Focused Engine parameter tests passed: `drawingPropertySchema.test.ts`, `drawingEditorComplete.test.ts`, and `drawingCoverage.test.ts`, 3 test files, 73 tests.
- Focused drawing renderer coverage passed: `drawingRenderers.test.ts` and `drawingCoverage.test.ts`, 2 test files, 120 tests.
- Focused drawing editor e2e passed: `apps/playground/tests/drawing-editor.spec.ts`, 6 browser tests.
- `npm run test` passed: 33 test files, 409 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 144 files scanned.
- `npm run guard:public-api` passed: 114 runtime exports.
- `npm run guard:public-types` passed: 308 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed and covers `updateSelectedMetadata`.
- `npm run check:package-artifact` passed: 114 package files.
- `npm run check:package-types` passed and covers `DrawingParameterPropertyDefinition`.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 114 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 34 browser tests.
