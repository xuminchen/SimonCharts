import { describe, expect, it } from "vitest";
import {
  beginDrawingSelectionBox,
  finishDrawingSelectionBox,
  updateDrawingSelectionBox,
  type DrawingObject
} from "../index";

describe("drawing selection box", () => {
  it("creates normalized preview bounds and selected drawing ids", () => {
    const operation = beginDrawingSelectionBox({
      drawings: [
        drawing("a", 10, 20, 80, 60),
        drawing("b", 200, 200, 240, 240)
      ],
      startPoint: { x: 90, y: 80 }
    });

    expect(updateDrawingSelectionBox(operation, { x: 0, y: 0 })).toEqual({
      bounds: { x: 0, y: 0, width: 90, height: 80 },
      selectedDrawingIds: ["a"],
      command: {
        type: "selectDrawingsInBounds",
        bounds: { x: 0, y: 0, width: 90, height: 80 },
        additive: false
      }
    });
  });

  it("uses the original drawing snapshot for repeated updates", () => {
    const source = [drawing("a", 0, 0, 10, 10), drawing("b", 40, 40, 50, 50)];
    const operation = beginDrawingSelectionBox({
      drawings: source,
      startPoint: { x: 0, y: 0 }
    });

    source[1].anchors[0].x = 200;

    expect(updateDrawingSelectionBox(operation, { x: 45, y: 45 }).selectedDrawingIds).toEqual(["a", "b"]);
  });

  it("honors hidden and locked selection options", () => {
    const drawings = [
      drawing("a", 0, 0, 10, 10),
      { ...drawing("hidden", 0, 0, 10, 10), visible: false },
      { ...drawing("locked", 0, 0, 10, 10), locked: true },
      { ...drawing("passive", 0, 0, 10, 10), interactive: false }
    ];

    expect(
      updateDrawingSelectionBox(
        beginDrawingSelectionBox({ drawings, startPoint: { x: -1, y: -1 } }),
        { x: 20, y: 20 }
      ).selectedDrawingIds
    ).toEqual(["a"]);

    expect(
      updateDrawingSelectionBox(
        beginDrawingSelectionBox({
          drawings,
          startPoint: { x: -1, y: -1 },
          selectionOptions: { includeHidden: true, includeLocked: true }
        }),
        { x: 20, y: 20 }
      ).selectedDrawingIds
    ).toEqual(["a", "hidden", "locked"]);
  });

  it("finishes as an additive selectDrawingsInBounds command", () => {
    const operation = beginDrawingSelectionBox({
      drawings: [
        drawing("a", 0, 0, 10, 10),
        { ...drawing("passive", 200, 200, 210, 210), interactive: false }
      ],
      startPoint: { x: 100, y: 100 },
      currentSelectedDrawingIds: ["existing", "passive"],
      additive: true
    });

    expect(updateDrawingSelectionBox(operation, { x: 10, y: 10 }).selectedDrawingIds).toEqual([
      "existing",
      "a"
    ]);

    expect(finishDrawingSelectionBox(operation, { x: 10, y: 10 })).toEqual({
      type: "selectDrawingsInBounds",
      bounds: { x: 10, y: 10, width: 90, height: 90 },
      additive: true
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
