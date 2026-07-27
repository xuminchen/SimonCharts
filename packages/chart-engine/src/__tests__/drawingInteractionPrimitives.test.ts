import { describe, expect, it } from "vitest";
import {
  boundsIntersect,
  getDrawingEditHandles,
  getDrawingIdsInBounds,
  getDrawingSelectionBounds,
  normalizeDrawingSelectionBounds,
  type DrawingObject
} from "../index";

describe("drawing interaction primitives", () => {
  it("creates anchor resize and rotate handles from drawing geometry", () => {
    const handles = getDrawingEditHandles(drawing("a", 10, 20, 80, 60));

    expect(handles.filter((handle) => handle.kind === "anchor")).toHaveLength(2);
    expect(handles.find((handle) => handle.id === "a:anchor:0")).toMatchObject({
      drawingId: "a",
      kind: "anchor",
      anchorIndex: 0,
      x: 10,
      y: 20
    });
    expect(handles.filter((handle) => handle.kind === "resize").map((handle) => handle.position)).toEqual([
      "topLeft",
      "top",
      "topRight",
      "right",
      "bottomRight",
      "bottom",
      "bottomLeft",
      "left"
    ]);
    expect(handles.find((handle) => handle.id === "a:rotate")).toMatchObject({
      drawingId: "a",
      kind: "rotate",
      x: 45,
      y: -4
    });
  });

  it("excludes non-interactive drawings from handles and selection", () => {
    const passive = {
      ...drawing("passive", 10, 20, 80, 60),
      interactive: false
    };

    expect(getDrawingEditHandles(passive)).toEqual([]);
    expect(getDrawingSelectionBounds([passive])).toBeUndefined();
    expect(getDrawingIdsInBounds(
      [passive],
      { x: 0, y: 0, width: 100, height: 100 },
      { includeHidden: true, includeLocked: true }
    )).toEqual([]);
  });

  it("creates selection bounds from visible unlocked drawings", () => {
    expect(
      getDrawingSelectionBounds([
        drawing("a", 10, 20, 80, 60),
        drawing("b", -10, 30, 20, 90),
        { ...drawing("hidden", 0, 0, 10, 10), visible: false },
        { ...drawing("locked", 100, 100, 120, 120), locked: true }
      ])
    ).toEqual({ x: -10, y: 20, width: 90, height: 70 });
  });

  it("selects drawing ids that intersect normalized bounds", () => {
    const drawings = [
      drawing("a", 10, 20, 80, 60),
      drawing("b", 200, 200, 240, 240),
      { ...drawing("hidden", 0, 0, 10, 10), visible: false },
      { ...drawing("locked", 18, 18, 28, 28), locked: true }
    ];
    const bounds = normalizeDrawingSelectionBounds({ x: 90, y: 80 }, { x: 0, y: 0 });

    expect(bounds).toEqual({ x: 0, y: 0, width: 90, height: 80 });
    expect(getDrawingIdsInBounds(drawings, bounds)).toEqual(["a"]);
    expect(getDrawingIdsInBounds(drawings, bounds, { includeHidden: true, includeLocked: true })).toEqual([
      "a",
      "hidden",
      "locked"
    ]);
  });

  it("detects inclusive bounds intersection", () => {
    expect(boundsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 1, height: 1 })).toBe(true);
    expect(boundsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 11, y: 11, width: 1, height: 1 })).toBe(false);
  });
});

function drawing(id: string, x1: number, y1: number, x2: number, y2: number): DrawingObject {
  return {
    id,
    type: "trendLine",
    anchors: [
      { x: x1, y: y1 },
      { x: x2, y: y2 }
    ]
  };
}
