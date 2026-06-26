import { describe, expect, it } from "vitest";
import {
  createDrawingAnchorMagnetTargets,
  defaultDrawingHotkeyBindings,
  findNearestMagnetTarget,
  getDrawingCommandForHotkey,
  mergeDrawingStyle,
  snapPointToMagnetTargets,
  type DrawingObject
} from "../index";

describe("drawing style and hotkeys", () => {
  it("merges style patches without dropping existing fields", () => {
    expect(
      mergeDrawingStyle(
        { color: "#111827", lineWidth: 2, fill: "rgba(0,0,0,0.1)" },
        { lineWidth: 4 }
      )
    ).toEqual({ color: "#111827", lineWidth: 4, fill: "rgba(0,0,0,0.1)" });
  });

  it("maps hotkeys to neutral drawing commands", () => {
    expect(getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, "Backspace")).toEqual({
      type: "deleteSelected"
    });
    expect(getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, "Meta+ArrowUp")).toEqual({
      type: "bringSelectedForward"
    });
    expect(getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, "Escape")).toEqual({
      type: "cancelCreation"
    });
    expect(getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, "Meta+v")).toEqual({
      type: "pasteCopied",
      offset: { dx: 12, dy: 12 }
    });
  });

  it("returns command clones so callers cannot mutate default hotkey bindings", () => {
    const command = getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, "Meta+v");

    expect(command).toEqual({ type: "pasteCopied", offset: { dx: 12, dy: 12 } });

    if (command?.type === "pasteCopied") {
      command.offset.dx = 99;
    }

    expect(getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, "Meta+v")).toEqual({
      type: "pasteCopied",
      offset: { dx: 12, dy: 12 }
    });
  });
});

describe("drawing magnet targets", () => {
  it("selects the nearest magnet target within radius", () => {
    expect(
      findNearestMagnetTarget(
        { x: 10, y: 10 },
        [
          { type: "visualPoint", x: 12, y: 10 },
          { type: "drawingAnchor", x: 11, y: 10, drawingId: "a", anchorIndex: 0 }
        ],
        4
      )
    ).toEqual({ type: "drawingAnchor", x: 11, y: 10, drawingId: "a", anchorIndex: 0 });
  });

  it("misses targets outside the snap radius", () => {
    const point = { x: 10, y: 10 };
    const targets = [{ type: "ohlc" as const, x: 20, y: 20, field: "close" as const }];

    expect(findNearestMagnetTarget(point, targets, 2)).toBeUndefined();
    expect(snapPointToMagnetTargets(point, targets, 2)).toEqual(point);
  });

  it("breaks equal-distance ties by target type", () => {
    const point = { x: 10, y: 10 };

    expect(
      findNearestMagnetTarget(
        point,
        [
          { type: "visualPoint", x: 11, y: 10, visualId: "volume", pointIndex: 0 },
          { type: "drawingAnchor", x: 9, y: 10, drawingId: "trend", anchorIndex: 1 },
          { type: "ohlc", x: 10, y: 11, field: "high", dataIndex: 3 }
        ],
        2
      )
    ).toEqual({ type: "ohlc", x: 10, y: 11, field: "high", dataIndex: 3 });
  });

  it("builds drawing-anchor targets from finite xy anchors", () => {
    const drawings: DrawingObject[] = [
      {
        id: "trend",
        type: "trendLine",
        anchors: [
          { x: 1, y: 2 },
          { time: 1, price: 10 },
          { x: Number.NaN, y: 3 },
          { x: 4, y: 5 }
        ]
      }
    ];

    expect(createDrawingAnchorMagnetTargets(drawings)).toEqual([
      { type: "drawingAnchor", x: 1, y: 2, drawingId: "trend", anchorIndex: 0 },
      { type: "drawingAnchor", x: 4, y: 5, drawingId: "trend", anchorIndex: 3 }
    ]);
  });
});
