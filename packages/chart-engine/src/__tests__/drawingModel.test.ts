import { describe, expect, it } from "vitest";
import {
  createDrawingRendererRegistry,
  deserializeDrawingObject,
  drawingTypes,
  getDrawingBounds,
  hitTestDrawingAnchor,
  parseDrawingObject,
  serializeDrawingObject,
  type DrawingRenderer,
  type DrawingObject
} from "../index";

describe("drawing model", () => {
  it("declares drawing tool coverage types", () => {
    expect(drawingTypes).toContain("trendLine");
    expect(drawingTypes).toContain("priceLine");
    expect(drawingTypes).toContain("fibonacciRetracement");
    expect(drawingTypes).toContain("datePriceRange");
    expect(drawingTypes).toContain("elliottImpulseWave");
    expect(drawingTypes).toContain("forecastPath");
    expect(drawingTypes).toHaveLength(63);
  });

  it("round-trips a neutral drawing object", () => {
    const drawing: DrawingObject = {
      id: "d1",
      type: "trendLine",
      anchors: [
        { time: 1, price: 10 },
        { time: 2, price: 12 }
      ],
      style: { color: "#2563eb", lineWidth: 2 },
      visible: true,
      locked: false,
      metadata: { hostId: "opaque" }
    };

    expect(deserializeDrawingObject(serializeDrawingObject(drawing))).toEqual(drawing);
    expect(parseDrawingObject(drawing)).toEqual(drawing);
  });

  it("serializes to a deep clone", () => {
    const drawing: DrawingObject = {
      id: "d1",
      type: "rectangle",
      anchors: [{ x: 1, y: 2 }],
      metadata: { nested: { value: 1 } }
    };

    const serialized = serializeDrawingObject(drawing);

    expect(serialized).toEqual({ schemaVersion: 1, ...drawing });
    expect(serialized).not.toBe(drawing);
    expect(serialized.anchors).not.toBe(drawing.anchors);
    expect(serialized.metadata).not.toBe(drawing.metadata);
    expect(serialized.metadata?.nested).not.toBe(drawing.metadata?.nested);
  });

  it("rejects non-object drawing payloads", () => {
    expect(() => parseDrawingObject(null)).toThrow("Drawing object must be an object");
  });

  it("rejects serialized drawing payloads at the runtime parser boundary", () => {
    expect(() =>
      parseDrawingObject({
        schemaVersion: 2,
        id: "bad",
        type: "trendLine",
        anchors: []
      })
    ).toThrow("Serialized drawing payload must be deserialized with deserializeDrawingObject");
  });

  it("rejects drawing objects without a string id", () => {
    expect(() =>
      parseDrawingObject({
        id: 1,
        type: "trendLine",
        anchors: []
      })
    ).toThrow("Drawing object id must be a string");
  });

  it("rejects unsupported drawing types with a clear error", () => {
    expect(() =>
      parseDrawingObject({
        id: "bad",
        type: "hostReview",
        anchors: []
      })
    ).toThrow("Unsupported drawing type: hostReview");
  });

  it("rejects drawing objects without an anchors array", () => {
    expect(() =>
      parseDrawingObject({
        id: "bad",
        type: "trendLine",
        anchors: "not-array"
      })
    ).toThrow("Drawing object anchors must be an array");
  });
});

describe("drawing geometry and registry", () => {
  it("computes drawing bounds from finite xy anchors", () => {
    expect(
      getDrawingBounds({
        id: "d1",
        type: "rectangle",
        anchors: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
          { time: 1, price: 12 }
        ]
      })
    ).toEqual({ x: 10, y: 20, width: 20, height: 20 });
  });

  it("returns undefined bounds without xy anchors", () => {
    expect(
      getDrawingBounds({
        id: "d1",
        type: "trendLine",
        anchors: [{ time: 1, price: 10 }]
      })
    ).toBeUndefined();
  });

  it("hit-tests drawing anchors", () => {
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
  });

  it("returns undefined when drawing anchors miss the hit radius", () => {
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

  it("registers drawing renderers by type", () => {
    const registry = createDrawingRendererRegistry();
    const renderer: DrawingRenderer = {
      type: "trendLine",
      render() {},
      hitTest() {
        return undefined;
      }
    };

    registry.register(renderer);

    expect(registry.require("trendLine")).toBe(renderer);
    expect(registry.list()).toEqual([renderer]);
  });

  it("throws a clear error when a drawing renderer is missing", () => {
    const registry = createDrawingRendererRegistry();

    expect(() => registry.require("trendLine")).toThrow(
      "Drawing renderer is not registered: trendLine"
    );
  });
});
