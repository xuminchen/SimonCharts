import { describe, expect, it } from "vitest";
import { createInteractionSession } from "../index";
import type { InteractionSessionEvent } from "../index";

describe("interaction session contracts", () => {
  it("starts with neutral idle state", () => {
    const session = createInteractionSession();

    expect(session.getState()).toEqual({
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
    });
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
});
