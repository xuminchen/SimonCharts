import { describe, expect, it } from "vitest";
import { createRenderScheduler } from "../index";

describe("render scheduler", () => {
  it("coalesces same-frame invalidations and renders passes in order", () => {
    const calls: string[] = [];
    let frameCallback: (() => void) | undefined;
    const scheduler = createRenderScheduler({
      requestFrame(callback) {
        frameCallback = callback;
        return 1;
      },
      now: () => 10,
      renderPass(pass, invalidation) {
        calls.push(`${pass}:${invalidation.layers.join(",")}`);
      }
    });

    scheduler.invalidate({ layers: ["crosshair"], reason: "pointerMoved" });
    scheduler.invalidate({ layers: ["series", "axis"], reason: "viewportChanged", layoutRequired: true });

    expect(calls).toEqual([]);
    frameCallback?.();

    expect(calls).toEqual([
      "static:axis,series,crosshair",
      "overlay:axis,series,crosshair"
    ]);
    expect(scheduler.getState().metrics.totalRenderCount).toBe(2);
    expect(scheduler.getState().metrics.lastInvalidationReasons).toEqual([
      "pointerMoved",
      "viewportChanged"
    ]);
  });

  it("ignores invalidations with no layers", () => {
    let requested = false;
    const scheduler = createRenderScheduler({
      requestFrame(callback) {
        requested = true;
        callback();
        return 1;
      },
      renderPass() {
        throw new Error("render should not run");
      }
    });

    scheduler.invalidate({ layers: [], reason: "empty" });

    expect(requested).toBe(false);
    expect(scheduler.getState().pending).toBe(false);
  });
});
