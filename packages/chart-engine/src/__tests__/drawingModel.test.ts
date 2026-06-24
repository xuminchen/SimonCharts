import { describe, expect, it } from "vitest";
import {
  drawingTypes,
  parseDrawingObject,
  serializeDrawingObject,
  type DrawingObject
} from "../index";

describe("drawing model", () => {
  it("declares v0.1 drawing types", () => {
    expect(drawingTypes).toContain("trendLine");
    expect(drawingTypes).toContain("fibonacciRetracement");
    expect(drawingTypes).toContain("datePriceRange");
    expect(drawingTypes).toHaveLength(23);
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

    expect(parseDrawingObject(serializeDrawingObject(drawing))).toEqual(drawing);
  });

  it("serializes to a deep clone", () => {
    const drawing: DrawingObject = {
      id: "d1",
      type: "rectangle",
      anchors: [{ x: 1, y: 2 }],
      metadata: { nested: { value: 1 } }
    };

    expect(serializeDrawingObject(drawing)).toEqual(drawing);
    expect(serializeDrawingObject(drawing)).not.toBe(drawing);
    expect(serializeDrawingObject(drawing).metadata).not.toBe(drawing.metadata);
  });

  it("rejects non-object drawing payloads", () => {
    expect(() => parseDrawingObject(null)).toThrow("Drawing object must be an object");
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
