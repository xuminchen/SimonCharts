# Chart Engine v1.0 Drawing Handle Drag Flow Implementation Plan

**Goal:** Add a reusable, DOM-free handle drag operation flow so hosts can build complete drawing handle interactions without duplicating Engine geometry rules.

## Task 1: Handle Drag Module

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingHandleDrag.ts`
- Create: `packages/chart-engine/src/__tests__/drawingHandleDrag.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

**Steps:**
1. Define `DrawingHandleDragOperation`, `DrawingHandleDragKind`, `DrawingHandleDragPreview`, and option types.
2. Implement `hitTestDrawingEditHandle(handles, point, options)`.
3. Implement `beginDrawingHandleDrag(options)` from `DrawingEditHandle`, selected ids, drawings, and start point.
4. Implement `updateDrawingHandleDrag(operation, point)` to return preview drawings and the neutral command for the current point.
5. Implement `finishDrawingHandleDrag(operation, point)` to return the final neutral command.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingHandleDrag.test.ts`

## Task 2: Editor Command Support

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`

**Steps:**
1. Add `dragAnchor` to `DrawingEditorCommand`.
2. Route the command through existing `dragAnchor()` behavior.
3. Preserve locked drawing protection and undo/redo.

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
1. Add selected-handle hit-testing before drawing body hit-testing.
2. Store active handle drag operation and preview drawings in the playground.
3. Render preview drawings during pointer move.
4. Commit final Engine command on pointer-up.
5. Exercise handle drag APIs from runtime and type package consumers.
6. Include the new declaration file in the package artifact check.

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
1. Document the handle drag flow and host boundary.
2. Record final validation evidence after the full gate passes.
3. Close the short-lived subagent used for review.

**Verification:**
- `rg -n "hitTestDrawingEditHandle|beginDrawingHandleDrag|finishDrawingHandleDrag|handle drag" docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-drawing-handle-drag-flow-*.md`
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

- Focused handle drag/editor tests passed: `drawingHandleDrag.test.ts` and `drawingEditorComplete.test.ts`, 2 test files, 22 tests.
- `npm run typecheck` passed.
- Focused drawing editor e2e passed: `apps/playground/tests/drawing-editor.spec.ts`, 7 browser tests.
- `npm run guard:public-api` passed: 128 runtime exports.
- `npm run guard:public-types` passed: 335 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run test` passed: 36 test files, 428 tests.
- `npm run guard:engine-boundary` passed: 150 files scanned.
- `npm run guard:sdk-imports` passed.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm run check:package-artifact` passed: 117 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 117 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 35 browser tests.
- Review subagent `019f094b-8635-79b1-b70b-fa437ac24deb` was closed after its code-reading result was incorporated.
