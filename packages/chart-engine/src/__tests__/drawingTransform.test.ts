import { describe, expect, it } from "vitest";
import {
  resizeDrawing,
  resizeDrawings,
  rotateDrawing,
  rotateDrawings,
  type DrawingObject
} from "../index";

describe("drawing transform", () => {
  it("resizes drawing anchors from the bottom right handle", () => {
    const resized = resizeDrawing(drawing("a", 10, 20, 30, 40), {
      handle: "bottomRight",
      fromBounds: { x: 10, y: 20, width: 20, height: 20 },
      toPoint: { x: 50, y: 80 }
    });

    expect(resized.anchors).toEqual([
      { x: 10, y: 20 },
      { x: 50, y: 80 }
    ]);
  });

  it("resizes multiple drawings against shared selection bounds", () => {
    const resized = resizeDrawings(
      [drawing("a", 0, 0, 10, 10), drawing("b", 20, 20, 30, 30)],
      {
        handle: "right",
        fromBounds: { x: 0, y: 0, width: 30, height: 30 },
        toPoint: { x: 60, y: 0 }
      }
    );

    expect(resized[0].anchors).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 10 }
    ]);
    expect(resized[1].anchors).toEqual([
      { x: 40, y: 20 },
      { x: 60, y: 30 }
    ]);
  });

  it("clamps resize to minimum size", () => {
    const resized = resizeDrawing(drawing("a", 0, 0, 10, 10), {
      handle: "left",
      fromBounds: { x: 0, y: 0, width: 10, height: 10 },
      toPoint: { x: 12, y: 0 },
      minSize: 4
    });

    expect(resized.anchors).toEqual([
      { x: 6, y: 0 },
      { x: 10, y: 10 }
    ]);
  });

  it("rotates drawing anchors around a supplied center", () => {
    const rotated = rotateDrawing(drawing("a", 10, 0, 20, 0), {
      center: { x: 10, y: 10 },
      angleRadians: Math.PI / 2
    });

    expect(roundAnchors(rotated)).toEqual([
      { x: 20, y: 10 },
      { x: 20, y: 20 }
    ]);
  });

  it("preserves non-screen coordinate fields and non-finite screen coordinates", () => {
    const resized = resizeDrawing(
      {
        id: "a",
        type: "trendLine",
        anchors: [
          { x: 10, y: 10, time: 1, index: 2, price: 3 },
          { time: 4, price: 5 }
        ],
        style: { color: "#2563eb" },
        text: "A",
        metadata: { source: "test" }
      },
      {
        handle: "bottomRight",
        fromBounds: { x: 10, y: 10, width: 10, height: 10 },
        toPoint: { x: 30, y: 30 }
      }
    );

    expect(resized).toMatchObject({
      style: { color: "#2563eb" },
      text: "A",
      metadata: { source: "test" }
    });
    expect(resized.anchors).toEqual([
      { x: 10, y: 10, time: 1, index: 2, price: 3 },
      { time: 4, price: 5 }
    ]);
  });

  it("rotates multiple drawings", () => {
    const rotated = rotateDrawings([drawing("a", 1, 0, 2, 0), drawing("b", 0, 1, 0, 2)], {
      center: { x: 0, y: 0 },
      angleRadians: Math.PI
    });

    expect(rotated.map(roundAnchors)).toEqual([
      [
        { x: -1, y: 0 },
        { x: -2, y: 0 }
      ],
      [
        { x: 0, y: -1 },
        { x: 0, y: -2 }
      ]
    ]);
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
