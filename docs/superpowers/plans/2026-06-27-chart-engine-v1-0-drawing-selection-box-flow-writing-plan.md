# Chart Engine v1.0 Drawing Selection Box Flow Writing Plan

**Problem:** SimonCharts Engine can select drawings inside bounds through `selectDrawingsInBounds()` and can normalize rectangular bounds, but hosts still have to hand-roll the drag operation that turns a pointer start/end into preview ids and a final selection command. That keeps multi-select box behavior inconsistent across host apps.

**Goal:** Add a DOM-free drawing selection box operation contract that owns selection-box bounds, preview selected ids, and final neutral command generation. Hosts should only translate native pointer events and modifiers into Engine points/options.

**Boundary:**
- Do not add TradingReviewSystem integration.
- Do not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, persistence, or product workflow modules.
- Do not add DOM event handling, pointer capture, CSS selection overlays, or UI framework code to the Engine package.
- Do not change drawing persistence schema.
- Keep selection preview represented as neutral ids and bounds.

## Success Criteria

1. Engine can begin and update a selection-box operation from neutral points.
   - Verify unit tests cover normalized bounds, preview ids, hidden/locked exclusion, and additive mode.
2. Engine can finish a selection-box operation as a neutral editor command.
   - Verify unit tests cover `selectDrawingsInBounds` command generation.
3. Playground can use Shift+drag to box-select drawings without breaking normal chart pan.
   - Verify browser tests cover selecting two drawings by dragging an empty selection box.
4. Public SDK consumers can import and typecheck selection-box flow APIs.
   - Verify public API/type guards, package consumer, package type consumer, and package artifact checks.

## Proposed Scope

1. Selection box module
   - Add `beginDrawingSelectionBox()`.
   - Add `updateDrawingSelectionBox()` and `finishDrawingSelectionBox()`.
   - Add `getDrawingSelectionBoxCommand()`.
   - Preserve existing `getDrawingIdsInBounds()` and `normalizeDrawingSelectionBounds()` as the geometry source.

2. Playground integration
   - Start selection box only for Shift+drag on empty chart area while drawing tool is `select`.
   - Render preview through selected ids from Engine.
   - Commit final `selectDrawingsInBounds` command on pointer-up.

3. SDK, docs, and validation
   - Export selection box flow APIs from the package root.
   - Update public API/type snapshots and package artifact checks.
   - Document host responsibilities and Engine responsibilities.

## Validation Gate

Run before accepting this phase:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingSelectionBox.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
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
