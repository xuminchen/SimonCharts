# Chart Engine v1.0 Drawing Selection Box Flow Implementation Plan

**Goal:** Add a reusable, DOM-free selection-box operation flow so hosts can build consistent box selection without duplicating Engine selection rules.

## Task 1: Selection Box Module

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingSelectionBox.ts`
- Create: `packages/chart-engine/src/__tests__/drawingSelectionBox.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

**Steps:**
1. Define `DrawingSelectionBoxOperation`, `DrawingSelectionBoxOptions`, and `DrawingSelectionBoxPreview`.
2. Implement `beginDrawingSelectionBox(options)`.
3. Implement `updateDrawingSelectionBox(operation, point)` to return normalized bounds, selected ids, and command.
4. Implement `finishDrawingSelectionBox(operation, point)` to return the final command.
5. Keep the module DOM-free and based only on neutral drawings, points, and selection options.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingSelectionBox.test.ts`

## Task 2: Playground Integration

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

**Steps:**
1. Start selection box on Shift+pointerdown when no handle/drawing body is hit.
2. Preview selected ids during pointermove.
3. Commit final `selectDrawingsInBounds` command on pointerup.
4. Leave normal no-modifier chart drag pan behavior unchanged.

**Verification:**
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts`

## Task 3: SDK Consumers

**Files:**
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`
- Modify: `scripts/check-package-artifact.mjs`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`

**Steps:**
1. Exercise selection box flow APIs from runtime package consumer.
2. Exercise selection box flow types from type package consumer.
3. Include the new declaration file in the package artifact check.
4. Update public API and public type snapshots intentionally.

**Verification:**
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
1. Document selection box operation flow and host boundary.
2. Record final validation evidence after the full gate passes.
3. Close the short-lived subagent used for review.

**Verification:**
- `rg -n "beginDrawingSelectionBox|finishDrawingSelectionBox|selection box" docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-drawing-selection-box-flow-*.md`
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

- Focused selection box/editor tests passed: `drawingSelectionBox.test.ts` and `drawingEditorComplete.test.ts`, 2 test files, 21 tests.
- `npm run typecheck` passed.
- Focused drawing editor e2e passed: `apps/playground/tests/drawing-editor.spec.ts`, 8 browser tests.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run guard:public-api` passed: 132 runtime exports.
- `npm run guard:public-types` passed: 343 type symbols.
- `npm run test` passed: 37 test files, 432 tests.
- `npm run guard:engine-boundary` passed: 152 files scanned.
- `npm run guard:sdk-imports` passed.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm run check:package-artifact` passed: 118 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 118 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 36 browser tests.
- Review subagent `019f095c-b446-73d1-b564-c949864bf6d1` was closed after its code-reading result was incorporated.
