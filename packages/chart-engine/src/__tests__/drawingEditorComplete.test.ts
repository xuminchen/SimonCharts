import { describe, expect, it } from "vitest";
import {
  createDrawingEditor,
  createDrawingToolRegistry,
  type DrawingEditorEvent,
  type DrawingObject
} from "../index";

describe("complete drawing editor", () => {
  it("exposes the exact preview state and orders step creation events", () => {
    const events: DrawingEditorEvent[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    expect(editor.getState()).toEqual({
      drawings: [],
      selectedDrawingIds: [],
      activeTool: "select",
      isCreating: false,
      previewDrawing: undefined
    });

    editor.setTool("trendLine");
    editor.pointerDown({ x: 10, y: 20, time: 1, price: 10 });
    editor.pointerMove({ x: 30, y: 40, time: 2, price: 12 });

    expect(events).toEqual([
      { type: "toolChanged", tool: "trendLine" },
      {
        type: "drawingPreviewChanged",
        drawing: {
          id: "drawing-1",
          type: "trendLine",
          anchors: [{ x: 10, y: 20, time: 1, price: 10 }]
        }
      },
      {
        type: "drawingPreviewChanged",
        drawing: {
          id: "drawing-1",
          type: "trendLine",
          anchors: [
            { x: 10, y: 20, time: 1, price: 10 },
            { x: 30, y: 40, time: 2, price: 12 }
          ]
        }
      }
    ]);

    editor.pointerDown({ x: 50, y: 60, time: 3, price: 14 });

    expect(events.slice(3)).toEqual([
      { type: "drawingPreviewChanged", drawing: undefined },
      {
        type: "drawingCreated",
        drawing: {
          id: "drawing-1",
          type: "trendLine",
          anchors: [
            { x: 10, y: 20, time: 1, price: 10 },
            { x: 50, y: 60, time: 3, price: 14 }
          ]
        }
      },
      { type: "selectionChanged", selectedDrawingIds: ["drawing-1"] }
    ]);
    expect(editor.getState()).toMatchObject({
      selectedDrawingIds: ["drawing-1"],
      isCreating: false,
      previewDrawing: undefined
    });
  });

  it("keeps step hover anchors ephemeral", () => {
    const editor = createDrawingEditor({ drawings: [] });

    editor.setTool("trendLine");
    editor.pointerDown({ x: 1, y: 2, time: 1, price: 10 });
    editor.pointerMove({ x: 11, y: 12, time: 2, price: 11 });
    editor.pointerMove({ x: 21, y: 22, time: 3, price: 12 });

    expect(editor.getState().previewDrawing?.anchors).toEqual([
      { x: 1, y: 2, time: 1, price: 10 },
      { x: 21, y: 22, time: 3, price: 12 }
    ]);

    editor.pointerDown({ x: 31, y: 32, time: 4, price: 13 });

    expect(editor.getState().drawings[0].anchors).toEqual([
      { x: 1, y: 2, time: 1, price: 10 },
      { x: 31, y: 32, time: 4, price: 13 }
    ]);
  });

  it("keeps step state events and history unchanged on pointer up", () => {
    const events: DrawingEditorEvent[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    editor.setTool("trendLine");
    editor.pointerDown({ x: 1, y: 2 });
    editor.pointerMove({ x: 3, y: 4 });

    const stateBeforePointerUp = editor.getState();
    const capabilitiesBeforePointerUp = editor.getCapabilities();
    const eventsBeforePointerUp = [...events];

    editor.pointerUp({ x: 5, y: 6 });

    expect(editor.getState()).toEqual(stateBeforePointerUp);
    expect(editor.getCapabilities()).toEqual(capabilitiesBeforePointerUp);
    expect(events).toEqual(eventsBeforePointerUp);
  });

  it("commits a single-anchor step tool without preview events", () => {
    const events: DrawingEditorEvent[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    editor.setTool("horizontalLine");
    editor.pointerDown({ x: 1, y: 2 });

    expect(events.map((event) => event.type)).toEqual([
      "toolChanged",
      "drawingCreated",
      "selectionChanged"
    ]);
    expect(editor.getState()).toMatchObject({
      drawings: [{ type: "horizontalLine", anchors: [{ x: 1, y: 2 }] }],
      isCreating: false,
      previewDrawing: undefined
    });
  });

  it("samples continuous anchors by distinct x and y and appends a distinct final point", () => {
    const editor = createDrawingEditor({ drawings: [] });

    editor.setTool("path");
    editor.pointerDown({ x: 10, y: 10, time: 1, price: 10 });
    editor.pointerMove({ x: 10, y: 10, time: 2, price: 20 });
    editor.pointerMove({ x: 20, y: 10, time: 3, price: 30 });
    editor.pointerMove({ x: 20, y: 10, time: 4, price: 40 });
    editor.pointerUp({ x: 20, y: 30, time: 5, price: 50 });

    expect(editor.getState().drawings[0].anchors).toEqual([
      { x: 10, y: 10, time: 1, price: 10 },
      { x: 20, y: 10, time: 3, price: 30 },
      { x: 20, y: 30, time: 5, price: 50 }
    ]);
  });

  it("cancels distinct continuous points below the declared minimum", () => {
    const editor = createDrawingEditor({ drawings: [] });

    editor.setTool("path");
    editor.pointerDown({ x: 10, y: 10 });
    editor.pointerUp({ x: 20, y: 20 });

    expect(editor.getState()).toMatchObject({
      drawings: [],
      isCreating: false,
      previewDrawing: undefined
    });
    expect(editor.getCapabilities().canUndo).toBe(false);
  });

  it("commits at the continuous minimum when pointer up repeats the last sample", () => {
    const editor = createDrawingEditor({ drawings: [] });

    editor.setTool("path");
    editor.pointerDown({ x: 10, y: 10 });
    editor.pointerMove({ x: 20, y: 20 });
    editor.pointerMove({ x: 30, y: 30 });
    editor.pointerUp({ x: 30, y: 30 });

    expect(editor.getState().drawings[0].anchors).toEqual([
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 }
    ]);
  });

  it("uses a custom continuous tool's declared minimum instead of a built-in constant", () => {
    const registry = createDrawingToolRegistry();

    registry.register({
      type: "acme.freehand",
      label: "Freehand",
      category: "path",
      totalStep: 5,
      anchorCount: 4,
      drawingMode: "continuous",
      defaultStyle: { color: "#2563eb", lineWidth: 2 },
      hotkeyId: "drawing.acme.freehand"
    });

    const editor = createDrawingEditor({ drawings: [], toolRegistry: registry });

    editor.setTool("acme.freehand");
    editor.pointerDown({ x: 0, y: 0 });
    editor.pointerMove({ x: 1, y: 1 });
    editor.pointerUp({ x: 2, y: 2 });

    expect(editor.getState().drawings).toEqual([]);
    expect(editor.getCapabilities().canUndo).toBe(false);

    editor.pointerDown({ x: 3, y: 3 });
    editor.pointerMove({ x: 4, y: 4 });
    editor.pointerMove({ x: 5, y: 5 });
    editor.pointerUp({ x: 6, y: 6 });

    expect(editor.getState().drawings[0]).toMatchObject({
      type: "acme.freehand",
      anchors: { length: 4 }
    });
  });

  it("commits one continuous gesture through one history and event entry", () => {
    const events: DrawingEditorEvent[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    editor.setTool("brush");
    editor.pointerDown({ x: 0, y: 0 });
    editor.pointerMove({ x: 1, y: 1 });
    editor.pointerMove({ x: 2, y: 2 });
    editor.pointerMove({ x: 3, y: 3 });
    editor.pointerMove({ x: 4, y: 4 });
    editor.pointerUp({ x: 5, y: 5 });

    expect(events.filter((event) => event.type === "drawingCreated")).toHaveLength(1);
    expect(events.filter((event) => event.type === "selectionChanged")).toHaveLength(1);
    expect(events.map((event) => event.type)).toEqual([
      "toolChanged",
      "drawingPreviewChanged",
      "drawingPreviewChanged",
      "drawingPreviewChanged",
      "drawingPreviewChanged",
      "drawingPreviewChanged",
      "drawingPreviewChanged",
      "drawingCreated",
      "selectionChanged"
    ]);
    expect(editor.getState().drawings[0].anchors).toHaveLength(6);

    editor.undo();
    expect(editor.getState().drawings).toEqual([]);
    expect(editor.getCapabilities()).toMatchObject({ canUndo: false, canRedo: true });

    editor.redo();
    expect(editor.getState().drawings).toHaveLength(1);
    expect(editor.getCapabilities()).toMatchObject({ canUndo: true, canRedo: false });
  });

  it("deep clones preview state and preview events", () => {
    let eventPreview: DrawingObject | undefined;
    const editor = createDrawingEditor({
      drawings: [],
      onEvent(event) {
        if (event.type === "drawingPreviewChanged" && event.drawing) {
          eventPreview = event.drawing;
          event.drawing.anchors[0].x = 999;
        }
      }
    });

    editor.setTool("trendLine");
    editor.pointerDown({ x: 10, y: 20, time: 1, price: 10 });

    expect(eventPreview?.anchors[0].x).toBe(999);
    expect(editor.getState().previewDrawing?.anchors[0].x).toBe(10);

    const state = editor.getState();

    if (!state.previewDrawing) {
      throw new Error("Expected a preview drawing");
    }

    state.previewDrawing.anchors[0].x = 777;
    expect(editor.getState().previewDrawing?.anchors[0].x).toBe(10);

    editor.pointerDown({ x: 30, y: 40, time: 2, price: 12 });
    expect(editor.getState().drawings[0].anchors[0].x).toBe(10);
  });

  for (const type of ["trendLine", "path"] as const) {
    it(`keeps one reserved id for ${type} after deleting an existing drawing`, () => {
      const previewIds: string[] = [];
      const createdIds: string[] = [];
      const editor = createDrawingEditor({
        drawings: [
          {
            id: "drawing-1",
            type: "rectangle",
            anchors: [{ x: 0, y: 0 }, { x: 5, y: 5 }]
          }
        ],
        onEvent(event) {
          if (event.type === "drawingPreviewChanged" && event.drawing) {
            previewIds.push(event.drawing.id);
          }
          if (event.type === "drawingCreated") {
            createdIds.push(event.drawing.id);
          }
        }
      });

      editor.selectDrawing("drawing-1");
      editor.setTool(type);
      editor.pointerDown({ x: 10, y: 10 });

      const reservedId = editor.getState().previewDrawing?.id;

      expect(reservedId).toBeDefined();
      editor.deleteSelected();
      expectUniqueEditorDrawingIds(editor.getState());

      editor.pointerMove({ x: 20, y: 20 });
      if (type === "path") {
        editor.pointerMove({ x: 30, y: 30 });
        editor.pointerUp({ x: 40, y: 40 });
      } else {
        editor.pointerDown({ x: 30, y: 30 });
      }

      expect(previewIds.every((id) => id === reservedId)).toBe(true);
      expect(createdIds).toEqual([reservedId]);
      expect(editor.getState().drawings[0].id).toBe(reservedId);
      expectUniqueEditorDrawingIds(editor.getState());
    });
  }

  it("keeps a pending id reserved across repeated duplication", () => {
    const previewIds: string[] = [];
    const editor = createDrawingEditor({
      drawings: [
        {
          id: "source",
          type: "rectangle",
          anchors: [{ x: 0, y: 0 }, { x: 5, y: 5 }]
        }
      ],
      onEvent(event) {
        if (event.type === "drawingPreviewChanged" && event.drawing) {
          previewIds.push(event.drawing.id);
        }
      }
    });

    editor.selectDrawing("source");
    editor.setTool("path");
    editor.pointerDown({ x: 10, y: 10 });

    const reservedId = editor.getState().previewDrawing?.id;

    expect(reservedId).toBeDefined();

    editor.duplicateSelected({ dx: 1, dy: 1 });
    expect(editor.getState().drawings.map((drawing) => drawing.id)).not.toContain(reservedId);
    expect(editor.getState().previewDrawing?.id).toBe(reservedId);
    expectUniqueEditorDrawingIds(editor.getState());

    editor.pointerMove({ x: 20, y: 20 });
    editor.duplicateSelected({ dx: 2, dy: 2 });
    expect(editor.getState().drawings.map((drawing) => drawing.id)).not.toContain(reservedId);
    expect(editor.getState().previewDrawing?.id).toBe(reservedId);
    expectUniqueEditorDrawingIds(editor.getState());

    editor.pointerMove({ x: 30, y: 30 });
    editor.pointerUp({ x: 40, y: 40 });

    const finalState = editor.getState();
    const finalDrawing = finalState.drawings.find((drawing) => drawing.type === "path");

    expect(previewIds.every((id) => id === reservedId)).toBe(true);
    expect(finalDrawing?.id).toBe(reservedId);
    expectUniqueEditorDrawingIds(finalState);
  });

  it("keeps a pending id stable when duplication has no selection", () => {
    const editor = createDrawingEditor({ drawings: [] });

    editor.setTool("path");
    editor.pointerDown({ x: 10, y: 10 });
    const reservedId = editor.getState().previewDrawing?.id;

    editor.duplicateSelected({ dx: 1, dy: 1 });
    editor.duplicateSelected({ dx: 2, dy: 2 });
    editor.pointerMove({ x: 20, y: 20 });
    editor.pointerMove({ x: 30, y: 30 });
    editor.pointerUp({ x: 40, y: 40 });

    expect(editor.getState().drawings).toMatchObject([{ id: reservedId, type: "path" }]);
    expectUniqueEditorDrawingIds(editor.getState());
  });

  for (const operation of ["cancel", "setTool", "undo", "redo"] as const) {
    it(`${operation} releases the reserved id before the next gesture`, () => {
      const editor = createDrawingEditor({
        drawings: [{ id: "drawing-1", type: "text", anchors: [{ x: 0, y: 0 }] }]
      });

      editor.setTool("trendLine");
      editor.pointerDown({ x: 10, y: 10 });
      const abandonedId = editor.getState().previewDrawing?.id;

      if (operation === "cancel") {
        editor.cancel();
      } else if (operation === "setTool") {
        editor.setTool("rectangle");
      } else {
        editor[operation]();
      }

      expect(editor.getState()).toMatchObject({
        isCreating: false,
        previewDrawing: undefined
      });

      editor.setTool("trendLine");
      editor.pointerDown({ x: 20, y: 20 });

      const nextId = editor.getState().previewDrawing?.id;

      expect(nextId).toBeDefined();
      expect(nextId).not.toBe(abandonedId);
      expectUniqueEditorDrawingIds(editor.getState());

      editor.pointerDown({ x: 30, y: 30 });
      expectUniqueEditorDrawingIds(editor.getState());
    });
  }

  for (const operation of ["cancel", "setTool"] as const) {
    it(`${operation} clears and cancels an active creation in event order`, () => {
      const events: DrawingEditorEvent[] = [];
      const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

      editor.setTool("trendLine");
      editor.pointerDown({ x: 1, y: 2 });
      editor.pointerMove({ x: 3, y: 4 });
      events.length = 0;

      if (operation === "cancel") {
        editor.cancel();
      } else {
        editor.setTool("rectangle");
      }

      expect(events).toEqual([
        { type: "drawingPreviewChanged", drawing: undefined },
        { type: "creationCanceled" },
        ...(operation === "setTool"
          ? ([{ type: "toolChanged", tool: "rectangle" }] satisfies DrawingEditorEvent[])
          : [])
      ]);
      expect(editor.getState()).toMatchObject({
        activeTool: operation === "setTool" ? "rectangle" : "trendLine",
        isCreating: false,
        previewDrawing: undefined
      });

      events.length = 0;
      editor.cancel();
      expect(events).toEqual([]);
    });
  }

  it("undo and redo clear active creation before restoring history", () => {
    const events: DrawingEditorEvent[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    editor.setTool("horizontalLine");
    editor.pointerDown({ x: 1, y: 2 });
    editor.setTool("trendLine");
    editor.pointerDown({ x: 3, y: 4 });
    editor.pointerMove({ x: 5, y: 6 });
    events.length = 0;

    editor.undo();

    expect(events).toEqual([
      { type: "drawingPreviewChanged", drawing: undefined },
      { type: "creationCanceled" },
      { type: "selectionChanged", selectedDrawingIds: [] }
    ]);
    expect(editor.getState()).toMatchObject({
      drawings: [],
      isCreating: false,
      previewDrawing: undefined
    });

    editor.pointerDown({ x: 7, y: 8 });
    editor.pointerMove({ x: 9, y: 10 });
    events.length = 0;

    editor.redo();

    expect(events).toEqual([
      { type: "drawingPreviewChanged", drawing: undefined },
      { type: "creationCanceled" },
      { type: "selectionChanged", selectedDrawingIds: ["drawing-1"] }
    ]);
    expect(editor.getState()).toMatchObject({
      drawings: [{ id: "drawing-1", type: "horizontalLine" }],
      isCreating: false,
      previewDrawing: undefined
    });
  });

  it("does not emit preview clears or cancellations for idle operations", () => {
    const events: DrawingEditorEvent[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    editor.cancel();
    editor.undo();
    editor.redo();
    editor.setTool("trendLine");

    expect(
      events.filter(
        (event) => event.type === "drawingPreviewChanged" || event.type === "creationCanceled"
      )
    ).toEqual([]);
  });

  it("clears and cancels an incomplete continuous gesture on pointer up", () => {
    const events: DrawingEditorEvent[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    editor.setTool("forecastPath");
    editor.pointerDown({ x: 1, y: 2 });
    events.length = 0;
    editor.pointerUp({ x: 1, y: 2 });

    expect(events).toEqual([
      { type: "drawingPreviewChanged", drawing: undefined },
      { type: "creationCanceled" }
    ]);
    expect(editor.getCapabilities()).toMatchObject({
      pendingAnchorCount: 0,
      canCancelCreation: false,
      canUndo: false
    });
  });

  it("reports command capabilities from selection clipboard creation and history state", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "a", type: "trendLine", anchors: [{ x: 0, y: 0 }] },
        { id: "b", type: "rectangle", anchors: [{ x: 10, y: 10 }], locked: true },
        { id: "c", type: "text", anchors: [{ x: 20, y: 20 }], visible: false }
      ]
    });

    expect(editor.getCapabilities()).toMatchObject({
      selectedDrawingCount: 0,
      editableSelectedDrawingCount: 0,
      clipboardDrawingCount: 0,
      pendingAnchorCount: 0,
      hasSelection: false,
      hasEditableSelection: false,
      canDelete: false,
      canPaste: false,
      canUndo: false,
      canRedo: false
    });

    editor.selectDrawings(["a", "b", "c"]);

    expect(editor.getCapabilities()).toMatchObject({
      selectedDrawingCount: 3,
      editableSelectedDrawingCount: 2,
      hasSelection: true,
      hasEditableSelection: true,
      canBringSelectedForward: false,
      canSendSelectedBackward: false,
      canCopy: true,
      canDuplicate: true,
      canNudge: true,
      canDelete: true,
      canLock: true,
      canUnlock: true,
      canHide: true,
      canShow: true
    });

    editor.copySelected();
    expect(editor.getCapabilities().clipboardDrawingCount).toBe(3);
    expect(editor.getCapabilities().canPaste).toBe(true);

    editor.executeCommand({ type: "setTool", tool: "trendLine" });
    editor.pointerDown({ x: 1, y: 2 });

    expect(editor.getCapabilities()).toMatchObject({
      pendingAnchorCount: 1,
      canCancelCreation: true
    });

    editor.executeCommand({ type: "cancelCreation" });
    expect(editor.getCapabilities().canCancelCreation).toBe(false);

    editor.executeCommand({ type: "pasteCopied", offset: { dx: 1, dy: 1 } });
    expect(editor.getCapabilities()).toMatchObject({
      canUndo: true,
      canRedo: false
    });

    editor.undo();
    expect(editor.getCapabilities()).toMatchObject({
      canUndo: false,
      canRedo: true
    });
  });

  it("selects drawings in bounds with additive mode and skips hidden locked drawings", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "a", type: "trendLine", anchors: [{ x: 0, y: 0 }, { x: 20, y: 20 }] },
        { id: "b", type: "rectangle", anchors: [{ x: 40, y: 40 }, { x: 80, y: 80 }] },
        { id: "hidden", type: "trendLine", anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }], visible: false },
        { id: "locked", type: "trendLine", anchors: [{ x: 5, y: 5 }, { x: 10, y: 10 }], locked: true }
      ]
    });

    editor.executeCommand({
      type: "selectDrawingsInBounds",
      bounds: { x: -1, y: -1, width: 25, height: 25 }
    });

    expect(editor.getState().selectedDrawingIds).toEqual(["a"]);

    editor.executeCommand({
      type: "selectDrawingsInBounds",
      bounds: { x: 30, y: 30, width: 60, height: 60 },
      additive: true
    });

    expect(editor.getState().selectedDrawingIds).toEqual(["a", "b"]);
  });

  it("nudges selected editable drawings and exposes selected edit handles", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "free", type: "trendLine", anchors: [{ x: 0, y: 0 }, { x: 20, y: 20 }] },
        { id: "locked", type: "trendLine", anchors: [{ x: 40, y: 40 }, { x: 80, y: 80 }], locked: true }
      ]
    });

    editor.selectDrawings(["free", "locked"]);
    editor.executeCommand({ type: "nudgeSelected", delta: { dx: 2, dy: -3 } });

    expect(findDrawing(editor.getState().drawings, "free").anchors).toEqual([
      { x: 2, y: -3 },
      { x: 22, y: 17 }
    ]);
    expect(findDrawing(editor.getState().drawings, "locked").anchors).toEqual([
      { x: 40, y: 40 },
      { x: 80, y: 80 }
    ]);
    expect(editor.getSelectedEditHandles().map((handle) => handle.kind)).toEqual([
      "anchor",
      "anchor",
      "resize",
      "resize",
      "resize",
      "resize",
      "resize",
      "resize",
      "resize",
      "resize",
      "rotate",
      "anchor",
      "anchor",
      "resize",
      "resize",
      "resize",
      "resize",
      "resize",
      "resize",
      "resize",
      "resize",
      "rotate"
    ]);

    const handles = editor.getSelectedEditHandles();

    handles[0].x = 999;
    expect(editor.getSelectedEditHandles()[0].x).toBe(2);

    editor.undo();
    expect(findDrawing(editor.getState().drawings, "free").anchors[0]).toEqual({ x: 0, y: 0 });

    editor.redo();
    expect(findDrawing(editor.getState().drawings, "free").anchors[0]).toEqual({ x: 2, y: -3 });
  });

  it("resizes and rotates selected editable drawings through commands", () => {
    const events: string[] = [];
    const editor = createDrawingEditor({
      drawings: [
        { id: "free", type: "rectangle", anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        { id: "locked", type: "rectangle", anchors: [{ x: 20, y: 20 }, { x: 30, y: 30 }], locked: true }
      ],
      onEvent(event) {
        if (event.type === "drawingUpdated") {
          events.push(event.drawing.id);
        }
      }
    });

    editor.selectDrawings(["free", "locked"]);
    editor.executeCommand({
      type: "resizeSelected",
      options: {
        handle: "bottomRight",
        fromBounds: { x: 0, y: 0, width: 10, height: 10 },
        toPoint: { x: 20, y: 20 }
      }
    });

    expect(findDrawing(editor.getState().drawings, "free").anchors).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 20 }
    ]);
    expect(findDrawing(editor.getState().drawings, "locked").anchors).toEqual([
      { x: 20, y: 20 },
      { x: 30, y: 30 }
    ]);

    editor.executeCommand({
      type: "rotateSelected",
      options: { center: { x: 10, y: 10 }, angleRadians: Math.PI / 2 }
    });

    expect(roundAnchors(findDrawing(editor.getState().drawings, "free"))).toEqual([
      { x: 20, y: 0 },
      { x: 0, y: 20 }
    ]);
    expect(events).toEqual(["free", "free"]);

    editor.undo();
    expect(findDrawing(editor.getState().drawings, "free").anchors).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 20 }
    ]);

    editor.redo();
    expect(roundAnchors(findDrawing(editor.getState().drawings, "free"))).toEqual([
      { x: 20, y: 0 },
      { x: 0, y: 20 }
    ]);
  });

  it("drags anchors through neutral editor commands", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "free", type: "trendLine", anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        { id: "locked", type: "trendLine", anchors: [{ x: 20, y: 20 }, { x: 30, y: 30 }], locked: true }
      ]
    });

    editor.executeCommand({
      type: "dragAnchor",
      drawingId: "free",
      anchorIndex: 1,
      point: { x: 40, y: 50 }
    });
    editor.executeCommand({
      type: "dragAnchor",
      drawingId: "locked",
      anchorIndex: 1,
      point: { x: 60, y: 70 }
    });

    expect(findDrawing(editor.getState().drawings, "free").anchors).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 50 }
    ]);
    expect(findDrawing(editor.getState().drawings, "locked").anchors).toEqual([
      { x: 20, y: 20 },
      { x: 30, y: 30 }
    ]);

    editor.undo();
    expect(findDrawing(editor.getState().drawings, "free").anchors[1]).toEqual({ x: 10, y: 10 });

    editor.redo();
    expect(findDrawing(editor.getState().drawings, "free").anchors[1]).toEqual({ x: 40, y: 50 });
  });

  it("drags selected drawings through one neutral editor command", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "free", type: "trendLine", anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        { id: "locked", type: "trendLine", anchors: [{ x: 20, y: 20 }, { x: 30, y: 30 }], locked: true }
      ]
    });

    editor.selectDrawings(["free", "locked"]);
    editor.executeCommand({ type: "dragSelected", delta: { dx: 12, dy: -4 } });

    expect(findDrawing(editor.getState().drawings, "free").anchors).toEqual([
      { x: 12, y: -4 },
      { x: 22, y: 6 }
    ]);
    expect(findDrawing(editor.getState().drawings, "locked").anchors).toEqual([
      { x: 20, y: 20 },
      { x: 30, y: 30 }
    ]);

    editor.undo();
    expect(findDrawing(editor.getState().drawings, "free").anchors).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 }
    ]);
    expect(editor.getCapabilities()).toMatchObject({
      canUndo: false,
      canRedo: true
    });

    editor.redo();
    expect(findDrawing(editor.getState().drawings, "free").anchors).toEqual([
      { x: 12, y: -4 },
      { x: 22, y: 6 }
    ]);
  });

  it("executes neutral drawing editor commands", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "a", type: "trendLine", anchors: [{ x: 0, y: 0 }] },
        { id: "b", type: "rectangle", anchors: [{ x: 10, y: 10 }] }
      ]
    });

    editor.executeCommand({ type: "selectDrawing", drawingId: "a" });
    editor.executeCommand({ type: "copySelected" });
    editor.executeCommand({ type: "pasteCopied", offset: { dx: 5, dy: 6 } });

    const pastedId = editor.getState().selectedDrawingIds[0];

    expect(editor.getState().drawings).toHaveLength(3);
    expect(findDrawing(editor.getState().drawings, pastedId)).toMatchObject({
      type: "trendLine",
      anchors: [{ x: 5, y: 6 }]
    });

    editor.executeCommand({ type: "updateSelectedStyle", style: { color: "#dc2626" } });
    editor.executeCommand({ type: "updateSelectedMetadata", metadata: { fibonacciLevels: [0, 1] } });
    editor.executeCommand({ type: "updateSelectedText", text: "Breakout" });
    editor.executeCommand({ type: "duplicateSelected", offset: { dx: 1, dy: 1 } });

    const duplicatedId = editor.getState().selectedDrawingIds[0];

    expect(findDrawing(editor.getState().drawings, duplicatedId)).toMatchObject({
      style: { color: "#dc2626" },
      metadata: { fibonacciLevels: [0, 1] },
      text: "Breakout"
    });

    editor.executeCommand({ type: "bringSelectedForward" });
    expect(editor.getState().drawings.at(-1)?.id).toBe(duplicatedId);

    editor.executeCommand({ type: "sendSelectedBackward" });
    expect(editor.getState().drawings.at(-1)?.id).not.toBe(duplicatedId);

    editor.executeCommand({ type: "deleteSelected" });
    expect(editor.getState().drawings.some((drawing) => drawing.id === duplicatedId)).toBe(false);
  });

  it("updates selected drawing metadata with undo redo and locked drawing protection", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "editable", type: "fibFan", anchors: [{ x: 0, y: 0 }], metadata: { source: "initial" } },
        { id: "locked", type: "fibFan", anchors: [{ x: 10, y: 10 }], locked: true }
      ]
    });

    editor.selectDrawings(["editable", "locked"]);
    editor.updateSelectedMetadata({ fibonacciLevels: [0, 0.5, 1] });

    expect(findDrawing(editor.getState().drawings, "editable").metadata).toEqual({
      source: "initial",
      fibonacciLevels: [0, 0.5, 1]
    });
    expect(findDrawing(editor.getState().drawings, "locked").metadata).toBeUndefined();

    const state = editor.getState();

    state.drawings[0].metadata = { mutated: true };
    expect(findDrawing(editor.getState().drawings, "editable").metadata).toEqual({
      source: "initial",
      fibonacciLevels: [0, 0.5, 1]
    });

    editor.undo();
    expect(findDrawing(editor.getState().drawings, "editable").metadata).toEqual({ source: "initial" });

    editor.redo();
    expect(findDrawing(editor.getState().drawings, "editable").metadata).toEqual({
      source: "initial",
      fibonacciLevels: [0, 0.5, 1]
    });
  });

  it("locks unlocks hides and shows selected drawings through commands", () => {
    const editor = createDrawingEditor({
      drawings: [{ id: "a", type: "trendLine", anchors: [{ x: 0, y: 0 }] }]
    });

    editor.executeCommand({ type: "selectDrawing", drawingId: "a" });
    editor.executeCommand({ type: "lockSelected" });

    expect(findDrawing(editor.getState().drawings, "a").locked).toBe(true);
    expect(editor.getCapabilities()).toMatchObject({
      canDelete: false,
      canUnlock: true,
      canHide: false
    });

    editor.executeCommand({ type: "unlockSelected" });
    editor.executeCommand({ type: "hideSelected" });

    expect(findDrawing(editor.getState().drawings, "a")).toMatchObject({
      locked: false,
      visible: false
    });
    expect(editor.getCapabilities()).toMatchObject({
      canHide: false,
      canShow: true
    });

    editor.executeCommand({ type: "showSelected" });
    expect(findDrawing(editor.getState().drawings, "a").visible).toBe(true);
  });

  it("returns capability snapshots that cannot mutate editor state", () => {
    const editor = createDrawingEditor({
      drawings: [{ id: "a", type: "text", anchors: [{ x: 0, y: 0 }] }]
    });

    editor.selectDrawing("a");

    const capabilities = editor.getCapabilities();

    capabilities.selectedDrawingCount = 99;
    capabilities.canDelete = false;

    expect(editor.getCapabilities()).toMatchObject({
      selectedDrawingCount: 1,
      canDelete: true
    });
  });

  it("preserves multi-select input order while filtering missing and duplicate ids", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "a", type: "trendLine", anchors: [{ x: 0, y: 0 }] },
        { id: "b", type: "rectangle", anchors: [{ x: 10, y: 10 }] },
        { id: "c", type: "text", anchors: [{ x: 20, y: 20 }] }
      ]
    });

    editor.selectDrawings(["missing", "b", "a", "b", "c"]);

    expect(editor.getState().selectedDrawingIds).toEqual(["b", "a", "c"]);
    expect(editor.getObjectManagerItems().map((item) => [item.id, item.selected])).toEqual([
      ["a", true],
      ["b", true],
      ["c", true]
    ]);
  });

  it("changes selected z-order deterministically and supports undo and redo", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "a", type: "trendLine", anchors: [{ x: 0, y: 0 }] },
        { id: "b", type: "rectangle", anchors: [{ x: 10, y: 10 }] },
        { id: "c", type: "text", anchors: [{ x: 20, y: 20 }] }
      ]
    });

    editor.selectDrawing("b");
    editor.bringSelectedForward();

    expect(editor.getState().drawings.map((drawing) => drawing.id)).toEqual(["a", "c", "b"]);
    expect(editor.getObjectManagerItems().map((item) => [item.id, item.zIndex])).toEqual([
      ["a", 0],
      ["c", 1],
      ["b", 2]
    ]);

    editor.undo();
    expect(editor.getState().drawings.map((drawing) => drawing.id)).toEqual(["a", "b", "c"]);

    editor.redo();
    expect(editor.getState().drawings.map((drawing) => drawing.id)).toEqual(["a", "c", "b"]);

    editor.sendSelectedBackward();
    expect(editor.getState().drawings.map((drawing) => drawing.id)).toEqual(["a", "b", "c"]);
  });

  it("copies, pastes, and duplicates drawings with new ids and offset anchors", () => {
    const editor = createDrawingEditor({
      drawings: [
        {
          id: "shape",
          type: "rectangle",
          anchors: [
            { x: 0, y: 0, time: 1, price: 10 },
            { x: 20, y: 20, time: 2, price: 12 }
          ],
          style: { color: "#2563eb", fill: "#bfdbfe", lineWidth: 2 },
          text: "Range",
          visible: false,
          zIndex: 8,
          metadata: { source: "fixture" }
        },
        {
          id: "label",
          type: "text",
          anchors: [{ x: 30, y: 40 }],
          style: { textColor: "#111827", fontSize: 14 },
          text: "Breakout"
        }
      ]
    });

    editor.selectDrawings(["shape", "label"]);
    editor.copySelected();
    editor.pasteCopied({ dx: 5, dy: -10 });

    const pastedState = editor.getState();
    const pastedIds = pastedState.selectedDrawingIds;

    expect(pastedState.drawings).toHaveLength(4);
    expect(new Set(pastedState.drawings.map((drawing) => drawing.id)).size).toBe(4);
    expect(pastedIds).toHaveLength(2);

    const pastedShape = findDrawing(pastedState.drawings, pastedIds[0]);
    expect(pastedShape).toMatchObject({
      type: "rectangle",
      style: { color: "#2563eb", fill: "#bfdbfe", lineWidth: 2 },
      text: "Range",
      visible: false,
      zIndex: 8,
      metadata: { source: "fixture" }
    });
    expect(pastedShape.anchors).toEqual([
      { x: 5, y: -10, time: 1, price: 10 },
      { x: 25, y: 10, time: 2, price: 12 }
    ]);

    const pastedLabel = findDrawing(pastedState.drawings, pastedIds[1]);
    expect(pastedLabel).toMatchObject({
      type: "text",
      style: { textColor: "#111827", fontSize: 14 },
      text: "Breakout"
    });
    expect(pastedLabel.anchors).toEqual([{ x: 35, y: 30 }]);

    editor.duplicateSelected({ dx: 1, dy: 2 });

    const duplicatedState = editor.getState();
    expect(duplicatedState.drawings).toHaveLength(6);
    expect(new Set(duplicatedState.drawings.map((drawing) => drawing.id)).size).toBe(6);

    const duplicatedShape = findDrawing(duplicatedState.drawings, duplicatedState.selectedDrawingIds[0]);
    expect(duplicatedShape.id).not.toBe(pastedShape.id);
    expect(duplicatedShape.anchors).toEqual([
      { x: 6, y: -8, time: 1, price: 10 },
      { x: 26, y: 12, time: 2, price: 12 }
    ]);
  });

  it("preserves copied drawings across undo and paste history", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "a", type: "text", anchors: [{ x: 0, y: 0 }], text: "A" },
        { id: "b", type: "text", anchors: [{ x: 10, y: 20 }], text: "B" }
      ]
    });

    editor.selectDrawing("a");
    editor.updateSelectedText("A1");
    editor.selectDrawing("b");
    editor.copySelected();
    editor.undo();
    editor.pasteCopied({ dx: 1, dy: 1 });

    const state = editor.getState();
    const pastedId = state.selectedDrawingIds[0];
    const pasted = findDrawing(state.drawings, pastedId);

    expect(findDrawing(state.drawings, "a").text).toBe("A");
    expect(findDrawing(state.drawings, "b").text).toBe("B");
    expect(pastedId).not.toBe("b");
    expect(pasted).toMatchObject({
      type: "text",
      text: "B",
      anchors: [{ x: 11, y: 21 }]
    });
  });

  it("copies and duplicates locked drawings without mutating the original", () => {
    const editor = createDrawingEditor({
      drawings: [
        {
          id: "locked",
          type: "text",
          locked: true,
          anchors: [{ x: 0, y: 0 }],
          text: "Locked"
        }
      ]
    });

    editor.selectDrawing("locked");
    editor.copySelected();
    editor.pasteCopied({ dx: 2, dy: 3 });

    const pastedState = editor.getState();
    const pastedId = pastedState.selectedDrawingIds[0];

    expect(pastedId).not.toBe("locked");
    expect(findDrawing(pastedState.drawings, "locked")).toMatchObject({
      locked: true,
      anchors: [{ x: 0, y: 0 }],
      text: "Locked"
    });
    expect(findDrawing(pastedState.drawings, pastedId)).toMatchObject({
      locked: true,
      anchors: [{ x: 2, y: 3 }],
      text: "Locked"
    });

    editor.selectDrawing("locked");
    editor.duplicateSelected({ dx: 4, dy: 5 });

    const duplicatedState = editor.getState();
    const duplicatedId = duplicatedState.selectedDrawingIds[0];

    expect(duplicatedId).not.toBe("locked");
    expect(findDrawing(duplicatedState.drawings, "locked")).toMatchObject({
      locked: true,
      anchors: [{ x: 0, y: 0 }],
      text: "Locked"
    });
    expect(findDrawing(duplicatedState.drawings, duplicatedId)).toMatchObject({
      locked: true,
      anchors: [{ x: 4, y: 5 }],
      text: "Locked"
    });
  });

  it("updates selected style and text through undoable commands", () => {
    const editor = createDrawingEditor({
      drawings: [
        {
          id: "text-1",
          type: "text",
          anchors: [{ x: 10, y: 20 }],
          style: { color: "#111827" },
          text: "A"
        }
      ]
    });

    editor.selectDrawing("text-1");
    editor.updateSelectedStyle({ color: "#dc2626", fontSize: 16 });
    editor.updateSelectedText("Breakout");

    expect(editor.getState().drawings[0]).toMatchObject({
      text: "Breakout",
      style: { color: "#dc2626", fontSize: 16 }
    });

    editor.undo();
    expect(editor.getState().drawings[0]).toMatchObject({
      text: "A",
      style: { color: "#dc2626", fontSize: 16 }
    });

    editor.undo();
    expect(editor.getState().drawings[0]).toMatchObject({
      text: "A",
      style: { color: "#111827" }
    });

    editor.redo();
    expect(editor.getState().drawings[0].style).toEqual({ color: "#dc2626", fontSize: 16 });
  });

  it("does not mutate locked drawings during group operations", () => {
    const editor = createDrawingEditor({
      drawings: [
        {
          id: "free",
          type: "trendLine",
          anchors: [
            { x: 20, y: 20 },
            { x: 30, y: 30 }
          ]
        },
        {
          id: "locked",
          type: "text",
          locked: true,
          anchors: [{ x: 0, y: 0 }],
          style: { color: "#111827" },
          text: "Locked"
        },
        { id: "other", type: "rectangle", anchors: [{ x: 50, y: 50 }] }
      ]
    });

    editor.selectDrawings(["free", "locked"]);
    editor.dragSelected({ dx: 10, dy: 10 });
    editor.updateSelectedStyle({ color: "#dc2626" });
    editor.updateSelectedText("Changed");
    editor.bringSelectedForward();
    editor.deleteSelected();

    const state = editor.getState();
    const locked = findDrawing(state.drawings, "locked");

    expect(locked).toMatchObject({
      anchors: [{ x: 0, y: 0 }],
      style: { color: "#111827" },
      text: "Locked",
      locked: true
    });
    expect(state.drawings.map((drawing) => drawing.id)).toEqual(["locked", "other"]);
  });

  it("reports object manager state from current drawing order", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "visible", type: "trendLine", anchors: [{ x: 0, y: 0 }] },
        {
          id: "hidden-locked",
          type: "rectangle",
          anchors: [{ x: 10, y: 10 }],
          visible: false,
          locked: true
        }
      ]
    });

    editor.selectDrawings(["hidden-locked"]);

    expect(editor.getObjectManagerItems()).toEqual([
      {
        id: "visible",
        type: "trendLine",
        visible: true,
        locked: false,
        selected: false,
        zIndex: 0
      },
      {
        id: "hidden-locked",
        type: "rectangle",
        visible: false,
        locked: true,
        selected: true,
        zIndex: 1
      }
    ]);
  });
});

function findDrawing(drawings: DrawingObject[], id: string): DrawingObject {
  const drawing = drawings.find((item) => item.id === id);

  if (!drawing) {
    throw new Error(`Missing drawing ${id}`);
  }

  return drawing;
}

function roundAnchors(drawing: DrawingObject): Array<{ x: number; y: number }> {
  return drawing.anchors.map((anchor) => ({
    x: round(anchor.x ?? 0),
    y: round(anchor.y ?? 0)
  }));
}

function round(value: number): number {
  const rounded = Math.round(value * 1000000) / 1000000;

  return Object.is(rounded, -0) ? 0 : rounded;
}

function expectUniqueEditorDrawingIds(state: {
  drawings: DrawingObject[];
  previewDrawing?: DrawingObject;
}): void {
  const ids = state.previewDrawing
    ? [...state.drawings.map((drawing) => drawing.id), state.previewDrawing.id]
    : state.drawings.map((drawing) => drawing.id);

  expect(new Set(ids).size).toBe(ids.length);
}
