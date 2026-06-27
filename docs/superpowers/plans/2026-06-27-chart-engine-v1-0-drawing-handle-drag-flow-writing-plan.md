# Chart Engine v1.0 Drawing Handle Drag Flow Writing Plan

**Problem:** SimonCharts Engine exposes edit handles and transform commands, but a host still has to hand-roll the operation flow that turns a pointer-down on a handle into anchor drag, resize, or rotate behavior. That leaves an important part of the drawing editor inconsistent across hosts.

**Goal:** Add a DOM-free handle drag operation contract that owns handle hit-testing, drag session creation, preview generation, and final neutral editor command generation. Hosts should only translate native pointer events into Engine points and render preview drawings.

**Boundary:**
- Do not add TradingReviewSystem integration.
- Do not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, persistence, or product workflow modules.
- Do not add DOM event handling, pointer capture, cursor rendering, or UI framework code to the Engine package.
- Do not change the drawing persistence schema.
- Keep live preview optional and represented as neutral `DrawingObject[]`.

## Success Criteria

1. Engine can hit-test edit handles without DOM APIs.
   - Verify unit tests cover closest-handle selection, radius misses, and kind filtering.
2. Engine can begin anchor, resize, and rotate drag operations from edit handle metadata.
   - Verify unit tests cover valid operations and locked/invalid operation rejection.
3. Engine can produce preview drawings and final editor commands from a handle drag operation.
   - Verify unit tests cover anchor drag, resize drag, rotate drag, multi-selection, and non-compounding preview from the original snapshot.
4. Playground can drag a selected drawing handle through the Engine operation flow.
   - Verify browser tests drag an anchor handle and observe updated drawing export JSON.
5. Public SDK consumers can import and typecheck the handle drag flow.
   - Verify public API/type guards, package consumer, package type consumer, and package artifact checks.

## Proposed Scope

1. Handle drag module
   - Add `hitTestDrawingEditHandle()`.
   - Add `beginDrawingHandleDrag()`.
   - Add `updateDrawingHandleDrag()` and `finishDrawingHandleDrag()`.
   - Return preview drawings from the original drag snapshot so repeated pointer moves do not compound transforms.

2. Editor command coverage
   - Add a neutral `dragAnchor` command variant so final anchor handle drags can be committed through `executeCommand()`.
   - Keep resize and rotate using existing `resizeSelected` and `rotateSelected` command variants.

3. Playground integration
   - On pointer-down, check selected edit handles before drawing body hit-test.
   - During pointer-move, render Engine preview drawings.
   - On pointer-up, commit the final command and clear preview state.

4. SDK, docs, and validation
   - Export the new APIs from the package root.
   - Update public API/type snapshots and package artifact checks.
   - Document host responsibilities and Engine responsibilities.

## Validation Gate

Run before accepting this phase:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHandleDrag.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
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
