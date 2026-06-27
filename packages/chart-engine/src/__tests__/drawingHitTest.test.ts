import { describe, expect, it } from "vitest";
import {
  createDrawingRendererRegistry,
  hitTestDrawing,
  hitTestDrawingAll,
  hitTestDrawingAnchor,
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

function createDrawing(id: string, distance?: number, overrides: Partial<DrawingObject> = {}) {
  return {
    id,
    type: "trendLine",
    anchors: [],
    metadata: distance === undefined ? undefined : { distance },
    ...overrides
  } satisfies DrawingObject;
}

describe("drawing hit test", () => {
  it("returns matches ordered by nearest distance", () => {
    const registry = createDistanceRegistry();

    const matches = hitTestDrawingAll(
      [createDrawing("far", 8), createDrawing("near", 2), createDrawing("middle", 5)],
      { x: 0, y: 0 },
      { registry }
    );

    expect(matches.map((match) => match.drawing.id)).toEqual(["near", "middle", "far"]);
    expect(
      hitTestDrawing(matches.map((match) => match.drawing), { x: 0, y: 0 }, { registry })?.drawing
        .id
    ).toBe("near");
  });

  it("excludes hidden drawings by default and includes them when requested", () => {
    const registry = createDistanceRegistry();
    const drawings = [
      createDrawing("visible", 6),
      createDrawing("hidden", 1, { visible: false })
    ];

    expect(
      hitTestDrawingAll(drawings, { x: 0, y: 0 }, { registry }).map((match) => match.drawing.id)
    ).toEqual(["visible"]);
    expect(
      hitTestDrawingAll(drawings, { x: 0, y: 0 }, { registry, includeHidden: true }).map(
        (match) => match.drawing.id
      )
    ).toEqual(["hidden", "visible"]);
  });

  it("includes locked drawings by default and excludes them when requested", () => {
    const registry = createDistanceRegistry();
    const drawings = [
      createDrawing("unlocked", 6),
      createDrawing("locked", 1, { locked: true })
    ];

    expect(hitTestDrawing(drawings, { x: 0, y: 0 }, { registry })?.drawing.id).toBe("locked");
    expect(
      hitTestDrawingAll(drawings, { x: 0, y: 0 }, { registry, includeLocked: false }).map(
        (match) => match.drawing.id
      )
    ).toEqual(["unlocked"]);
  });

  it("prefers later drawings when hit distances are equal", () => {
    const registry = createDistanceRegistry();

    expect(
      hitTestDrawingAll(
        [createDrawing("bottom", 3), createDrawing("middle", 3), createDrawing("top", 3)],
        { x: 0, y: 0 },
        { registry }
      ).map((match) => match.drawing.id)
    ).toEqual(["top", "middle", "bottom"]);
  });

  it("returns undefined when no drawing hits", () => {
    const registry = createDistanceRegistry();

    expect(hitTestDrawing([createDrawing("miss")], { x: 0, y: 0 }, { registry })).toBeUndefined();
    expect(hitTestDrawingAll([createDrawing("miss")], { x: 0, y: 0 }, { registry })).toEqual([]);
  });

  it("throws when a drawing renderer is missing", () => {
    const registry = createDrawingRendererRegistry();

    expect(() => hitTestDrawingAll([createDrawing("missing", 1)], { x: 0, y: 0 }, { registry }))
      .toThrow("Drawing renderer is not registered: trendLine");
  });

  it("keeps anchor hit-testing behavior intact", () => {
    const hit = hitTestDrawingAnchor(
      {
        id: "d1",
        type: "trendLine",
        anchors: [
          { x: 10, y: 20 },
          { x: 30, y: 40 }
        ]
      },
      { x: 11, y: 21 },
      4
    );

    expect(hit).toEqual({ drawingId: "d1", anchorIndex: 0, distance: expect.any(Number) });
    expect(
      hitTestDrawingAnchor(
        {
          id: "d1",
          type: "trendLine",
          anchors: [{ x: 10, y: 20 }]
        },
        { x: 20, y: 30 },
        2
      )
    ).toBeUndefined();
  });
});
