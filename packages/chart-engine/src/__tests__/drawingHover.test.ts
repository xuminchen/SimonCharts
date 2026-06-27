import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createDrawingRendererRegistry,
  getDrawingHoverState,
  type DrawingEditHandle,
  type DrawingHoverTarget,
  type DrawingObject,
  type DrawingRenderer
} from "../index";

function createDistanceRegistry() {
  const registry = createDrawingRendererRegistry();
  const renderer: DrawingRenderer = {
    type: "trendLine",
    render() {},
    hitTest(drawing) {
      const distance = Number(drawing.metadata?.distance);

      return Number.isFinite(distance) ? { drawingId: drawing.id, distance } : undefined;
    }
  };

  registry.register(renderer);

  return registry;
}

function drawing(id: string, distance?: number, overrides: Partial<DrawingObject> = {}) {
  return {
    id,
    type: "trendLine",
    anchors: [],
    metadata: distance === undefined ? undefined : { distance },
    ...overrides
  } satisfies DrawingObject;
}

function handle(
  id: string,
  kind: DrawingEditHandle["kind"],
  x: number,
  y: number,
  patch: Partial<DrawingEditHandle> = {}
): DrawingEditHandle {
  return {
    id,
    drawingId: "handle-drawing",
    kind,
    x,
    y,
    ...patch
  };
}

describe("drawing hover intent", () => {
  it("returns drawing cursor and target for a body hit", () => {
    const registry = createDistanceRegistry();

    expect(
      getDrawingHoverState({
        drawings: [drawing("body", 1)],
        point: { x: 0, y: 0 },
        handles: [],
        registry
      })
    ).toEqual({
      target: { kind: "body", drawingId: "body" },
      hoveredDrawingId: "body",
      cursor: "drawing"
    });
  });

  it("returns crosshair cursor without target for no hit", () => {
    const registry = createDistanceRegistry();

    expect(
      getDrawingHoverState({
        drawings: [drawing("miss")],
        point: { x: 0, y: 0 },
        handles: [],
        registry
      })
    ).toEqual({ cursor: "crosshair" });
  });

  it("prefers handle hits over body hits", () => {
    const registry = createDistanceRegistry();

    expect(
      getDrawingHoverState({
        drawings: [drawing("body", 1)],
        point: { x: 0, y: 0 },
        handles: [handle("handle-drawing:anchor:0", "anchor", 0, 0, { anchorIndex: 0 })],
        registry
      })
    ).toEqual({
      target: {
        kind: "handle",
        drawingId: "handle-drawing",
        handleId: "handle-drawing:anchor:0",
        handleKind: "anchor"
      },
      hoveredDrawingId: "handle-drawing",
      cursor: "drawing"
    });
  });

  it("uses resize cursor for resize handles", () => {
    const registry = createDistanceRegistry();

    expect(
      getDrawingHoverState({
        drawings: [],
        point: { x: 10, y: 10 },
        handles: [
          handle("handle-drawing:resize:right", "resize", 10, 10, { position: "right" })
        ],
        registry
      })
    ).toEqual({
      target: {
        kind: "handle",
        drawingId: "handle-drawing",
        handleId: "handle-drawing:resize:right",
        handleKind: "resize"
      },
      hoveredDrawingId: "handle-drawing",
      cursor: "resize"
    });
  });

  it("uses drawing cursor for anchor and rotate handles", () => {
    const registry = createDistanceRegistry();

    expect(
      getDrawingHoverState({
        drawings: [],
        point: { x: 10, y: 10 },
        handles: [handle("handle-drawing:anchor:0", "anchor", 10, 10, { anchorIndex: 0 })],
        registry
      }).cursor
    ).toBe("drawing");

    expect(
      getDrawingHoverState({
        drawings: [],
        point: { x: 10, y: 10 },
        handles: [handle("handle-drawing:rotate", "rotate", 10, 10)],
        registry
      }).cursor
    ).toBe("drawing");
  });

  it("returns active target state without recomputing hit tests", () => {
    const registry = createDrawingRendererRegistry();
    const activeTarget: DrawingHoverTarget = {
      kind: "handle",
      drawingId: "active",
      handleId: "active:resize:right",
      handleKind: "resize"
    };

    expect(
      getDrawingHoverState({
        drawings: [drawing("missing-renderer", 1)],
        point: { x: 0, y: 0 },
        handles: [],
        registry,
        activeTarget
      })
    ).toEqual({
      target: activeTarget,
      hoveredDrawingId: "active",
      cursor: "resize"
    });
  });

  it("respects includeLocked false body hit-test options", () => {
    const registry = createDistanceRegistry();

    expect(
      getDrawingHoverState({
        drawings: [
          drawing("unlocked", 6),
          drawing("locked", 1, { locked: true })
        ],
        point: { x: 0, y: 0 },
        handles: [],
        registry,
        bodyHitTestOptions: { includeLocked: false }
      })
    ).toEqual({
      target: { kind: "body", drawingId: "unlocked" },
      hoveredDrawingId: "unlocked",
      cursor: "drawing"
    });
  });

  it("keeps the hover contract free of DOM globals", () => {
    const sourcePath = fileURLToPath(new URL("../drawing/drawingHover.ts", import.meta.url));
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toMatch(/\b(document|window|HTMLElement|PointerEvent)\b/);
  });
});
