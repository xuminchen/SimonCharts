import { describe, expect, it } from "vitest";
import { createDrawingEditor, type DrawingObject } from "../index";

describe("complete drawing editor", () => {
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
