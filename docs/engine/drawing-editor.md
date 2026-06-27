# Drawing Editor

Drawings use the neutral `DrawingObject` model. Anchors may carry chart coordinates (`time`, `index`, `price`) or screen coordinates (`x`, `y`), and styles use `DrawingStyle` fields:

```ts
const drawing: DrawingObject = {
  id: "trend-1",
  type: "trendLine",
  anchors: [
    { x: 120, y: 180 },
    { x: 260, y: 240 }
  ],
  style: { color: "#2563eb", lineWidth: 2 }
};
```

The built-in tool capability matrix is locked in [drawing-tool-coverage.md](./drawing-tool-coverage.md). It lists each target built-in drawing type, anchor count, drawing mode, and target editor coverage.

## Tool Registry

Tool metadata is engine-owned and neutral:

- `builtInDrawingToolDefinitions`
- `DrawingToolDefinition`
- `createDrawingToolRegistry()`

`DrawingToolDefinition` records `type`, `label`, `category`, `anchorCount`, `totalStep`, `drawingMode`, `defaultStyle`, and `hotkeyId`. `createDrawingEditor()` accepts an optional `toolRegistry`; otherwise it registers the built-in definitions.

Use `createDrawingEditor()` for interaction state:

```ts
const editor = createDrawingEditor({
  drawings: [],
  onEvent(event) {
    console.log(event);
  }
});

editor.setTool("trendLine");
editor.pointerDown({ x: 120, y: 180 });
editor.pointerDown({ x: 260, y: 240 });
```

The editor owns neutral operations such as select, box select, drag, anchor edits, keyboard nudging, resize, rotate, style edits, metadata edits, text edits, z-order, copy, paste, duplicate, delete, lock, hide, undo, and redo. Use `getObjectManagerItems()` for `DrawingObjectManagerItem` snapshots containing `id`, `type`, `visible`, `locked`, `selected`, and `zIndex`.

Style, metadata, and text commands are exposed as `updateSelectedStyle(style)`, `updateSelectedMetadata(metadata)`, and `updateSelectedText(text)`. Transform commands are exposed as `resizeSelected(options)` and `rotateSelected(options)`. The corresponding command payloads are `DrawingEditorCommand` entries: `selectDrawingsInBounds`, `nudgeSelected`, `resizeSelected`, `rotateSelected`, `updateSelectedStyle`, `updateSelectedMetadata`, `updateSelectedText`, `bringSelectedForward`, `sendSelectedBackward`, `copySelected`, `pasteCopied`, `duplicateSelected`, `lockSelected`, `unlockSelected`, `hideSelected`, and `showSelected`.

`getSelectedEditHandles()` returns Engine-derived anchor, resize, and rotate handle metadata for selected drawings. The Engine exposes handle coordinates and ids only; hosts own DOM hit regions and cursor presentation.

## Body Hit-Test

SimonCharts v1.0 adds a DOM-free drawing body hit-test contract:

- `hitTestDrawing(drawings, point, options)`
- `hitTestDrawingAll(drawings, point, options)`
- `DrawingHitTestMatch`
- `DrawingHitTestOptions`
- `DrawingPoint`

Hosts pass neutral `DrawingObject[]`, a pointer point, and a `DrawingRendererRegistry`. The Engine asks each registered drawing renderer to hit-test its drawing, filters hidden drawings by default, can exclude locked drawings with `includeLocked: false`, and sorts matches by shortest distance with later input drawings winning equal-distance ties.

Hosts still own native pointer events, pointer capture, cursor UI, hover rendering, persistence, and collaboration. The Engine owns the package-root body hit-test contract, hidden/locked filtering, distance ordering, and z-order tie behavior.

## Handle Drag Flow

SimonCharts v1.0 adds a DOM-free handle drag operation flow:

- `hitTestDrawingEditHandle(handles, point, options)`
- `beginDrawingHandleDrag(options)`
- `updateDrawingHandleDrag(operation, point)`
- `finishDrawingHandleDrag(operation, point)`
- `getDrawingHandleDragCommand(operation, point)`

The flow starts from Engine-owned `DrawingEditHandle` metadata. Hosts pass a pointer point, selected drawing ids, and the current neutral drawing snapshot. The Engine returns optional preview drawings during movement and a final `DrawingEditorCommand` on finish. Anchor handles produce `dragAnchor`, resize handles produce `resizeSelected`, and rotate handles produce `rotateSelected`.

Hosts still own native pointer events, pointer capture, CSS cursors, hover feedback, render invalidation, and persistence. The Engine owns handle geometry, operation state, preview mutation from the original snapshot, and final neutral command generation.

## Move Drag Flow

SimonCharts v1.0 adds a DOM-free selected drawing move drag operation flow:

- `beginDrawingMoveDrag(options)`
- `updateDrawingMoveDrag(operation, point)`
- `finishDrawingMoveDrag(operation, point)`
- `getDrawingMoveDragCommand(operation, point)`

The flow starts from a neutral drawing snapshot, selected drawing ids, and a start point. The Engine returns preview drawings derived from the original operation snapshot during movement, and `finishDrawingMoveDrag()` returns one final `dragSelected` command for undoable commit through `DrawingEditor.executeCommand()`.

Hosts still own native pointer events, pointer capture, cursor UI, render invalidation, persistence, and collaboration. The Engine owns operation snapshot isolation, preview movement for editable selected drawings, locked drawing protection, and final neutral command generation.

## Selection Box Flow

SimonCharts v1.0 adds a DOM-free selection box operation flow:

- `beginDrawingSelectionBox(options)`
- `updateDrawingSelectionBox(operation, point)`
- `finishDrawingSelectionBox(operation, point)`
- `getDrawingSelectionBoxCommand(operation, point)`

The flow starts from a neutral drawing snapshot and start point. The Engine returns normalized bounds, preview selected drawing ids, and a final `selectDrawingsInBounds` command. Additive mode can include existing selected ids in the preview while still preserving the final command contract.

Hosts still own modifier keys, native pointer events, pointer capture, CSS selection rectangles, and render invalidation. The Engine owns bounds normalization, hidden/locked selection options, preview id calculation, and command generation.

## Transform Kernel

SimonCharts v1.0 adds Engine-owned resize and rotate math:

- `resizeDrawing(drawing, options)`
- `resizeDrawings(drawings, options)`
- `rotateDrawing(drawing, options)`
- `rotateDrawings(drawings, options)`
- `DrawingResizeOptions`
- `DrawingRotateOptions`

`DrawingResizeOptions` uses a resize handle position, original `DrawingSelectionBounds`, target point, and optional minimum size. The Engine maps finite anchor `x` and `y` values from the original bounds to the resized bounds while preserving anchor `time`, `index`, and `price` fields. `DrawingRotateOptions` uses a supplied center and radians. Non-screen anchors remain unchanged.

Hosts can either translate pointer drags into these neutral options directly or use the handle drag flow above. The Engine applies transforms only to editable selected drawings and keeps the operation inside undo/redo history. Hosts still own DOM events, pointer capture, visual handles, persistence, collaboration, and product workflows.

## Property Schema

SimonCharts v1.0 adds an Engine-owned property schema for drawing editor panels:

- `getDrawingPropertySchema(type)`
- `getDrawingPropertyDefinitionsForDrawing(drawing)`
- `DrawingPropertySchema`
- `DrawingPropertyDefinition`
- `isTextDrawingType(type)`
- `isFillDrawingType(type)`

The schema describes neutral style, content, parameter, and state properties. Style properties map to `updateSelectedStyle`, text content maps to `updateSelectedText`, parameter properties map to `updateSelectedMetadata`, and state properties map to `showSelected`, `hideSelected`, `lockSelected`, and `unlockSelected` commands.

Hosts can use the schema to render their own controls while keeping DOM, menus, persistence, collaboration, and product workflows outside the Engine package. Built-in drawing types always include color, width, line style, visible, and locked properties. Text drawings also include text color, font size, and text content. Fill-capable drawings include fill color.

Advanced drawing parameters are stored in `DrawingObject.metadata` through Engine-owned keys:

- `fibonacciLevels` for Fibonacci tools
- `gannRatios` for Gann Fan
- `positionLabel` for long/short/profit-loss position tools
- `rangeLabel` for range and measurement tools

The editor command `updateSelectedMetadata(metadata)` shallow-merges metadata into editable selected drawings and participates in undo/redo like style and text edits. Invalid numeric lists fall back to Engine defaults during rendering.

## Command Execution And Capabilities

SimonCharts v0.7 adds a product-facing command contract:

- `executeCommand(command)` routes neutral `DrawingEditorCommand` payloads through the same editor behavior as direct method calls.
- `getCapabilities()` returns a `DrawingEditorCapabilities` snapshot for toolbar, menu, hotkey, and object-manager state.

Capabilities include selection counts, editable selection counts, clipboard count, pending anchor count, z-order availability, copy/paste/duplicate availability, lock/unlock, hide/show, delete, cancel creation, undo, and redo. The snapshot is derived from editor state and does not expose mutable editor internals.

Hosts should prefer `executeCommand()` for toolbar and hotkey actions. Direct methods remain available for focused integrations and tests.

## Figure Kernel

Drawing rendering is routed through reusable figure primitives:

- `FigureObject`, `FigureType`, `FigureStyle`, `FigureBounds`, `FigureHitTestResult`
- `createFiguresForDrawing(drawing)`
- `getDrawingEditHandles(drawing)`
- `getDrawingSelectionBounds(drawings)`
- `getDrawingIdsInBounds(drawings, bounds)`
- `normalizeDrawingSelectionBounds(start, end)`
- `resizeDrawing(drawing, options)`
- `rotateDrawing(drawing, options)`
- `createBuiltInFigureRenderers()`
- `createFigureRendererRegistry()`
- `getFigureBounds(figure)`
- `hitTestFigure(figure, point, radius)`

Built-in figure types are `line`, `polyline`, `polygon`, `rect`, `rotatedRect`, `circle`, `ellipse`, `arc`, `curve`, `text`, `label`, `arrow`, `band`, and `marker`. `createDefaultDrawingRendererRegistry()` and `createDrawingLayer(registry)` use those figure conversions for drawing render and hit-test work.

## Serialization

Drawing persistence uses versioned, neutral serialization:

- `currentDrawingSchemaVersion`
- `SerializedDrawingObject`
- `serializeDrawingObject(drawing)`
- `deserializeDrawingObject(value)`
- `migrateSerializedDrawing(value)`

Serialized v1 payloads preserve `id`, `type`, `anchors`, `style`, `text`, `visible`, `locked`, `zIndex`, and `metadata`. Product persistence remains outside the engine.

Layout persistence can wrap drawings with chart-level state:

- `currentLayoutSnapshotSchemaVersion`
- `serializeChartLayoutSnapshot(snapshot)`
- `deserializeChartLayoutSnapshot(value)`

Layout snapshots preserve `viewport`, versioned drawing payloads, `indicatorIds`, and optional `settings`. Hosts own where and when the serialized layout is stored.

## Hotkeys And Magnet Policies

`defaultDrawingHotkeyBindings` maps neutral key strings to `DrawingEditorCommand` payloads. `getDrawingCommandForHotkey(bindings, key)` returns cloned command objects for delete, copy, paste, duplicate, z-order, and cancel-creation bindings. The returned command can be passed directly to `executeCommand()`.

Magnet helpers are deterministic:

- `createOhlcMagnetTargets(points)` creates OHLC targets with optional `field` and `dataIndex`.
- `createDrawingAnchorMagnetTargets(drawings)` creates targets from finite drawing anchor coordinates.
- `createVisualPointMagnetTargets(points)` creates visual output point targets.
- `findNearestMagnetTarget(point, targets, radius)` selects nearest distance; ties resolve in this order: `ohlc`, `drawingAnchor`, `visualPoint`.
- `snapPointToMagnetTargets(point, targets, radius)` returns the target point or the original point.

Persistence and collaboration are host responsibilities.
