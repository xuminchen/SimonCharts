import { describe, expect, it } from "vitest";
import {
  createDrawingEditor,
  snapPointToTargets,
  type DrawingObject
} from "../index";

describe("drawing editor", () => {
  it("previews a step tool before its final anchor", () => {
    const editor = createDrawingEditor({ drawings: [] });
    editor.setTool("trendLine");
    editor.pointerDown({ x: 10, y: 20, time: 1, price: 10 });
    editor.pointerMove({ x: 30, y: 40, time: 2, price: 12 });
    expect(editor.getState().previewDrawing?.anchors).toHaveLength(2);
    expect(editor.getState().drawings).toHaveLength(0);
  });

  for (const type of ["path", "brush", "forecastPath"] as const) {
    it(`commits ${type} on pointer up`, () => {
      const editor = createDrawingEditor({ drawings: [] });
      editor.setTool(type);
      editor.pointerDown({ x: 10, y: 10, time: 1, price: 10 });
      editor.pointerMove({ x: 20, y: 20, time: 2, price: 11 });
      editor.pointerMove({ x: 30, y: 25, time: 3, price: 12 });
      expect(editor.getState().drawings).toHaveLength(0);
      expect(editor.getState().previewDrawing?.anchors.length).toBeGreaterThanOrEqual(3);
      editor.pointerUp({ x: 40, y: 30, time: 4, price: 13 });
      expect(editor.getState().drawings).toHaveLength(1);
      expect(editor.getState().previewDrawing).toBeUndefined();
    });

    it(`cancels an active ${type} gesture`, () => {
      const editor = createDrawingEditor({ drawings: [] });
      editor.setTool(type);
      editor.pointerDown({ x: 10, y: 10, time: 1, price: 10 });
      editor.pointerMove({ x: 20, y: 20, time: 2, price: 11 });
      editor.cancel();

      expect(editor.getState()).toMatchObject({
        drawings: [],
        isCreating: false,
        previewDrawing: undefined
      });
      expect(editor.getCapabilities().canUndo).toBe(false);
    });
  }

  it("cancels an incomplete continuous gesture without history", () => {
    const editor = createDrawingEditor({ drawings: [] });
    editor.setTool("path");
    editor.pointerDown({ x: 10, y: 10, time: 1, price: 10 });
    editor.pointerUp({ x: 10, y: 10, time: 1, price: 10 });
    expect(editor.getState()).toMatchObject({ drawings: [], previewDrawing: undefined });
    expect(editor.getCapabilities().canUndo).toBe(false);
  });

  it("creates a drawing by anchors and emits neutral events", () => {
    const events: unknown[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    editor.setTool("trendLine");
    editor.pointerDown({ x: 10, y: 20, time: 1, price: 10 });
    editor.pointerDown({ x: 80, y: 60, time: 2, price: 12 });

    expect(editor.getState().drawings).toHaveLength(1);
    expect(editor.getState().drawings[0]).toMatchObject({
      id: "drawing-1",
      type: "trendLine",
      anchors: [
        { x: 10, y: 20, time: 1, price: 10 },
        { x: 80, y: 60, time: 2, price: 12 }
      ]
    });
    expect(events.map((event) => (event as { type: string }).type)).toContain("drawingCreated");
  });

  it("uses built-in registry anchor counts when creating drawings", () => {
    const editor = createDrawingEditor({ drawings: [] });

    editor.setTool("horizontalLine");
    editor.pointerDown({ x: 10, y: 20, time: 1, price: 10 });

    expect(editor.getState().drawings).toHaveLength(1);
    expect(editor.getState().drawings[0]).toMatchObject({
      type: "horizontalLine",
      anchors: [{ x: 10, y: 20, time: 1, price: 10 }]
    });
  });

  it("moves a selected drawing", () => {
    const drawing: DrawingObject = {
      id: "d1",
      type: "trendLine",
      anchors: [
        { x: 10, y: 20 },
        { x: 80, y: 60 }
      ]
    };
    const editor = createDrawingEditor({ drawings: [drawing] });

    editor.selectDrawing("d1");
    editor.dragSelected({ dx: 5, dy: -10 });

    expect(editor.getState().drawings[0].anchors).toEqual([
      { x: 15, y: 10 },
      { x: 85, y: 50 }
    ]);
  });

  it("undoes and redoes drawing creation", () => {
    const editor = createDrawingEditor({ drawings: [] });

    editor.setTool("trendLine");
    editor.pointerDown({ x: 10, y: 20 });
    editor.pointerDown({ x: 80, y: 60 });
    editor.undo();

    expect(editor.getState().drawings).toEqual([]);

    editor.redo();

    expect(editor.getState().drawings).toHaveLength(1);
    expect(editor.getState().drawings[0].type).toBe("trendLine");
  });

  it("undoes and redoes drawing movement and anchor edits", () => {
    const editor = createDrawingEditor({
      drawings: [
        {
          id: "d1",
          type: "trendLine",
          anchors: [
            { x: 10, y: 20 },
            { x: 80, y: 60 }
          ]
        }
      ]
    });

    editor.selectDrawing("d1");
    editor.dragSelected({ dx: 5, dy: -10 });
    editor.dragAnchor("d1", 0, { x: 100, y: 200 });

    expect(editor.getState().drawings[0].anchors[0]).toEqual({ x: 100, y: 200 });

    editor.undo();
    expect(editor.getState().drawings[0].anchors).toEqual([
      { x: 15, y: 10 },
      { x: 85, y: 50 }
    ]);

    editor.undo();
    expect(editor.getState().drawings[0].anchors).toEqual([
      { x: 10, y: 20 },
      { x: 80, y: 60 }
    ]);

    editor.redo();
    expect(editor.getState().drawings[0].anchors).toEqual([
      { x: 15, y: 10 },
      { x: 85, y: 50 }
    ]);
  });

  it("does not edit locked drawings", () => {
    const editor = createDrawingEditor({
      drawings: [{ id: "d1", type: "trendLine", anchors: [{ x: 1, y: 1 }], locked: true }]
    });

    editor.selectDrawing("d1");
    editor.dragSelected({ dx: 10, dy: 10 });
    editor.dragAnchor("d1", 0, { x: 5, y: 5 });

    expect(editor.getState().drawings[0].anchors).toEqual([{ x: 1, y: 1 }]);
  });

  it("drags a drawing anchor", () => {
    const editor = createDrawingEditor({
      drawings: [{ id: "d1", type: "trendLine", anchors: [{ x: 1, y: 1 }] }]
    });

    editor.dragAnchor("d1", 0, { x: 12, y: 14, time: 2, price: 10 });

    expect(editor.getState().drawings[0].anchors).toEqual([
      { x: 12, y: 14, time: 2, price: 10 }
    ]);
  });

  it("deletes, locks, and hides selected drawings", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "d1", type: "trendLine", anchors: [{ x: 1, y: 1 }] },
        { id: "d2", type: "trendLine", anchors: [{ x: 2, y: 2 }] }
      ]
    });

    editor.selectDrawing("d1");
    editor.lockSelected();
    expect(editor.getState().drawings[0].locked).toBe(true);

    editor.selectDrawing("d2");
    editor.hideSelected();
    expect(editor.getState().drawings[1].visible).toBe(false);

    editor.deleteSelected();
    expect(editor.getState().drawings.map((drawing) => drawing.id)).toEqual(["d1"]);
  });

  it("clears redo state after a new drawing edit", () => {
    const editor = createDrawingEditor({
      drawings: [{ id: "d1", type: "trendLine", anchors: [{ x: 1, y: 1 }] }]
    });

    editor.selectDrawing("d1");
    editor.dragSelected({ dx: 1, dy: 1 });
    editor.undo();
    editor.dragSelected({ dx: 3, dy: 3 });
    editor.redo();

    expect(editor.getState().drawings[0].anchors).toEqual([{ x: 4, y: 4 }]);
  });

  it("snaps points to nearby targets", () => {
    expect(snapPointToTargets({ x: 10, y: 10 }, [{ x: 12, y: 11 }], 4)).toEqual({
      x: 12,
      y: 11
    });
    expect(snapPointToTargets({ x: 10, y: 10 }, [{ x: 40, y: 40 }], 4)).toEqual({
      x: 10,
      y: 10
    });
  });
});
