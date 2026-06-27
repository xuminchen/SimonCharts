# Chart Engine v1.0 Drawing Move Drag Writing Plan

**Problem:** SimonCharts Engine already owns handle drag and selection box operation flows, but selected drawing body drag is still committed directly from the playground on every pointer move. That leaves an interaction gap in the Engine contract and can create multiple undo entries during one user drag.

**Goal:** Add a DOM-free Engine-owned move drag flow for selected drawing bodies, with preview drawings during pointer movement and one final neutral editor command on pointer up.

**Boundary:** Keep the Engine independent. This phase must not import TradingReviewSystem, host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, persistence workflows, or DOM APIs into `packages/chart-engine`.

## Current State

- `drawingHandleDrag.ts` owns begin/update/finish command flow for anchor, resize, and rotate handles.
- `drawingSelectionBox.ts` owns begin/update/finish command flow for box selection.
- `DrawingEditor.dragSelected(delta)` exists as a direct editor method and commits each call to history.
- `DrawingEditorCommand` does not yet include a `dragSelected` command.
- `apps/playground/src/main.ts` stores `drawingDragStart` and calls `drawingEditor.dragSelected()` on every pointer move.

## Target Contract

Add package-root APIs:

- `beginDrawingMoveDrag(options)`
- `updateDrawingMoveDrag(operation, point)`
- `finishDrawingMoveDrag(operation, point)`
- `getDrawingMoveDragCommand(operation, point)`
- `DrawingMoveDragOptions`
- `DrawingMoveDragOperation`
- `DrawingMoveDragPreview`

The operation stores a cloned drawing snapshot, selected drawing ids, and the initial pointer point. Preview updates always derive from the original snapshot, so repeated pointer moves do not compound. Finish returns a single `{ type: "dragSelected", delta }` command. Zero-distance drags return `undefined` to avoid empty history entries.

## Non-Goals

- No host persistence, collaboration, routing, or business workflow work.
- No new drawing tool types.
- No remote extension/plugin loading.
- No redesign of existing drawing editor internals beyond adding the command route needed for move drag.
- No compatibility wrapper around the old playground body-drag behavior.

## Verification

1. Engine command contract
   - Verify: focused Vitest proves `executeCommand({ type: "dragSelected" })` moves editable selected drawings and undo once reverts the full move.
2. Move drag operation flow
   - Verify: focused Vitest proves begin/update/finish behavior, non-compounding preview, locked drawing exclusion, and zero-delta no-op.
3. Playground integration
   - Verify: Playwright creates a drawing, drags through multiple pointer moves, and one Undo returns the drawing to the original anchors.
4. SDK/public API
   - Verify: public API/type guards and package consumer/type fixture checks pass after snapshot updates.
5. Engine boundary
   - Verify: `npm run guard:engine-boundary` passes.

