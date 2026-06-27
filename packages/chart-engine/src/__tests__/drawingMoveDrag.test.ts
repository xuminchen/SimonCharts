import { describe, expect, it } from "vitest";
import {
  beginDrawingMoveDrag,
  finishDrawingMoveDrag,
  getDrawingMoveDragCommand,
  updateDrawingMoveDrag,
  type DrawingObject
} from "../index";

describe("drawing move drag", () => {
  it("does not begin when no editable selected drawing exists", () => {
    const drawings = [
      drawing("free", 0, 0, 10, 10),
      { ...drawing("locked", 20, 20, 30, 30), locked: true }
    ];

    expect(
      beginDrawingMoveDrag({
        drawings,
        selectedDrawingIds: [],
        startPoint: { x: 10, y: 20 }
      })
    ).toBeUndefined();
    expect(
      beginDrawingMoveDrag({
        drawings,
        selectedDrawingIds: ["missing"],
        startPoint: { x: 10, y: 20 }
      })
    ).toBeUndefined();
    expect(
      beginDrawingMoveDrag({
        drawings,
        selectedDrawingIds: ["locked"],
        startPoint: { x: 10, y: 20 }
      })
    ).toBeUndefined();
  });

  it("creates preview movement and commands for editable selected drawings", () => {
    const operation = beginDrawingMoveDrag({
      drawings: [drawing("a", 0, 0, 10, 10), drawing("b", 20, 20, 30, 30)],
      selectedDrawingIds: ["a"],
      startPoint: { x: 10, y: 20 }
    });

    expect(operation).toBeDefined();

    const preview = updateDrawingMoveDrag(operation!, { x: 15, y: 25 });

    expect(preview?.command).toEqual({
      type: "dragSelected",
      delta: { dx: 5, dy: 5 }
    });
    expect(preview?.drawings[0].anchors).toEqual([
      { x: 5, y: 5 },
      { x: 15, y: 15 }
    ]);
    expect(preview?.drawings[1].anchors).toEqual([
      { x: 20, y: 20 },
      { x: 30, y: 30 }
    ]);
  });

  it("uses the original operation snapshot for repeated updates", () => {
    const source = [drawing("a", 0, 0, 10, 10)];
    const selectedDrawingIds = ["a"];
    const operation = beginDrawingMoveDrag({
      drawings: source,
      selectedDrawingIds,
      startPoint: { x: 0, y: 0 }
    });

    expect(operation).toBeDefined();

    source[0].anchors[0].x = 100;
    selectedDrawingIds[0] = "missing";

    const firstPreview = updateDrawingMoveDrag(operation!, { x: 5, y: 5 });
    const secondPreview = updateDrawingMoveDrag(operation!, { x: 7, y: 7 });

    expect(firstPreview?.drawings[0].anchors).toEqual([
      { x: 5, y: 5 },
      { x: 15, y: 15 }
    ]);
    expect(secondPreview?.drawings[0].anchors).toEqual([
      { x: 7, y: 7 },
      { x: 17, y: 17 }
    ]);
  });

  it("leaves locked selected drawings unchanged in previews", () => {
    const operation = beginDrawingMoveDrag({
      drawings: [
        drawing("free", 0, 0, 10, 10),
        { ...drawing("locked", 20, 20, 30, 30), locked: true }
      ],
      selectedDrawingIds: ["free", "locked"],
      startPoint: { x: 0, y: 0 }
    });

    const preview = updateDrawingMoveDrag(operation!, { x: 10, y: -5 });

    expect(preview?.drawings[0].anchors).toEqual([
      { x: 10, y: -5 },
      { x: 20, y: 5 }
    ]);
    expect(preview?.drawings[1].anchors).toEqual([
      { x: 20, y: 20 },
      { x: 30, y: 30 }
    ]);
  });

  it("returns undefined for zero-delta updates and finish commands", () => {
    const operation = beginDrawingMoveDrag({
      drawings: [drawing("a", 0, 0, 10, 10)],
      selectedDrawingIds: ["a"],
      startPoint: { x: 10, y: 20 }
    });

    expect(updateDrawingMoveDrag(operation!, { x: 10, y: 20 })).toBeUndefined();
    expect(getDrawingMoveDragCommand(operation!, { x: 10, y: 20 })).toBeUndefined();
    expect(finishDrawingMoveDrag(operation!, { x: 10, y: 20 })).toBeUndefined();
  });

  it("finishes with a dragSelected command", () => {
    const operation = beginDrawingMoveDrag({
      drawings: [drawing("a", 0, 0, 10, 10)],
      selectedDrawingIds: ["a"],
      startPoint: { x: 10, y: 20 }
    });

    expect(finishDrawingMoveDrag(operation!, { x: 6, y: 28 })).toEqual({
      type: "dragSelected",
      delta: { dx: -4, dy: 8 }
    });
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
