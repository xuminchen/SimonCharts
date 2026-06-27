import { describe, expect, it } from "vitest";
import {
  beginDrawingHandleDrag,
  finishDrawingHandleDrag,
  hitTestDrawingEditHandle,
  updateDrawingHandleDrag,
  type DrawingEditHandle,
  type DrawingObject
} from "../index";

describe("drawing handle drag", () => {
  it("hit-tests the nearest edit handle within radius", () => {
    const handles: DrawingEditHandle[] = [
      handle("a:anchor:0", "anchor", 0, 0),
      handle("a:resize:right", "resize", 5, 0, { position: "right" })
    ];

    expect(hitTestDrawingEditHandle(handles, { x: 4, y: 0 }, { radius: 6 })?.id).toBe("a:resize:right");
    expect(hitTestDrawingEditHandle(handles, { x: 20, y: 0 }, { radius: 6 })).toBeUndefined();
    expect(hitTestDrawingEditHandle(handles, { x: 4, y: 0 }, { radius: 6, kinds: ["anchor"] })?.id).toBe(
      "a:anchor:0"
    );
  });

  it("creates anchor drag previews and final commands", () => {
    const operation = beginDrawingHandleDrag({
      handle: handle("a:anchor:1", "anchor", 10, 10, { anchorIndex: 1 }),
      drawings: [drawing("a", 0, 0, 10, 10)],
      selectedDrawingIds: ["a"],
      startPoint: { x: 10, y: 10 }
    });

    expect(operation).toBeDefined();

    const preview = updateDrawingHandleDrag(operation!, { x: 20, y: 30 });

    expect(preview?.command).toEqual({
      type: "dragAnchor",
      drawingId: "a",
      anchorIndex: 1,
      point: { x: 20, y: 30 }
    });
    expect(preview?.drawings[0].anchors).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 30 }
    ]);
    expect(finishDrawingHandleDrag(operation!, { x: 25, y: 35 })).toEqual({
      type: "dragAnchor",
      drawingId: "a",
      anchorIndex: 1,
      point: { x: 25, y: 35 }
    });
  });

  it("creates resize previews from the original selection snapshot", () => {
    const operation = beginDrawingHandleDrag({
      handle: handle("a:resize:bottomRight", "resize", 30, 30, { position: "bottomRight" }),
      drawings: [drawing("a", 0, 0, 10, 10), drawing("b", 20, 20, 30, 30)],
      selectedDrawingIds: ["a", "b"],
      startPoint: { x: 30, y: 30 }
    });

    expect(operation).toBeDefined();

    const firstPreview = updateDrawingHandleDrag(operation!, { x: 60, y: 60 });
    const secondPreview = updateDrawingHandleDrag(operation!, { x: 90, y: 90 });

    expect(firstPreview?.command).toMatchObject({
      type: "resizeSelected",
      options: {
        handle: "bottomRight",
        fromBounds: { x: 0, y: 0, width: 30, height: 30 },
        toPoint: { x: 60, y: 60 }
      }
    });
    expect(firstPreview?.drawings[0].anchors).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 20 }
    ]);
    expect(secondPreview?.drawings[0].anchors).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 30 }
    ]);
  });

  it("creates rotate previews around the original selection center", () => {
    const operation = beginDrawingHandleDrag({
      handle: handle("a:rotate", "rotate", 10, -24),
      drawings: [drawing("a", 0, 0, 20, 0)],
      selectedDrawingIds: ["a"],
      startPoint: { x: 10, y: -24 }
    });

    expect(operation).toBeDefined();

    const preview = updateDrawingHandleDrag(operation!, { x: 44, y: 0 });

    expect(preview?.command).toMatchObject({
      type: "rotateSelected",
      options: { center: { x: 10, y: 0 } }
    });
    expect(roundAnchors(preview!.drawings[0])).toEqual([
      { x: 10, y: -10 },
      { x: 10, y: 10 }
    ]);
  });

  it("rejects invalid or locked handle drag operations", () => {
    expect(
      beginDrawingHandleDrag({
        handle: handle("a:anchor:0", "anchor", 0, 0),
        drawings: [drawing("a", 0, 0, 10, 10)],
        selectedDrawingIds: ["a"],
        startPoint: { x: 0, y: 0 }
      })
    ).toBeUndefined();

    expect(
      beginDrawingHandleDrag({
        handle: handle("a:resize:right", "resize", 10, 5, { position: "right" }),
        drawings: [{ ...drawing("a", 0, 0, 10, 10), locked: true }],
        selectedDrawingIds: ["a"],
        startPoint: { x: 10, y: 5 }
      })
    ).toBeUndefined();
  });
});

function handle(
  id: string,
  kind: DrawingEditHandle["kind"],
  x: number,
  y: number,
  patch: Partial<DrawingEditHandle> = {}
): DrawingEditHandle {
  return {
    id,
    drawingId: "a",
    kind,
    x,
    y,
    ...patch
  };
}

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
