# Drawing Editor

Drawings use the neutral `DrawingObject` model:

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

Rendering uses `createDefaultDrawingRendererRegistry()` and `createDrawingLayer(registry)`. Geometry helpers include drawing bounds, hit-test primitives, serialization, and `snapPointToTargets`.

The editor owns neutral operations such as select, drag, delete, lock, hide, undo, and redo. Persistence and collaboration are host responsibilities.
