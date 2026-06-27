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
    expect(scheduler.getState().metrics.lastFrame).toMatchObject({
      frameId: 1,
      timestamp: 10,
      duration: 0,
      layers: ["axis", "series", "crosshair"],
      reasons: ["pointerMoved", "viewportChanged"],
      layoutRequired: true,
      passes: [
        { pass: "static", duration: 0, layers: ["axis", "series", "crosshair"] },
        { pass: "overlay", duration: 0, layers: ["axis", "series", "crosshair"] }
      ]
    });
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

  it("preserves invalidations scheduled during a render pass for a follow-up frame", () => {
    const calls: string[] = [];
    const frameCallbacks: (() => void)[] = [];
    let frameId = 0;
    let scheduler!: ReturnType<typeof createRenderScheduler>;

    scheduler = createRenderScheduler({
      requestFrame(callback) {
        frameCallbacks.push(callback);
        frameId += 1;
        return frameId;
      },
      renderPass(pass, invalidation) {
        calls.push(`${pass}:${invalidation.layers.join(",")}`);
        if (pass === "static" && invalidation.reason === "initial") {
          scheduler.invalidate({ layers: ["tooltip"], reason: "renderPassInvalidated" });
        }
      }
    });

    scheduler.invalidate({ layers: ["series"], reason: "initial" });

    expect(frameCallbacks).toHaveLength(1);
    frameCallbacks.shift()?.();

    expect(calls).toEqual(["static:series"]);
    expect(scheduler.getState().pending).toBe(true);
    expect(scheduler.getState().dirtyLayers).toEqual(["tooltip"]);

    frameCallbacks.shift()?.();

    expect(calls).toEqual(["static:series", "overlay:tooltip"]);
    expect(scheduler.getState().pending).toBe(false);
    expect(scheduler.getState().dirtyLayers).toEqual([]);
    expect(scheduler.getState().metrics.lastFrame).toMatchObject({
      frameId: 2,
      layers: ["tooltip"],
      reasons: ["renderPassInvalidated"],
      passes: [{ pass: "overlay", layers: ["tooltip"] }]
    });
  });

  it("isolates render diagnostics from caller mutation", () => {
    let frameCallback: (() => void) | undefined;
    const scheduler = createRenderScheduler({
      requestFrame(callback) {
        frameCallback = callback;
        return 1;
      },
      now: () => 20,
      renderPass() {}
    });

    scheduler.invalidate({ layers: ["series"], reason: "initial" });
    frameCallback?.();

    const state = scheduler.getState();
    state.metrics.lastFrame?.layers.push("tooltip");
    state.metrics.lastFrame?.reasons.push("mutated");
    state.metrics.lastFrame?.passes[0]?.layers.push("tooltip");

    expect(scheduler.getState().metrics.lastFrame).toMatchObject({
      layers: ["series"],
      reasons: ["initial"],
      passes: [{ pass: "static", layers: ["series"] }]
    });
  });

  it("does not keep a stale pending frame when requestFrame runs synchronously", () => {
    const calls: string[] = [];
    const scheduler = createRenderScheduler({
      requestFrame(callback) {
        callback();
        return 7;
      },
      renderPass(pass, invalidation) {
        calls.push(`${pass}:${invalidation.reason}`);
      }
    });

    scheduler.invalidate({ layers: ["tooltip"], reason: "tooltipChanged" });

    expect(calls).toEqual(["overlay:tooltipChanged"]);
    expect(scheduler.getState()).toMatchObject({
      pending: false,
      dirtyLayers: [],
      layoutRequired: false
    });
    expect(scheduler.getState().metrics.totalRenderCount).toBe(1);
  });

  it("defers render-pass invalidations when requestFrame runs synchronously", () => {
    const calls: string[] = [];
    let frameId = 0;
    let scheduler!: ReturnType<typeof createRenderScheduler>;

    scheduler = createRenderScheduler({
      requestFrame(callback) {
        callback();
        frameId += 1;
        return frameId;
      },
      renderPass(pass, invalidation) {
        calls.push(`${pass}:${invalidation.reason}:start`);
        if (pass === "static" && invalidation.reason === "initial") {
          scheduler.invalidate({ layers: ["tooltip"], reason: "renderPassInvalidated" });
          calls.push(`${pass}:${invalidation.reason}:after-invalidate`);
        }
      }
    });

    scheduler.invalidate({ layers: ["series", "crosshair"], reason: "initial" });

    expect(calls).toEqual([
      "static:initial:start",
      "static:initial:after-invalidate",
      "overlay:initial:start",
      "overlay:renderPassInvalidated:start"
    ]);
    expect(scheduler.getState().pending).toBe(false);
    expect(scheduler.getState().dirtyLayers).toEqual([]);
  });

  it("stops later passes when destroyed during a render pass", () => {
    const calls: string[] = [];
    let frameCallback: (() => void) | undefined;
    let scheduler!: ReturnType<typeof createRenderScheduler>;

    scheduler = createRenderScheduler({
      requestFrame(callback) {
        frameCallback = callback;
        return 1;
      },
      renderPass(pass) {
        calls.push(pass);
        if (pass === "static") {
          scheduler.destroy();
        }
      }
    });

    scheduler.invalidate({ layers: ["series", "crosshair"], reason: "mixed" });
    frameCallback?.();

    expect(calls).toEqual(["static"]);
    expect(scheduler.getState()).toMatchObject({
      pending: false,
      dirtyLayers: [],
      layoutRequired: false
    });
    expect(scheduler.getState().metrics.renderCountByPass).toMatchObject({
      static: 1,
      dynamic: 0,
      overlay: 0
    });
  });

  it("isolates render pass invalidation payloads from callback mutation", () => {
    const calls: string[] = [];
    let frameCallback: (() => void) | undefined;
    const scheduler = createRenderScheduler({
      requestFrame(callback) {
        frameCallback = callback;
        return 1;
      },
      renderPass(pass, invalidation) {
        calls.push(`${pass}:${invalidation.layers.join(",")}`);
        if (pass === "static") {
          invalidation.layers.push("tooltip");
        }
      }
    });

    scheduler.invalidate({ layers: ["series", "crosshair"], reason: "mixed" });
    frameCallback?.();

    expect(calls).toEqual([
      "static:series,crosshair",
      "overlay:series,crosshair"
    ]);
    expect(scheduler.getState().metrics.dirtyLayerCount).toBe(2);
  });

  it("records slow frame metrics with injected time source", () => {
    let nowValue = 0;
    let frameCallback: (() => void) | undefined;
    const scheduler = createRenderScheduler({
      requestFrame(callback) {
        frameCallback = callback;
        return 1;
      },
      now: () => nowValue,
      slowFrameThresholdMs: 5,
      renderPass() {
        nowValue += 6;
      }
    });

    scheduler.invalidate({ layers: ["tooltip"], reason: "tooltipChanged" });
    frameCallback?.();

    expect(scheduler.getState().metrics.totalRenderCount).toBe(1);
    expect(scheduler.getState().metrics.renderCountByPass.overlay).toBe(1);
    expect(scheduler.getState().metrics.lastRenderDuration).toBe(6);
    expect(scheduler.getState().metrics.slowFrameCount).toBe(1);
  });

  it("cancels pending frame on destroy", () => {
    const canceled: number[] = [];
    let frameCallback: (() => void) | undefined;
    let renderCallCount = 0;
    const scheduler = createRenderScheduler({
      requestFrame(callback) {
        frameCallback = callback;
        return 42;
      },
      cancelFrame(frameId) {
        canceled.push(frameId);
      },
      renderPass() {
        renderCallCount += 1;
      }
    });

    scheduler.invalidate({ layers: ["series"], reason: "viewportChanged", layoutRequired: true });
    scheduler.destroy();

    expect(scheduler.getState().pending).toBe(false);

    frameCallback?.();

    expect(canceled).toEqual([42]);
    expect(scheduler.getState()).toMatchObject({
      pending: false,
      dirtyLayers: [],
      layoutRequired: false
    });
    expect(renderCallCount).toBe(0);
  });
});
