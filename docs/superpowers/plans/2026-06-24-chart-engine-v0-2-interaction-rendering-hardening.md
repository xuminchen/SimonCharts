# Chart Engine v0.2 Interaction Rendering Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v0.2 interaction-session and render-scheduler engine primitives, then demonstrate professional interaction and rendering lifecycle behavior in playground.

**Architecture:** Add two host-independent subsystems under `packages/chart-engine`: `interaction/session` for neutral input/state/events and `render/scheduler` for dirty-layer invalidation, render pass ordering, coalescing, and metrics. Keep browser/DOM translation inside `apps/playground`, and expose only neutral types from the package root.

**Tech Stack:** TypeScript, Vitest, Vite playground, Playwright, existing canvas renderer and engine boundary guard.

---

## Scope Check

The spec covers interaction hardening and render lifecycle hardening. These are related subsystems because interaction events drive render invalidation and playground acceptance needs both. This plan keeps them in one implementation sequence, but each task remains independently testable and commits frequently.

## File Structure

- `packages/chart-engine/src/interaction/sessionTypes.ts`  
  Defines neutral interaction input, state, events, cursor, tooltip, magnet, and keyboard contracts.

- `packages/chart-engine/src/interaction/interactionSession.ts`  
  Implements a DOM-free session reducer with event emission and immutable state snapshots.

- `packages/chart-engine/src/render/scheduler/renderSchedulerTypes.ts`  
  Defines render layer ids, render passes, invalidation input, scheduler state, metrics, and host-supplied frame scheduling callbacks.

- `packages/chart-engine/src/render/scheduler/renderScheduler.ts`  
  Implements invalidation merging, pass ordering, frame coalescing, metrics, and deterministic no-op handling.

- `packages/chart-engine/src/engine/chartState.ts` and `packages/chart-engine/src/engine/chartEngine.ts`  
  Adds optional interaction/render state snapshots to the facade without exposing DOM or host objects.

- `apps/playground/src/main.ts` and `apps/playground/src/styles.css`  
  Translates browser input to neutral interaction inputs, routes invalidations through the scheduler, and shows compact diagnostics.

- `apps/playground/tests/interaction-rendering-hardening.spec.ts`  
  Verifies keyboard commands, render metrics, and high-frequency pointer behavior in the browser.

- `docs/engine/public-api.md`, `docs/engine/testing-strategy.md`, and new `docs/engine/interaction-rendering-lifecycle.md`  
  Documents v0.2 public contracts and verification flow.

## Task 1: Add Interaction Session Contracts

**Files:**

- Create: `packages/chart-engine/src/interaction/sessionTypes.ts`
- Test: `packages/chart-engine/src/__tests__/interactionSession.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [x] **Step 1: Write failing contract tests**

Create `packages/chart-engine/src/__tests__/interactionSession.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/interactionSession.test.ts
```

Expected: FAIL because `createInteractionSession` is not exported.

- [x] **Step 3: Add session type contracts**

Create `packages/chart-engine/src/interaction/sessionTypes.ts`:

```ts
import type { ChartCrosshairState } from "../model/runtime";

export interface InteractionPoint {
  x: number;
  y: number;
  time?: number;
  price?: number;
  index?: number;
}

export type PointerMode = "idle" | "hover" | "dragPan" | "drawing" | "resize" | "canceled";
export type CursorMode = "default" | "crosshair" | "grab" | "grabbing" | "drawing" | "resize";
export type MagnetMode = "off" | "ohlc" | "drawingAnchor" | "visualPoint";
export type TooltipSourceType = "series" | "visual" | "drawing";

export interface PointerSessionState {
  mode: PointerMode;
  point?: InteractionPoint;
  startPoint?: InteractionPoint;
}

export interface TooltipSessionState {
  visible: boolean;
  sourceType?: TooltipSourceType;
  rows?: { label: string; value: string }[];
}

export interface MagnetTarget {
  id: string;
  mode: Exclude<MagnetMode, "off">;
  point: InteractionPoint;
  distance: number;
}

export interface MagnetSessionState {
  mode: MagnetMode;
  target?: MagnetTarget;
}

export interface KeyboardSessionState {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  lastKey?: string;
}

export interface InteractionSessionState {
  pointer: PointerSessionState;
  crosshair: { visible: false } | ({ visible: true } & ChartCrosshairState);
  tooltip: TooltipSessionState;
  cursor: CursorMode;
  magnet: MagnetSessionState;
  keyboard: KeyboardSessionState;
}

export type InteractionInput =
  | { type: "pointerMove"; point: InteractionPoint }
  | { type: "pointerDown"; point: InteractionPoint; mode?: PointerMode }
  | { type: "pointerDrag"; point: InteractionPoint }
  | { type: "pointerUp"; point: InteractionPoint }
  | { type: "pointerCancel" }
  | { type: "wheel"; point: InteractionPoint; deltaY: number }
  | { type: "keyboardDown"; key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }
  | { type: "keyboardUp"; key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }
  | { type: "crosshair"; crosshair: ChartCrosshairState | undefined }
  | { type: "tooltip"; tooltip: TooltipSessionState }
  | { type: "magnet"; magnet: MagnetSessionState }
  | { type: "leave" }
  | { type: "blur" };

export type InteractionSessionEvent =
  | { type: "pointerMoved"; point: InteractionPoint }
  | { type: "pointerDragStarted"; point: InteractionPoint }
  | { type: "pointerDragged"; point: InteractionPoint; startPoint: InteractionPoint }
  | { type: "pointerDragEnded"; point: InteractionPoint }
  | { type: "wheelZoomed"; point: InteractionPoint; deltaY: number }
  | { type: "crosshairChanged"; crosshair: InteractionSessionState["crosshair"] }
  | { type: "tooltipChanged"; tooltip: TooltipSessionState }
  | { type: "cursorChanged"; cursor: CursorMode }
  | { type: "magnetTargetChanged"; magnet: MagnetSessionState }
  | { type: "keyboardCommand"; command: "zoomIn" | "zoomOut" | "resetZoom"; key: string };

export interface InteractionSessionOptions {
  onEvent?: (event: InteractionSessionEvent) => void;
}

export interface InteractionSession {
  handleInput(input: InteractionInput): void;
  getState(): InteractionSessionState;
  destroy(): void;
}

export const defaultInteractionSessionState: InteractionSessionState = {
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
```

- [x] **Step 4: Add minimal session implementation**

Create `packages/chart-engine/src/interaction/interactionSession.ts`:

```ts
import {
  defaultInteractionSessionState,
  type CursorMode,
  type InteractionInput,
  type InteractionPoint,
  type InteractionSession,
  type InteractionSessionEvent,
  type InteractionSessionOptions,
  type InteractionSessionState,
  type KeyboardSessionState
} from "./sessionTypes";

export function createInteractionSession(
  options: InteractionSessionOptions = {}
): InteractionSession {
  let state = cloneState(defaultInteractionSessionState);
  let active = true;

  function emit(event: InteractionSessionEvent): void {
    if (active) {
      options.onEvent?.(event);
    }
  }

  function setCursor(cursor: CursorMode): void {
    if (state.cursor === cursor) {
      return;
    }

    state = { ...state, cursor };
    emit({ type: "cursorChanged", cursor });
  }

  return {
    handleInput(input) {
      if (!active) {
        return;
      }

      if (input.type === "pointerMove") {
        state = { ...state, pointer: { mode: "hover", point: clonePoint(input.point) } };
        emit({ type: "pointerMoved", point: clonePoint(input.point) });
        setCursor("crosshair");
        return;
      }

      if (input.type === "pointerDown") {
        const mode = input.mode ?? "dragPan";
        state = {
          ...state,
          pointer: {
            mode,
            point: clonePoint(input.point),
            startPoint: clonePoint(input.point)
          }
        };
        emit({ type: "pointerDragStarted", point: clonePoint(input.point) });
        setCursor(mode === "dragPan" ? "grabbing" : mode === "drawing" ? "drawing" : "resize");
        return;
      }

      if (input.type === "pointerDrag") {
        const startPoint = state.pointer.startPoint;
        if (!startPoint) {
          return;
        }
        state = { ...state, pointer: { ...state.pointer, point: clonePoint(input.point) } };
        emit({
          type: "pointerDragged",
          point: clonePoint(input.point),
          startPoint: clonePoint(startPoint)
        });
        return;
      }

      if (input.type === "pointerUp") {
        if (!state.pointer.startPoint) {
          return;
        }
        state = { ...state, pointer: { mode: "hover", point: clonePoint(input.point) } };
        emit({ type: "pointerDragEnded", point: clonePoint(input.point) });
        setCursor("crosshair");
        return;
      }

      if (input.type === "pointerCancel") {
        state = { ...state, pointer: { mode: "canceled" } };
        setCursor("default");
        return;
      }

      if (input.type === "wheel") {
        if (input.deltaY === 0) {
          return;
        }
        emit({ type: "wheelZoomed", point: clonePoint(input.point), deltaY: input.deltaY });
        return;
      }

      if (input.type === "keyboardDown" || input.type === "keyboardUp") {
        state = { ...state, keyboard: toKeyboardState(input) };
        const command = toKeyboardCommand(input.type, input.key);
        if (command) {
          emit({ type: "keyboardCommand", command, key: input.key });
        }
        return;
      }

      if (input.type === "crosshair") {
        const crosshair = input.crosshair ? { visible: true as const, ...input.crosshair } : { visible: false as const };
        state = { ...state, crosshair };
        emit({ type: "crosshairChanged", crosshair });
        return;
      }

      if (input.type === "tooltip") {
        state = { ...state, tooltip: { ...input.tooltip, rows: input.tooltip.rows?.map((row) => ({ ...row })) } };
        emit({ type: "tooltipChanged", tooltip: state.tooltip });
        return;
      }

      if (input.type === "magnet") {
        state = { ...state, magnet: input.magnet.target ? { ...input.magnet, target: { ...input.magnet.target, point: clonePoint(input.magnet.target.point) } } : { mode: input.magnet.mode } };
        emit({ type: "magnetTargetChanged", magnet: state.magnet });
        return;
      }

      if (input.type === "leave" || input.type === "blur") {
        state = {
          ...state,
          pointer: { mode: "idle" },
          crosshair: { visible: false },
          tooltip: { visible: false },
          cursor: "default",
          magnet: { mode: "off" }
        };
      }
    },
    getState() {
      return cloneState(state);
    },
    destroy() {
      active = false;
    }
  };
}

function toKeyboardState(input: Extract<InteractionInput, { type: "keyboardDown" | "keyboardUp" }>): KeyboardSessionState {
  return {
    altKey: input.altKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    metaKey: input.metaKey ?? false,
    shiftKey: input.shiftKey ?? false,
    lastKey: input.key
  };
}

function toKeyboardCommand(
  type: "keyboardDown" | "keyboardUp",
  key: string
): "zoomIn" | "zoomOut" | "resetZoom" | undefined {
  if (type !== "keyboardDown") {
    return undefined;
  }
  if (key === "+" || key === "=") return "zoomIn";
  if (key === "-") return "zoomOut";
  if (key === "0") return "resetZoom";
  return undefined;
}

function cloneState(state: InteractionSessionState): InteractionSessionState {
  return {
    pointer: {
      ...state.pointer,
      point: state.pointer.point ? clonePoint(state.pointer.point) : undefined,
      startPoint: state.pointer.startPoint ? clonePoint(state.pointer.startPoint) : undefined
    },
    crosshair: { ...state.crosshair },
    tooltip: {
      ...state.tooltip,
      rows: state.tooltip.rows?.map((row) => ({ ...row }))
    },
    cursor: state.cursor,
    magnet: state.magnet.target
      ? { ...state.magnet, target: { ...state.magnet.target, point: clonePoint(state.magnet.target.point) } }
      : { mode: state.magnet.mode },
    keyboard: { ...state.keyboard }
  };
}

function clonePoint(point: InteractionPoint): InteractionPoint {
  return { ...point };
}
```

- [x] **Step 5: Export session API**

Modify `packages/chart-engine/src/index.ts`:

```ts
export * from "./interaction/interactionSession";
export * from "./interaction/sessionTypes";
```

- [x] **Step 6: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/interactionSession.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add packages/chart-engine/src/interaction/sessionTypes.ts packages/chart-engine/src/interaction/interactionSession.ts packages/chart-engine/src/__tests__/interactionSession.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add neutral interaction session"
```

## Task 2: Complete Interaction Session State Coverage

**Files:**

- Modify: `packages/chart-engine/src/__tests__/interactionSession.test.ts`
- Modify: `packages/chart-engine/src/interaction/interactionSession.ts`

- [x] **Step 1: Add state transition tests**

Append to `packages/chart-engine/src/__tests__/interactionSession.test.ts`:

```ts
it("tracks drag lifecycle with deterministic no-ops", () => {
  const events: InteractionSessionEvent[] = [];
  const session = createInteractionSession({ onEvent: (event) => events.push(event) });

  session.handleInput({ type: "pointerUp", point: { x: 1, y: 1 } });
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

  expect(session.getState().crosshair.visible).toBe(true);
  expect(session.getState().tooltip.rows).toEqual([{ label: "Close", value: "13" }]);
  expect(session.getState().magnet.target?.id).toBe("candle-3");
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

it("clears transient state on leave and blur", () => {
  const session = createInteractionSession();

  session.handleInput({ type: "pointerMove", point: { x: 20, y: 24 } });
  session.handleInput({ type: "tooltip", tooltip: { visible: true, sourceType: "drawing" } });
  session.handleInput({ type: "leave" });

  expect(session.getState().pointer.mode).toBe("idle");
  expect(session.getState().tooltip.visible).toBe(false);
  expect(session.getState().cursor).toBe("default");

  session.handleInput({ type: "pointerMove", point: { x: 1, y: 1 } });
  session.handleInput({ type: "blur" });
  expect(session.getState().pointer.mode).toBe("idle");
});
```

- [x] **Step 2: Run focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/interactionSession.test.ts
```

Expected: PASS. If event ordering differs, fix implementation to match deterministic event ordering in the test.

- [x] **Step 3: Verify immutability**

Append to `interactionSession.test.ts`:

```ts
it("returns cloned state snapshots", () => {
  const session = createInteractionSession();
  session.handleInput({ type: "pointerMove", point: { x: 10, y: 20 } });

  const snapshot = session.getState();
  if (snapshot.pointer.point) {
    snapshot.pointer.point.x = 999;
  }

  expect(session.getState().pointer.point).toEqual({ x: 10, y: 20 });
});
```

- [x] **Step 4: Run verification**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/interactionSession.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add packages/chart-engine/src/__tests__/interactionSession.test.ts packages/chart-engine/src/interaction/interactionSession.ts
git commit -m "test: cover interaction session lifecycle"
```

## Task 3: Add Render Scheduler Contracts and Coalescing

**Files:**

- Create: `packages/chart-engine/src/render/scheduler/renderSchedulerTypes.ts`
- Create: `packages/chart-engine/src/render/scheduler/renderScheduler.ts`
- Test: `packages/chart-engine/src/__tests__/renderScheduler.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [x] **Step 1: Write failing scheduler tests**

Create `packages/chart-engine/src/__tests__/renderScheduler.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts
```

Expected: FAIL because `createRenderScheduler` is not exported.

- [x] **Step 3: Add scheduler type contracts**

Create `packages/chart-engine/src/render/scheduler/renderSchedulerTypes.ts`:

```ts
export type RenderLayerId =
  | "grid"
  | "axis"
  | "series"
  | "volume"
  | "indicators"
  | "visuals"
  | "drawings"
  | "crosshair"
  | "tooltip";

export type RenderPass = "static" | "dynamic" | "overlay";

export interface RenderInvalidation {
  layers: RenderLayerId[];
  reason: string;
  layoutRequired?: boolean;
  timestamp?: number;
}

export interface RenderMetrics {
  totalRenderCount: number;
  renderCountByPass: Record<RenderPass, number>;
  lastRenderDuration: number;
  dirtyLayerCount: number;
  lastInvalidationReasons: string[];
  slowFrameCount: number;
}

export interface RenderSchedulerState {
  pending: boolean;
  dirtyLayers: RenderLayerId[];
  layoutRequired: boolean;
  metrics: RenderMetrics;
}

export interface CreateRenderSchedulerOptions {
  requestFrame: (callback: () => void) => number;
  cancelFrame?: (frameId: number) => void;
  now?: () => number;
  slowFrameThresholdMs?: number;
  renderPass: (pass: RenderPass, invalidation: RenderInvalidation) => void;
}

export interface RenderScheduler {
  invalidate(invalidation: RenderInvalidation): void;
  flush(): void;
  getState(): RenderSchedulerState;
  destroy(): void;
}

export const defaultRenderPassOrder: RenderPass[] = ["static", "dynamic", "overlay"];

export const renderLayerPasses: Record<RenderLayerId, RenderPass[]> = {
  grid: ["static"],
  axis: ["static"],
  series: ["static"],
  volume: ["static"],
  indicators: ["static"],
  visuals: ["static"],
  drawings: ["static", "dynamic"],
  crosshair: ["overlay"],
  tooltip: ["overlay"]
};
```

- [x] **Step 4: Implement scheduler**

Create `packages/chart-engine/src/render/scheduler/renderScheduler.ts`:

```ts
import {
  defaultRenderPassOrder,
  renderLayerPasses,
  type CreateRenderSchedulerOptions,
  type RenderInvalidation,
  type RenderLayerId,
  type RenderMetrics,
  type RenderPass,
  type RenderScheduler,
  type RenderSchedulerState
} from "./renderSchedulerTypes";

const defaultMetrics: RenderMetrics = {
  totalRenderCount: 0,
  renderCountByPass: { static: 0, dynamic: 0, overlay: 0 },
  lastRenderDuration: 0,
  dirtyLayerCount: 0,
  lastInvalidationReasons: [],
  slowFrameCount: 0
};

export function createRenderScheduler(options: CreateRenderSchedulerOptions): RenderScheduler {
  const now = options.now ?? (() => performance.now());
  const slowFrameThresholdMs = options.slowFrameThresholdMs ?? 16.7;
  const dirtyLayers = new Set<RenderLayerId>();
  const reasons: string[] = [];
  let layoutRequired = false;
  let frameId: number | undefined;
  let destroyed = false;
  let metrics: RenderMetrics = cloneMetrics(defaultMetrics);

  function schedule(): void {
    if (frameId !== undefined || destroyed) {
      return;
    }

    frameId = options.requestFrame(() => {
      frameId = undefined;
      flush();
    });
  }

  function flush(): void {
    if (destroyed || dirtyLayers.size === 0) {
      return;
    }

    const layers = sortLayers([...dirtyLayers]);
    const invalidation: RenderInvalidation = {
      layers,
      reason: reasons[reasons.length - 1] ?? "unspecified",
      layoutRequired,
      timestamp: now()
    };
    const passes = getPassesForLayers(layers);
    const startedAt = now();

    for (const pass of passes) {
      options.renderPass(pass, invalidation);
      metrics = {
        ...metrics,
        totalRenderCount: metrics.totalRenderCount + 1,
        renderCountByPass: {
          ...metrics.renderCountByPass,
          [pass]: metrics.renderCountByPass[pass] + 1
        }
      };
    }

    const duration = Math.max(0, now() - startedAt);
    metrics = {
      ...metrics,
      lastRenderDuration: duration,
      dirtyLayerCount: layers.length,
      lastInvalidationReasons: [...reasons],
      slowFrameCount: duration > slowFrameThresholdMs ? metrics.slowFrameCount + 1 : metrics.slowFrameCount
    };

    dirtyLayers.clear();
    reasons.length = 0;
    layoutRequired = false;
  }

  return {
    invalidate(invalidation) {
      if (destroyed || invalidation.layers.length === 0) {
        return;
      }

      for (const layer of invalidation.layers) {
        dirtyLayers.add(layer);
      }
      reasons.push(invalidation.reason);
      layoutRequired = layoutRequired || invalidation.layoutRequired === true;
      schedule();
    },
    flush,
    getState(): RenderSchedulerState {
      return {
        pending: frameId !== undefined,
        dirtyLayers: sortLayers([...dirtyLayers]),
        layoutRequired,
        metrics: cloneMetrics(metrics)
      };
    },
    destroy() {
      destroyed = true;
      if (frameId !== undefined) {
        options.cancelFrame?.(frameId);
        frameId = undefined;
      }
      dirtyLayers.clear();
      reasons.length = 0;
    }
  };
}

function getPassesForLayers(layers: RenderLayerId[]): RenderPass[] {
  const passes = new Set<RenderPass>();
  for (const layer of layers) {
    for (const pass of renderLayerPasses[layer]) {
      passes.add(pass);
    }
  }
  return defaultRenderPassOrder.filter((pass) => passes.has(pass));
}

function sortLayers(layers: RenderLayerId[]): RenderLayerId[] {
  const order: RenderLayerId[] = [
    "grid",
    "axis",
    "series",
    "volume",
    "indicators",
    "visuals",
    "drawings",
    "crosshair",
    "tooltip"
  ];

  return [...layers].sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

function cloneMetrics(metrics: RenderMetrics): RenderMetrics {
  return {
    totalRenderCount: metrics.totalRenderCount,
    renderCountByPass: { ...metrics.renderCountByPass },
    lastRenderDuration: metrics.lastRenderDuration,
    dirtyLayerCount: metrics.dirtyLayerCount,
    lastInvalidationReasons: [...metrics.lastInvalidationReasons],
    slowFrameCount: metrics.slowFrameCount
  };
}
```

- [x] **Step 5: Export scheduler API**

Modify `packages/chart-engine/src/index.ts`:

```ts
export * from "./render/scheduler/renderScheduler";
export * from "./render/scheduler/renderSchedulerTypes";
```

- [x] **Step 6: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add packages/chart-engine/src/render/scheduler packages/chart-engine/src/__tests__/renderScheduler.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add render scheduler"
```

## Task 4: Add Render Metrics and Destroy Coverage

**Files:**

- Modify: `packages/chart-engine/src/__tests__/renderScheduler.test.ts`
- Modify: `packages/chart-engine/src/render/scheduler/renderScheduler.ts`

- [x] **Step 1: Add metrics tests**

Append to `packages/chart-engine/src/__tests__/renderScheduler.test.ts`:

```ts
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
  const scheduler = createRenderScheduler({
    requestFrame() {
      return 42;
    },
    cancelFrame(frameId) {
      canceled.push(frameId);
    },
    renderPass() {
      throw new Error("destroyed scheduler should not render");
    }
  });

  scheduler.invalidate({ layers: ["series"], reason: "viewportChanged" });
  scheduler.destroy();
  scheduler.flush();

  expect(canceled).toEqual([42]);
  expect(scheduler.getState().pending).toBe(false);
});
```

- [x] **Step 2: Run focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts
```

Expected: PASS. If `pending` stays true after destroy, update `destroy()` to clear `frameId`.

- [x] **Step 3: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [x] **Step 4: Commit**

```bash
git add packages/chart-engine/src/__tests__/renderScheduler.test.ts packages/chart-engine/src/render/scheduler/renderScheduler.ts
git commit -m "test: cover render scheduler metrics"
```

## Task 5: Expose Interaction and Render State Through ChartEngine

**Files:**

- Modify: `packages/chart-engine/src/engine/chartState.ts`
- Modify: `packages/chart-engine/src/engine/events.ts`
- Modify: `packages/chart-engine/src/engine/chartEngine.ts`
- Test: `packages/chart-engine/src/__tests__/chartEngine.test.ts`

- [x] **Step 1: Add facade tests**

Append to `packages/chart-engine/src/__tests__/chartEngine.test.ts`:

```ts
it("stores neutral interaction and render snapshots", () => {
  const engine = createChartEngine({ series: fixtureDailyCandleSeries });

  engine.setInteractionState({
    pointer: { mode: "hover", point: { x: 10, y: 20 } },
    crosshair: { visible: false },
    tooltip: { visible: false },
    cursor: "crosshair",
    magnet: { mode: "off" },
    keyboard: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }
  });
  engine.setRenderState({
    pending: false,
    dirtyLayers: ["crosshair"],
    layoutRequired: false,
    metrics: {
      totalRenderCount: 2,
      renderCountByPass: { static: 1, dynamic: 0, overlay: 1 },
      lastRenderDuration: 3,
      dirtyLayerCount: 1,
      lastInvalidationReasons: ["pointerMoved"],
      slowFrameCount: 0
    }
  });

  expect(engine.getState().interaction?.cursor).toBe("crosshair");
  expect(engine.getState().render?.metrics.totalRenderCount).toBe(2);
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartEngine.test.ts
```

Expected: FAIL because `setInteractionState` and `setRenderState` are missing.

- [x] **Step 3: Extend state and event contracts**

Modify `packages/chart-engine/src/engine/chartState.ts`:

```ts
import type { InteractionSessionState } from "../interaction/sessionTypes";
import type { RenderSchedulerState } from "../render/scheduler/renderSchedulerTypes";
```

Add fields to `ChartEngineState`:

```ts
  interaction?: InteractionSessionState;
  render?: RenderSchedulerState;
```

Modify `packages/chart-engine/src/engine/events.ts` by adding to `ChartEngineEvent`:

```ts
  | { type: "interactionStateChanged"; interaction: InteractionSessionState }
  | { type: "renderStateChanged"; render: RenderSchedulerState };
```

Also add imports:

```ts
import type { InteractionSessionState } from "../interaction/sessionTypes";
import type { RenderSchedulerState } from "../render/scheduler/renderSchedulerTypes";
```

- [x] **Step 4: Extend facade methods**

Modify `ChartEngine` in `packages/chart-engine/src/engine/chartEngine.ts`:

```ts
import type { InteractionSessionState } from "../interaction/sessionTypes";
import type { RenderSchedulerState } from "../render/scheduler/renderSchedulerTypes";
```

Add methods to `ChartEngine`:

```ts
  setInteractionState(interaction: InteractionSessionState): void;
  setRenderState(render: RenderSchedulerState): void;
```

Add methods to the returned object:

```ts
    setInteractionState(interaction) {
      updateState({ ...state, interaction });
      emit({ type: "interactionStateChanged", interaction });
    },
    setRenderState(render) {
      updateState({ ...state, render });
      emit({ type: "renderStateChanged", render });
    },
```

Update `getState()` so it returns shallow clones:

```ts
        interaction: state.interaction ? { ...state.interaction } : undefined,
        render: state.render
          ? {
              ...state.render,
              dirtyLayers: [...state.render.dirtyLayers],
              metrics: {
                ...state.render.metrics,
                renderCountByPass: { ...state.render.metrics.renderCountByPass },
                lastInvalidationReasons: [...state.render.metrics.lastInvalidationReasons]
              }
            }
          : undefined
```

- [x] **Step 5: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartEngine.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add packages/chart-engine/src/engine packages/chart-engine/src/__tests__/chartEngine.test.ts
git commit -m "feat: expose interaction render state in engine facade"
```

## Task 6: Integrate Scheduler and Session Diagnostics in Playground

**Files:**

- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Test: `apps/playground/tests/interaction-rendering-hardening.spec.ts`

- [x] **Step 1: Write failing playground E2E**

Create `apps/playground/tests/interaction-rendering-hardening.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("pointer movement updates overlay diagnostics without static redraw spam", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  const staticBefore = Number(await page.getByTestId("static-render-count").textContent());

  for (let index = 0; index < 8; index += 1) {
    await page.mouse.move(box.x + 100 + index * 3, box.y + 180);
  }

  await expect(page.getByTestId("cursor-state")).toHaveText("crosshair");
  await expect(page.getByTestId("last-invalidation-reason")).toHaveText(/pointerMoved|crosshairChanged/);
  const staticAfter = Number(await page.getByTestId("static-render-count").textContent());
  const overlayAfter = Number(await page.getByTestId("overlay-render-count").textContent());

  expect(staticAfter - staticBefore).toBeLessThanOrEqual(1);
  expect(overlayAfter).toBeGreaterThan(0);
});

test("keyboard zoom commands use neutral interaction events", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("+");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("zoomIn");

  await page.keyboard.press("-");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("zoomOut");

  await page.keyboard.press("0");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("resetZoom");
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/interaction-rendering-hardening.spec.ts
```

Expected: FAIL because diagnostics are not present.

- [x] **Step 3: Add imports and diagnostics elements**

Modify imports in `apps/playground/src/main.ts`:

```ts
  createInteractionSession,
  createRenderScheduler,
```

Add type imports:

```ts
  InteractionSessionEvent,
  RenderInvalidation,
  RenderPass,
```

Create diagnostics elements near existing status elements:

```ts
const cursorState = document.createElement("span");
const magnetState = document.createElement("span");
const lastKeyboardCommand = document.createElement("span");
const totalRenderCount = document.createElement("span");
const staticRenderCount = document.createElement("span");
const overlayRenderCount = document.createElement("span");
const lastInvalidationReason = document.createElement("span");
```

Set class names and test ids:

```ts
for (const element of [
  cursorState,
  magnetState,
  lastKeyboardCommand,
  totalRenderCount,
  staticRenderCount,
  overlayRenderCount,
  lastInvalidationReason
]) {
  element.className = "status-item diagnostics-item";
}

cursorState.dataset.testid = "cursor-state";
magnetState.dataset.testid = "magnet-state";
lastKeyboardCommand.dataset.testid = "last-keyboard-command";
totalRenderCount.dataset.testid = "total-render-count";
staticRenderCount.dataset.testid = "static-render-count";
overlayRenderCount.dataset.testid = "overlay-render-count";
lastInvalidationReason.dataset.testid = "last-invalidation-reason";
```

Append these elements to `topControls` after `visualOutputCount`.

- [x] **Step 4: Add interaction session and scheduler wiring**

Add after `chartEngine` creation:

```ts
let lastKeyboardCommandText = "none";

const interactionSession = createInteractionSession({
  onEvent(event) {
    handleInteractionSessionEvent(event);
  }
});

const renderScheduler = createRenderScheduler({
  requestFrame(callback) {
    return window.requestAnimationFrame(callback);
  },
  cancelFrame(frameId) {
    window.cancelAnimationFrame(frameId);
  },
  renderPass(pass, invalidation) {
    if (pass === "static") {
      renderStatic();
    }
    if (pass === "overlay") {
      renderOverlayCanvas();
    }
    if (pass === "dynamic") {
      renderStatic();
    }
    syncRenderDiagnostics(invalidation);
  }
});

function invalidateRender(invalidation: RenderInvalidation): void {
  renderScheduler.invalidate(invalidation);
  chartEngine.setRenderState(renderScheduler.getState());
}

function handleInteractionSessionEvent(event: InteractionSessionEvent): void {
  if (event.type === "keyboardCommand") {
    lastKeyboardCommandText = event.command;
    chartEngine.dispatch({ type: event.command });
    invalidateRender({ layers: ["series", "axis", "crosshair"], reason: "keyboardCommand", layoutRequired: true });
  }

  if (event.type === "pointerMoved" || event.type === "crosshairChanged" || event.type === "tooltipChanged" || event.type === "cursorChanged") {
    invalidateRender({ layers: ["crosshair", "tooltip"], reason: event.type });
  }

  chartEngine.setInteractionState(interactionSession.getState());
  syncInteractionDiagnostics();
}
```

- [x] **Step 5: Route existing render calls through invalidation for high-frequency events**

In `handleInteractionEvent(event)`, replace direct render calls:

```ts
    invalidateRender({ layers: ["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair"], reason: "viewportChanged", layoutRequired: true });
```

For crosshair movement:

```ts
  interactionSession.handleInput({ type: "crosshair", crosshair });
  invalidateRender({ layers: ["crosshair", "tooltip"], reason: "crosshairChanged" });
```

In `overlayCanvas` pointer move handler, before existing drawing and interaction logic:

```ts
  const point = getCanvasPoint(event);
  interactionSession.handleInput({ type: "pointerMove", point });
```

In wheel handler:

```ts
    interactionSession.handleInput({
      type: "wheel",
      point: { x: getWheelPoint(event).x },
      deltaY: event.deltaY
    });
```

Keep `requestAnimationFrame(render);` for initial render only.

- [x] **Step 6: Add diagnostics sync helpers**

Add helpers in `apps/playground/src/main.ts`:

```ts
function syncInteractionDiagnostics(): void {
  const state = interactionSession.getState();
  cursorState.textContent = state.cursor;
  magnetState.textContent = state.magnet.mode;
  lastKeyboardCommand.textContent = lastKeyboardCommandText;
}

function syncRenderDiagnostics(invalidation?: RenderInvalidation): void {
  const metrics = renderScheduler.getState().metrics;
  totalRenderCount.textContent = String(metrics.totalRenderCount);
  staticRenderCount.textContent = String(metrics.renderCountByPass.static);
  overlayRenderCount.textContent = String(metrics.renderCountByPass.overlay);
  lastInvalidationReason.textContent =
    invalidation?.reason ?? metrics.lastInvalidationReasons.at(-1) ?? "none";
}
```

Call once before initial render:

```ts
syncInteractionDiagnostics();
syncRenderDiagnostics();
```

- [x] **Step 7: Add compact diagnostics styling**

Append to `apps/playground/src/styles.css`:

```css
.diagnostics-item {
  font-variant-numeric: tabular-nums;
}
```

- [x] **Step 8: Verify focused E2E and typecheck**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/interaction-rendering-hardening.spec.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [x] **Step 9: Commit**

```bash
git add apps/playground/src/main.ts apps/playground/src/styles.css apps/playground/tests/interaction-rendering-hardening.spec.ts
git commit -m "feat: demonstrate interaction render lifecycle"
```

## Task 7: Stabilize Playground Render Scheduling

**Files:**

- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/interaction-rendering-hardening.spec.ts`
- Run existing E2E suites.

- [x] **Step 1: Add wheel invalidation E2E**

Append to `apps/playground/tests/interaction-rendering-hardening.spec.ts`:

```ts
test("wheel zoom invalidates chart layers and records render reason", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.mouse.move(box.x + 180, box.y + 220);
  await page.mouse.wheel(0, -180);

  await expect(page.getByTestId("last-invalidation-reason")).toHaveText(/viewportChanged|wheelZoomed|keyboardCommand/);
  expect(Number(await page.getByTestId("static-render-count").textContent())).toBeGreaterThan(0);
});
```

- [x] **Step 2: Run focused E2E**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/interaction-rendering-hardening.spec.ts
```

Expected: PASS. If it fails because the last reason is unstable, update `handleInteractionSessionEvent` and `handleInteractionEvent` to prefer `viewportChanged` for wheel-driven viewport changes.

- [x] **Step 3: Run regression E2E suites**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/interaction.spec.ts apps/playground/tests/static-chart.spec.ts apps/playground/tests/visual-panels.spec.ts
```

Expected: all pass. If reset behavior fails, ensure `resetButton` invalidates `["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"]` with reason `resetView`.

- [x] **Step 4: Verify**

Run:

```bash
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add apps/playground/src/main.ts apps/playground/tests/interaction-rendering-hardening.spec.ts
git commit -m "fix: stabilize playground render scheduling"
```

## Task 8: Document v0.2 Interaction and Rendering Lifecycle

**Files:**

- Create: `docs/engine/interaction-rendering-lifecycle.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`

- [x] **Step 1: Create lifecycle documentation**

Create `docs/engine/interaction-rendering-lifecycle.md`:

```md
# Interaction And Rendering Lifecycle

SimonCharts v0.2 adds two neutral engine subsystems: `InteractionSession` and `RenderScheduler`.

`InteractionSession` accepts DOM-free `InteractionInput` objects. Hosts translate browser or native events into these inputs. The session owns pointer, crosshair, tooltip, cursor, magnet, and keyboard state, then emits `InteractionSessionEvent` objects.

`RenderScheduler` accepts `RenderInvalidation` objects. It merges invalidations within one animation frame, executes render passes in deterministic order, and records `RenderMetrics`.

Typical flow:

1. Host receives input.
2. Host maps input into `InteractionInput`.
3. `createInteractionSession()` updates `InteractionSessionState`.
4. Session events trigger `RenderInvalidation`.
5. `createRenderScheduler()` coalesces invalidations.
6. Scheduler runs `static`, `dynamic`, and `overlay` passes as needed.
7. `RenderMetrics` are exposed for diagnostics and tests.

The engine does not import DOM events, host APIs, product stores, or business models.
```

- [x] **Step 2: Update public API docs**

Append to `docs/engine/public-api.md`:

````md
## v0.2 Interaction And Rendering

Use `createInteractionSession()` for neutral input state and `createRenderScheduler()` for render lifecycle scheduling.

```ts
const session = createInteractionSession({
  onEvent(event) {
    console.log(event.type);
  }
});

const scheduler = createRenderScheduler({
  requestFrame: requestAnimationFrame,
  renderPass(pass, invalidation) {
    console.log(pass, invalidation.layers);
  }
});
```

Both APIs are host-independent. Hosts translate native events into `InteractionInput` and translate scheduler render passes into canvas rendering calls.
````

- [x] **Step 3: Update testing docs**

Append to `docs/engine/testing-strategy.md`:

```md
v0.2 adds focused tests for interaction session state, keyboard command events, render invalidation coalescing, render pass order, and render metrics.

Playwright verifies that high-frequency pointer movement updates overlay diagnostics without forcing repeated static redraws, and that keyboard zoom commands use neutral engine events.
```

- [x] **Step 4: Verify docs**

Run:

```bash
rg -n "InteractionSession|RenderScheduler|InteractionInput|RenderInvalidation|RenderMetrics|keyboard zoom" docs/engine
```

Expected: matches in lifecycle, public API, and testing docs.

- [x] **Step 5: Commit**

```bash
git add docs/engine/interaction-rendering-lifecycle.md docs/engine/public-api.md docs/engine/testing-strategy.md
git commit -m "docs: document interaction render lifecycle"
```

## Task 9: Final v0.2 Verification

**Files:**

- Modify only if verification exposes a defect.

- [x] **Step 1: Run unit tests**

Run:

```bash
npm run test
```

Expected: all Vitest suites pass.

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript build passes for engine and playground.

- [x] **Step 3: Run boundary guard**

Run:

```bash
npm run guard:engine-boundary
```

Expected: engine boundary guard passes.

- [x] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: engine and playground builds pass.

- [x] **Step 5: Run full E2E**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Expected: all Playwright tests pass.

- [x] **Step 6: Clean generated artifacts**

Run:

```bash
rm -rf apps/playground/dist test-results playwright-report
```

Expected: build and test artifacts are removed.

- [x] **Step 7: Check git status**

Run:

```bash
git status --short
```

Expected: no generated artifacts remain. Only intentional source or doc fixes are pending.

- [x] **Step 8: Commit final fixes if required**

If verification changed source or docs:

```bash
git add <changed-files>
git commit -m "fix: stabilize chart engine v0.2 verification"
```

If no files changed, do not create an empty commit.

## Final Acceptance Checklist

- [x] `createInteractionSession` is exported from `@simoncharts/chart-engine`.
- [x] `InteractionInput`, `InteractionSessionState`, and `InteractionSessionEvent` are exported.
- [x] Pointer, wheel, keyboard, crosshair, tooltip, cursor, and magnet state are unit-tested.
- [x] `createRenderScheduler` is exported from `@simoncharts/chart-engine`.
- [x] `RenderInvalidation`, `RenderSchedulerState`, and `RenderMetrics` are exported.
- [x] Render invalidation merging, pass ordering, coalescing, destroy behavior, and metrics are unit-tested.
- [x] `ChartEngine.getState()` can expose neutral interaction and render snapshots.
- [x] Playground shows cursor, magnet, keyboard command, render counts, and last invalidation diagnostics.
- [x] High-frequency pointer movement does not force repeated static redraws.
- [x] Keyboard `+`, `-`, and `0` trigger neutral zoom command events.
- [x] Wheel zoom invalidates chart layers and records a render reason.
- [x] Documentation covers v0.2 interaction and rendering lifecycle.
- [x] `npm run test` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run guard:engine-boundary` passes.
- [x] `npm run build` passes.
- [x] `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passes.
