# Chart Engine v1.0 Drawing Interaction Completeness Writing Plan

**Problem:** SimonCharts Engine has drawing creation, selection, drag, anchor editing, commands, property schemas, and advanced drawing parameters. The drawing editor still lacks several reusable interaction primitives that a complete drawing editor needs: selection-box selection, keyboard nudging, and Engine-owned edit handle metadata. Hosts can hand-roll these behaviors, but that keeps the drawing editor incomplete as a reusable Engine contract.

**Goal:** Add neutral drawing interaction primitives for box selection, selected-drawing nudging, and edit handle metadata. These should be DOM-free Engine APIs and commands that hosts can use from browser, native, or embedded environments.

**Boundary:**
- Do not add TradingReviewSystem integration.
- Do not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, persistence, or product workflow modules.
- Do not put DOM event handling into the Engine package.
- Do not implement full resize/rotate transforms in this phase.
- Keep resize/rotate handle metadata declarative so a later transform phase can consume it.

## Success Criteria

1. Engine can derive edit handles for selected drawings.
   - Verify unit tests cover anchor, resize, and rotate handle metadata.
2. Engine can select drawings within a rectangular selection box.
   - Verify unit tests cover intersecting bounds, hidden drawings, locked drawings, and additive selection.
3. Engine can nudge selected editable drawings through neutral commands.
   - Verify unit tests cover command execution, undo/redo, and locked drawing protection.
4. Playground consumes the new Engine commands for keyboard nudging and exposes selection handles from Engine metadata.
   - Verify browser tests cover keyboard nudging and handle metadata diagnostics.
5. Public SDK consumers can import and typecheck the new interaction contracts.
   - Verify public type API guard and package consumer checks.

## Proposed Scope

1. Interaction metadata module
   - Add `getDrawingEditHandles(drawing)` and `getDrawingSelectionBounds(drawings)`.
   - Define handle kinds and positions without DOM dependencies.

2. Drawing editor commands
   - Add `selectDrawingsInBounds(bounds, options)`.
   - Add `nudgeSelected(delta)`.
   - Add `getSelectedEditHandles()`.

3. Playground integration
   - Use arrow keys to call `nudgeSelected()`.
   - Show Engine-derived selected handle count for verification.

4. SDK, docs, and validation
   - Update package-root exports and type snapshots.
   - Update docs and release evidence.

## Validation Gate

Run before accepting this phase:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingInteractionPrimitives.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-artifact
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run build
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
