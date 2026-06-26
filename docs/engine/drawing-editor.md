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

The editor owns neutral operations such as select, drag, anchor edits, style edits, text edits, z-order, copy, paste, duplicate, delete, lock, hide, undo, and redo. Use `getObjectManagerItems()` for `DrawingObjectManagerItem` snapshots containing `id`, `type`, `visible`, `locked`, `selected`, and `zIndex`.

Style and text commands are exposed as `updateSelectedStyle(style)` and `updateSelectedText(text)`. The corresponding command payloads are `DrawingEditorCommand` entries: `updateSelectedStyle`, `updateSelectedText`, `bringSelectedForward`, `sendSelectedBackward`, `copySelected`, `pasteCopied`, and `duplicateSelected`.

## Figure Kernel

Drawing rendering is routed through reusable figure primitives:

- `FigureObject`, `FigureType`, `FigureStyle`, `FigureBounds`, `FigureHitTestResult`
- `createFiguresForDrawing(drawing)`
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

## Hotkeys And Magnet Policies

`defaultDrawingHotkeyBindings` maps neutral key strings to `DrawingEditorCommand` payloads. `getDrawingCommandForHotkey(bindings, key)` returns cloned command objects for delete, copy, paste, duplicate, z-order, and cancel-creation bindings.

Magnet helpers are deterministic:

- `createOhlcMagnetTargets(points)` creates OHLC targets with optional `field` and `dataIndex`.
- `createDrawingAnchorMagnetTargets(drawings)` creates targets from finite drawing anchor coordinates.
- `createVisualPointMagnetTargets(points)` creates visual output point targets.
- `findNearestMagnetTarget(point, targets, radius)` selects nearest distance; ties resolve in this order: `ohlc`, `drawingAnchor`, `visualPoint`.
- `snapPointToMagnetTargets(point, targets, radius)` returns the target point or the original point.

Persistence and collaboration are host responsibilities.
