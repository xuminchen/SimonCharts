# Chart Engine v1.0 Drawing Transform Engine Implementation Plan

**Goal:** Make resize and rotate transforms first-class, DOM-free Engine contracts and expose them through the drawing editor command system.

## Task 1: Transform Kernel

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingTransform.ts`
- Create: `packages/chart-engine/src/__tests__/drawingTransform.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

**Steps:**
1. Define `DrawingTransformPoint`, `DrawingResizeOptions`, and `DrawingRotateOptions`.
2. Implement `resizeDrawing()` and `resizeDrawings()` using `DrawingSelectionBounds` and `DrawingResizeHandlePosition`.
3. Implement `rotateDrawing()` and `rotateDrawings()` using supplied center and radians.
4. Preserve all non-anchor drawing fields and preserve anchor `time`, `index`, and `price` fields.
5. Leave non-finite screen coordinates unchanged.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingTransform.test.ts`

## Task 2: Editor Commands

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`

**Steps:**
1. Add `resizeSelected(options)` and `rotateSelected(options)` to the editor interface.
2. Add `resizeSelected` and `rotateSelected` command payloads.
3. Apply transforms only to selected editable drawings.
4. Preserve undo/redo, locked drawing protection, and update event emission.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`

## Task 3: Playground And SDK Consumers

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`
- Modify: `scripts/check-package-artifact.mjs`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`

**Steps:**
1. Add minimal drawing resize and rotate controls in the playground drawing workbench.
2. Exercise transform APIs from runtime and type package consumers.
3. Include the new declaration file in the package artifact check.
4. Update runtime and type public API snapshots intentionally.

**Verification:**
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts`
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run check:package-consumer`
- `npm run check:package-types`
- `npm run build`
- `npm run check:package-artifact`

## Task 4: Docs And Full Validation

**Files:**
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Document transform APIs, editor commands, and host responsibilities.
2. Record final validation evidence after the full gate passes.
3. Keep the Engine boundary explicit: hosts own DOM events and product workflows; Engine owns transform math.

**Verification:**
- `rg -n "resizeDrawing|rotateDrawing|resizeSelected|rotateSelected|Drawing Transform" docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-drawing-transform-engine-*.md`
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-types`
- `npm run build`
- `npm run check:package-artifact`
- `npm run check:performance`
- `npm run check:release-readiness`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- Focused transform/editor tests passed: `drawingTransform.test.ts` and `drawingEditorComplete.test.ts`, 2 test files, 22 tests.
- `npm run typecheck` passed.
- Focused drawing editor e2e passed: `apps/playground/tests/drawing-editor.spec.ts`, 6 browser tests.
- `npm run guard:public-api` passed: 123 runtime exports.
- `npm run guard:public-types` passed: 325 type symbols.
- `npm run check:package-types` passed.
- `npm run test` passed: 35 test files, 422 tests.
- `npm run guard:engine-boundary` passed: 148 files scanned.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm run check:package-artifact` passed: 116 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 116 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 34 browser tests.
