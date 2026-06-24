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
});
