# Chart Engine v1.0 Drawing Transform Engine Writing Plan

**Problem:** SimonCharts Engine now exposes selected drawing edit handles, box selection, and keyboard nudging, but resize and rotate behavior is still not an Engine-owned contract. That leaves complete drawing editor implementations dependent on host-specific transform math, which weakens the reusable Engine boundary.

**Goal:** Add a DOM-free drawing transform kernel for resizing and rotating drawings, plus editor commands that apply those transforms to editable selected drawings with undo/redo. Hosts should translate pointer movement into neutral transform inputs; the Engine should own the geometry mutation.

**Boundary:**
- Do not add TradingReviewSystem integration.
- Do not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, persistence, or product workflow modules.
- Do not add DOM event handling, pointer capture, cursor rendering, or UI framework code to the Engine package.
- Do not add remote plugin loading, collaboration, or cloud persistence.
- Keep transform APIs based on `DrawingObject`, selection bounds, handle positions, points, and angles only.

## Success Criteria

1. Engine can resize a drawing from any resize handle.
   - Verify unit tests cover corner handles, edge handles, proportional anchor mutation, and minimum-size clamping.
2. Engine can rotate drawing anchors around a supplied center.
   - Verify unit tests cover deterministic rotation math and preservation of non-screen coordinate fields.
3. Engine can apply resize/rotate to multiple selected drawings through editor commands.
   - Verify unit tests cover command execution, locked drawing protection, emitted updates, undo, and redo.
4. Package-root SDK consumers can import and typecheck transform APIs.
   - Verify public API/type guards and package consumer checks.
5. Playground exposes a minimal transform smoke path.
   - Verify browser tests cover resize/rotate commands from the demo without host business dependencies.

## Proposed Scope

1. Transform math module
   - Add `resizeDrawing()`, `resizeDrawings()`, `rotateDrawing()`, and `rotateDrawings()`.
   - Define neutral transform option types.
   - Preserve drawing metadata, style, text, visibility, lock state, and non-screen coordinate fields.

2. Drawing editor commands
   - Add `resizeSelected(options)` and `rotateSelected(options)`.
   - Add corresponding `DrawingEditorCommand` variants.
   - Reuse existing selection, mutation, and history behavior.

3. Playground integration
   - Add minimal resize and rotate buttons that call Engine commands for selected drawings.
   - Keep browser-owned UI outside the package and route only neutral command payloads into the Engine.

4. SDK, docs, and validation
   - Export transform APIs from the package root.
   - Update public API/type snapshots and package artifact checks.
   - Document the new Engine-owned transform boundary.

## Validation Gate

Run before accepting this phase:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingTransform.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run build
npm run check:package-artifact
npm run check:performance
npm run check:release-readiness
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
