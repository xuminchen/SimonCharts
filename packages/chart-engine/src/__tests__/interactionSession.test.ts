import { describe, expect, it } from "vitest";
import { createInteractionSession, defaultInteractionSessionState } from "../index";
import type { InteractionSessionEvent, InteractionSessionState } from "../index";

const neutralIdleState: InteractionSessionState = {
  pointer: { mode: "idle" },
  crosshair: { visible: false },
  tooltip: { visible: false },
  cursor: "default",
  magnet: { mode: "off" },
  keyboard: {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  }
};

describe("interaction session contracts", () => {
  it("starts with neutral idle state", () => {
    const session = createInteractionSession();

    expect(session.getState()).toStrictEqual(neutralIdleState);
  });

  it("emits neutral pointer and cursor events", () => {
    const events: InteractionSessionEvent[] = [];
    const session = createInteractionSession({
      onEvent(event) {
        events.push(event);
      }
    });

    session.handleInput({ type: "pointerMove", point: { x: 12, y: 24 } });

    expect(session.getState().pointer).toEqual({
      mode: "hover",
      point: { x: 12, y: 24 }
    });
    expect(session.getState().cursor).toBe("crosshair");
    expect(events.map((event) => event.type)).toEqual(["pointerMoved", "cursorChanged"]);
  });

  it("tracks drag lifecycle with deterministic no-ops", () => {
    const events: InteractionSessionEvent[] = [];
    const session = createInteractionSession({ onEvent: (event) => events.push(event) });

    const before = session.getState();
    session.handleInput({ type: "pointerUp", point: { x: 1, y: 1 } });
    expect(session.getState()).toStrictEqual(before);
    expect(events).toEqual([]);

    session.handleInput({ type: "pointerDown", point: { x: 10, y: 12 } });
    session.handleInput({ type: "pointerDrag", point: { x: 16, y: 20 } });
    session.handleInput({ type: "pointerUp", point: { x: 16, y: 20 } });

    expect(session.getState().pointer).toEqual({ mode: "hover", point: { x: 16, y: 20 } });
    expect(events.map((event) => event.type)).toEqual([
      "pointerDragStarted",
      "cursorChanged",
      "pointerDragged",
      "pointerDragEnded",
      "cursorChanged"
    ]);
  });

  it("tracks crosshair tooltip and magnet state", () => {
    const session = createInteractionSession();

    session.handleInput({
      type: "crosshair",
      crosshair: {
        index: 3,
        time: 100,
        price: 12,
        open: 10,
        high: 14,
        low: 9,
        close: 13,
        volume: 1000,
        turnover: 13000
      }
    });
    session.handleInput({
      type: "tooltip",
      tooltip: {
        visible: true,
        sourceType: "series",
        rows: [{ label: "Close", value: "13" }]
      }
    });
    session.handleInput({
      type: "magnet",
      magnet: {
        mode: "ohlc",
        target: {
          id: "candle-3",
          mode: "ohlc",
          point: { x: 30, y: 40, index: 3, price: 13 },
          distance: 2
        }
      }
    });

    expect(session.getState().crosshair).toStrictEqual({
      visible: true,
      index: 3,
      time: 100,
      price: 12,
      open: 10,
      high: 14,
      low: 9,
      close: 13,
      volume: 1000,
      turnover: 13000
    });
    expect(session.getState().tooltip).toStrictEqual({
      visible: true,
      sourceType: "series",
      rows: [{ label: "Close", value: "13" }]
    });
    expect(session.getState().magnet).toStrictEqual({
      mode: "ohlc",
      target: {
        id: "candle-3",
        mode: "ohlc",
        point: { x: 30, y: 40, index: 3, price: 13 },
        distance: 2
      }
    });
  });

  it("maps keyboard commands to neutral zoom events", () => {
    const events: InteractionSessionEvent[] = [];
    const session = createInteractionSession({ onEvent: (event) => events.push(event) });

    session.handleInput({ type: "keyboardDown", key: "+", shiftKey: true });
    session.handleInput({ type: "keyboardDown", key: "-" });
    session.handleInput({ type: "keyboardDown", key: "0" });
    session.handleInput({ type: "keyboardUp", key: "0" });

    expect(events.filter((event) => event.type === "keyboardCommand")).toEqual([
      { type: "keyboardCommand", command: "zoomIn", key: "+" },
      { type: "keyboardCommand", command: "zoomOut", key: "-" },
      { type: "keyboardCommand", command: "resetZoom", key: "0" }
    ]);
    expect(session.getState().keyboard.lastKey).toBe("0");
  });

  it("keeps event payload mutations isolated from session state", () => {
    const session = createInteractionSession({
      onEvent(event) {
        if (event.type === "crosshairChanged" && event.crosshair.visible) {
          event.crosshair.price = 999;
        }
        if (event.type === "tooltipChanged") {
          event.tooltip.visible = false;
          if (event.tooltip.rows) {
            event.tooltip.rows[0].value = "mutated";
          }
        }
        if (event.type === "magnetTargetChanged") {
          event.magnet.mode = "off";
          if (event.magnet.target) {
            event.magnet.target.point.x = 999;
          }
        }
      }
    });

    session.handleInput({
      type: "crosshair",
      crosshair: {
        index: 1,
        time: 100,
        price: 10,
        open: 8,
        high: 11,
        low: 7,
        close: 9,
        volume: 1000,
        turnover: 9000
      }
    });
    session.handleInput({
      type: "tooltip",
      tooltip: { visible: true, sourceType: "series", rows: [{ label: "Close", value: "9" }] }
    });
    session.handleInput({
      type: "magnet",
      magnet: {
        mode: "ohlc",
        target: { id: "candle", mode: "ohlc", point: { x: 12, y: 24 }, distance: 3 }
      }
    });

    expect(session.getState().crosshair).toStrictEqual({
      visible: true,
      index: 1,
      time: 100,
      price: 10,
      open: 8,
      high: 11,
      low: 7,
      close: 9,
      volume: 1000,
      turnover: 9000
    });
    expect(session.getState().tooltip).toStrictEqual({
      visible: true,
      sourceType: "series",
      rows: [{ label: "Close", value: "9" }]
    });
    expect(session.getState().magnet).toStrictEqual({
      mode: "ohlc",
      target: { id: "candle", mode: "ohlc", point: { x: 12, y: 24 }, distance: 3 }
    });
  });

  it("keeps exported default state from mutating future sessions", () => {
    try {
      defaultInteractionSessionState.pointer.mode = "hover";
      defaultInteractionSessionState.tooltip.visible = true;
      defaultInteractionSessionState.keyboard.shiftKey = true;
    } catch {
      // Frozen module exports throw in strict runtimes.
    }

    expect(createInteractionSession().getState()).toStrictEqual(neutralIdleState);
  });

  it("returns cloned state snapshots", () => {
    const session = createInteractionSession();
    session.handleInput({ type: "pointerMove", point: { x: 10, y: 20 } });
    session.handleInput({
      type: "tooltip",
      tooltip: { visible: true, sourceType: "series", rows: [{ label: "Close", value: "20" }] }
    });
    session.handleInput({
      type: "magnet",
      magnet: {
        mode: "ohlc",
        target: { id: "candle-2", mode: "ohlc", point: { x: 10, y: 20 }, distance: 2 }
      }
    });

    const snapshot = session.getState();
    if (snapshot.pointer.point) {
      snapshot.pointer.point.x = 999;
    }
    if (snapshot.tooltip.rows) {
      snapshot.tooltip.rows[0].value = "mutated";
    }
    if (snapshot.magnet.target) {
      snapshot.magnet.target.point.x = 999;
    }

    expect(session.getState().pointer.point).toEqual({ x: 10, y: 20 });
    expect(session.getState().tooltip.rows).toEqual([{ label: "Close", value: "20" }]);
    expect(session.getState().magnet.target?.point).toEqual({ x: 10, y: 20 });
  });

  it("emits deterministic cleanup events on leave", () => {
    const events: InteractionSessionEvent[] = [];
    const session = createInteractionSession({ onEvent: (event) => events.push(event) });

    session.handleInput({ type: "pointerMove", point: { x: 12, y: 24 } });
    session.handleInput({
      type: "crosshair",
      crosshair: {
        index: 1,
        time: 100,
        price: 10,
        open: 8,
        high: 11,
        low: 7,
        close: 9,
        volume: 1000,
        turnover: 9000
      }
    });
    session.handleInput({
      type: "tooltip",
      tooltip: { visible: true, rows: [{ label: "Close", value: "9" }] }
    });
    session.handleInput({
      type: "magnet",
      magnet: {
        mode: "visualPoint",
        target: { id: "marker", mode: "visualPoint", point: { x: 12, y: 24 }, distance: 2 }
      }
    });
    session.handleInput({ type: "keyboardDown", key: "Shift", shiftKey: true });

    expect(session.getState().keyboard).toStrictEqual({
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      lastKey: "Shift"
    });

    events.length = 0;
    session.handleInput({ type: "leave" });

    expect(session.getState()).toStrictEqual(neutralIdleState);
    expect(events).toStrictEqual([
      { type: "crosshairChanged", crosshair: { visible: false } },
      { type: "tooltipChanged", tooltip: { visible: false } },
      { type: "cursorChanged", cursor: "default" },
      { type: "magnetTargetChanged", magnet: { mode: "off" } }
    ]);
  });

  it("clears transient state on blur", () => {
    const session = createInteractionSession();

    session.handleInput({ type: "pointerMove", point: { x: 1, y: 1 } });
    session.handleInput({
      type: "crosshair",
      crosshair: {
        index: 2,
        time: 200,
        price: 20,
        open: 18,
        high: 22,
        low: 17,
        close: 21,
        volume: 2000,
        turnover: 42000
      }
    });
    session.handleInput({
      type: "tooltip",
      tooltip: { visible: true, sourceType: "drawing", rows: [{ label: "Line", value: "21" }] }
    });
    session.handleInput({
      type: "magnet",
      magnet: {
        mode: "drawingAnchor",
        target: {
          id: "anchor-2",
          mode: "drawingAnchor",
          point: { x: 10, y: 12, index: 2, price: 21 },
          distance: 1
        }
      }
    });
    session.handleInput({ type: "keyboardDown", key: "Meta", metaKey: true });

    expect(session.getState().cursor).toBe("crosshair");
    expect(session.getState().crosshair.visible).toBe(true);
    expect(session.getState().tooltip.visible).toBe(true);
    expect(session.getState().magnet.target?.id).toBe("anchor-2");
    expect(session.getState().keyboard).toStrictEqual({
      altKey: false,
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      lastKey: "Meta"
    });

    session.handleInput({ type: "blur" });

    expect(session.getState()).toStrictEqual(neutralIdleState);
  });
});
