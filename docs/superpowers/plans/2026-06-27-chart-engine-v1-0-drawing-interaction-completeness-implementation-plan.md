# Chart Engine v1.0 Drawing Interaction Completeness Implementation Plan

**Goal:** Add DOM-free selection and edit interaction primitives to the drawing editor so hosts can build complete drawing editor interactions from Engine APIs.

## Task 1: Interaction Primitives

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingInteraction.ts`
- Create: `packages/chart-engine/src/__tests__/drawingInteractionPrimitives.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

**Steps:**
1. Define `DrawingSelectionBounds`, `DrawingEditHandle`, `DrawingEditHandleKind`, and `DrawingResizeHandlePosition`.
2. Add `getDrawingEditHandles(drawing)` using anchors and drawing bounds.
3. Add `getDrawingSelectionBounds(drawings)` for selected group geometry.
4. Keep all APIs DOM-free and based on drawing coordinates only.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingInteractionPrimitives.test.ts`

## Task 2: Editor Commands

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditState.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`

**Steps:**
1. Add `selectDrawingsInBounds(bounds, options)` to the editor and command union.
2. Add `nudgeSelected(delta)` to the editor and command union.
3. Add `getSelectedEditHandles()` to expose Engine-derived handles.
4. Preserve locked drawing behavior for mutations.
5. Preserve selection order and undo/redo behavior.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`

## Task 3: Playground And SDK Consumers

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`

**Steps:**
1. Use arrow keys to nudge selected drawings when the drawing editor has selection.
2. Show selected edit handle count in the drawing workbench.
3. Exercise new APIs from runtime and type package consumers.
4. Update public API and public type snapshots intentionally.

**Verification:**
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts`
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run check:package-consumer`
- `npm run check:package-types`

## Task 4: Docs And Full Validation

**Files:**
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Document box selection, nudging, and edit handle metadata.
2. Keep full resize/rotate transforms as later work.
3. Record final validation evidence.

**Verification:**
- `rg -n "selectDrawingsInBounds|nudgeSelected|getSelectedEditHandles|getDrawingEditHandles" docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-drawing-interaction-completeness-*.md`
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

- Focused drawing interaction tests passed: `drawingInteractionPrimitives.test.ts` and `drawingEditorComplete.test.ts`, 2 test files, 19 tests.
- Focused drawing editor e2e passed: `apps/playground/tests/drawing-editor.spec.ts`, 6 browser tests.
- `npm run test` passed: 34 test files, 415 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 146 files scanned.
- `npm run guard:public-api` passed: 119 runtime exports.
- `npm run guard:public-types` passed: 318 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed and covers drawing edit handles, bounds selection, and nudging.
- `npm run check:package-artifact` passed: 115 package files.
- `npm run check:package-types` passed and covers drawing interaction public types.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 115 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 34 browser tests.
