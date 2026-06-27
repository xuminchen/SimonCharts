import { describe, expect, it } from "vitest";
import {
  createDrawingAnchorMagnetTargets,
  defaultDrawingHotkeyBindings,
  findNearestMagnetTarget,
  getDrawingCommandForHotkey,
  getMagnetSnapState,
  mergeDrawingStyle,
  snapPointToMagnetTargets,
  type DrawingObject,
  type MagnetSnapTarget
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

  it("returns snapped point and neutral magnet state for an OHLC target", () => {
    expect(
      getMagnetSnapState({
        point: { x: 10, y: 10 },
        targets: [{ type: "ohlc", x: 11, y: 10, field: "close", dataIndex: 2 }],
        radius: 4
      })
    ).toEqual({
      point: { x: 11, y: 10 },
      target: { type: "ohlc", x: 11, y: 10, field: "close", dataIndex: 2 },
      magnet: {
        mode: "ohlc",
        target: {
          id: "ohlc:2:close",
          mode: "ohlc",
          point: { x: 11, y: 10 },
          distance: 1
        }
      }
    });
  });

  it("returns off magnet state and original point when no target is in radius", () => {
    const point = { x: 10, y: 10 };

    const snap = getMagnetSnapState({
      point,
      targets: [{ type: "visualPoint", x: 40, y: 40, visualId: "v", pointIndex: 0 }],
      radius: 2
    });

    expect(snap).toEqual({
      point: { x: 10, y: 10 },
      magnet: { mode: "off" }
    });
    expect(snap.point).not.toBe(point);
  });

  it("returns drawing anchor and visual point magnet ids and modes", () => {
    expect(
      getMagnetSnapState({
        point: { x: 0, y: 0 },
        targets: [
          { type: "drawingAnchor", x: 1, y: 0, drawingId: "drawing-1", anchorIndex: 0 }
        ],
        radius: 2
      }).magnet
    ).toEqual({
      mode: "drawingAnchor",
      target: {
        id: "drawingAnchor:drawing-1:0",
        mode: "drawingAnchor",
        point: { x: 1, y: 0 },
        distance: 1
      }
    });

    expect(
      getMagnetSnapState({
        point: { x: 0, y: 0 },
        targets: [{ type: "visualPoint", x: 0, y: 1, visualId: "visual-1", pointIndex: 3 }],
        radius: 2
      }).magnet
    ).toEqual({
      mode: "visualPoint",
      target: {
        id: "visualPoint:visual-1:3",
        mode: "visualPoint",
        point: { x: 0, y: 1 },
        distance: 1
      }
    });
  });

  it("keeps snap state results isolated from input objects", () => {
    const point = { x: 10, y: 10 };
    const target: MagnetSnapTarget = {
      type: "drawingAnchor",
      x: 11,
      y: 10,
      drawingId: "drawing-1",
      anchorIndex: 0
    };

    const snap = getMagnetSnapState({ point, targets: [target], radius: 4 });
    expect(snap).toEqual({
      point: { x: 11, y: 10 },
      target: {
        type: "drawingAnchor",
        x: 11,
        y: 10,
        drawingId: "drawing-1",
        anchorIndex: 0
      },
      magnet: {
        mode: "drawingAnchor",
        target: {
          id: "drawingAnchor:drawing-1:0",
          mode: "drawingAnchor",
          point: { x: 11, y: 10 },
          distance: 1
        }
      }
    });

    point.x = 99;
    target.x = 99;

    expect(snap.point).toEqual({ x: 11, y: 10 });
    expect(snap.target).toEqual({
      type: "drawingAnchor",
      x: 11,
      y: 10,
      drawingId: "drawing-1",
      anchorIndex: 0
    });
    expect(snap.magnet.target?.point).toEqual({ x: 11, y: 10 });

    snap.point.x = 88;
    if (snap.target) {
      snap.target.x = 77;
    }
    if (snap.magnet.target) {
      snap.magnet.target.point.x = 66;
    }

    expect(point).toEqual({ x: 99, y: 10 });
    expect(target).toEqual({
      type: "drawingAnchor",
      x: 99,
      y: 10,
      drawingId: "drawing-1",
      anchorIndex: 0
    });
  });

  it("uses existing target priority when snap state targets tie", () => {
    expect(
      getMagnetSnapState({
        point: { x: 10, y: 10 },
        targets: [
          { type: "visualPoint", x: 11, y: 10, visualId: "visual", pointIndex: 0 },
          { type: "drawingAnchor", x: 9, y: 10, drawingId: "drawing", anchorIndex: 1 },
          { type: "ohlc", x: 10, y: 11, field: "high", dataIndex: 3 }
        ],
        radius: 2
      })
    ).toMatchObject({
      point: { x: 10, y: 11 },
      target: { type: "ohlc", x: 10, y: 11, field: "high", dataIndex: 3 },
      magnet: {
        mode: "ohlc",
        target: { id: "ohlc:3:high", mode: "ohlc", point: { x: 10, y: 11 } }
      }
    });
  });
});
