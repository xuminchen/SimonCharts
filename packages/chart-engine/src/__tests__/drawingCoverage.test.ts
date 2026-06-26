import { describe, expect, it } from "vitest";
import { createFiguresForDrawing, type DrawingObject, type DrawingType } from "../index";

const baseAnchors = [
  { x: 20, y: 30 },
  { x: 120, y: 90 },
  { x: 180, y: 50 },
  { x: 220, y: 120 },
  { x: 280, y: 80 }
];

function drawing(type: DrawingType, anchorCount: number): DrawingObject {
  return {
    id: `${type}-1`,
    type,
    anchors: baseAnchors.slice(0, anchorCount),
    text: "Label",
    style: { color: "#2563eb", lineWidth: 2, fill: "rgba(37,99,235,0.12)" }
  };
}

describe("drawing figure coverage", () => {
  it.each([
    ["segment", 2],
    ["straightLine", 2],
    ["rayLine", 2],
    ["horizontalRayLine", 1],
    ["horizontalSegment", 2],
    ["horizontalStraightLine", 1],
    ["verticalRayLine", 1],
    ["verticalSegment", 2],
    ["verticalStraightLine", 1],
    ["priceLine", 1],
    ["priceChannelLine", 3],
    ["simpleAnnotation", 1],
    ["simpleTag", 1],
    ["triangle", 3],
    ["arc", 3],
    ["curve", 3]
  ] satisfies Array<[DrawingType, number]>)(
    "creates figures for %s",
    (type, anchorCount) => {
      expect(createFiguresForDrawing(drawing(type, anchorCount))).not.toHaveLength(0);
    }
  );

  it.each([
    ["fibTrendBasedExtension", 3],
    ["fibTimeZone", 2],
    ["fibFan", 2],
    ["fibArc", 2],
    ["fibChannel", 3],
    ["fibWedge", 3],
    ["gannFan", 2],
    ["gannBox", 2],
    ["gannSquare", 2],
    ["pitchfork", 3],
    ["schiffPitchfork", 3],
    ["modifiedSchiffPitchfork", 3],
    ["insidePitchfork", 3],
    ["elliottImpulseWave", 5],
    ["elliottCorrectionWave", 3],
    ["xabcdPattern", 5],
    ["cypherPattern", 5],
    ["headAndShouldersPattern", 5],
    ["forecastPath", 3]
  ] satisfies Array<[DrawingType, number]>)(
    "creates advanced figures for %s",
    (type, anchorCount) => {
      expect(createFiguresForDrawing(drawing(type, anchorCount))).not.toHaveLength(0);
    }
  );

  it("maps horizontal segments to a horizontal line through the first anchor", () => {
    expect(createFiguresForDrawing(drawing("horizontalSegment", 2))[0]).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 30 }
      ]
    });
  });

  it("maps vertical segments to a vertical line through the first anchor", () => {
    expect(createFiguresForDrawing(drawing("verticalSegment", 2))[0]).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 20, y: 90 }
      ]
    });
  });

  it("maps price channels to offset parallel line figures", () => {
    expect(createFiguresForDrawing(drawing("priceChannelLine", 3))).toMatchObject([
      {
        type: "line",
        points: [
          { x: 20, y: 30 },
          { x: 120, y: 90 }
        ]
      },
      {
        type: "line",
        points: [
          { x: 180, y: 50 },
          { x: 280, y: 110 }
        ]
      }
    ]);
  });

  it("maps simple annotations to labels with text", () => {
    expect(createFiguresForDrawing(drawing("simpleAnnotation", 1))[0]).toMatchObject({
      type: "label",
      points: [{ x: 20, y: 30 }],
      text: "Label"
    });
  });

  it("maps triangles to polygons with the first three points", () => {
    expect(createFiguresForDrawing(drawing("triangle", 3))[0]).toMatchObject({
      type: "polygon",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 90 },
        { x: 180, y: 50 }
      ]
    });
  });

  it("maps arcs to arc figures with the first three points", () => {
    expect(createFiguresForDrawing(drawing("arc", 3))[0]).toMatchObject({
      type: "arc",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 90 },
        { x: 180, y: 50 }
      ]
    });
  });

  it("maps curves to curve figures with the first three points", () => {
    expect(createFiguresForDrawing(drawing("curve", 3))[0]).toMatchObject({
      type: "curve",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 90 },
        { x: 180, y: 50 }
      ]
    });
  });

  it("maps Fibonacci fans to multiple line figures", () => {
    const figures = createFiguresForDrawing(drawing("fibFan", 2));
    const lines = figures.filter((figure) => figure.type === "line");

    expect(lines.length).toBeGreaterThan(1);
  });

  it("maps Gann boxes to a rect and diagonal lines", () => {
    expect(createFiguresForDrawing(drawing("gannBox", 2))).toMatchObject([
      { type: "rect" },
      {
        type: "line",
        points: [
          { x: 20, y: 30 },
          { x: 120, y: 90 }
        ]
      },
      {
        type: "line",
        points: [
          { x: 20, y: 90 },
          { x: 120, y: 30 }
        ]
      }
    ]);
  });

  it("maps pitchforks to median and parallel lines", () => {
    const figures = createFiguresForDrawing(drawing("pitchfork", 3));

    expect(figures).toHaveLength(3);
    expect(figures.every((figure) => figure.type === "line")).toBe(true);
  });

  it("maps Elliott impulse waves to a polyline and point labels", () => {
    const figures = createFiguresForDrawing(drawing("elliottImpulseWave", 5));

    expect(figures[0]).toMatchObject({ type: "polyline" });
    expect(figures.slice(1).every((figure) => figure.type === "label")).toBe(true);
  });

  it("maps forecast paths to a polyline and final arrow", () => {
    expect(createFiguresForDrawing(drawing("forecastPath", 3))).toMatchObject([
      { type: "polyline" },
      {
        type: "arrow",
        points: [
          { x: 120, y: 90 },
          { x: 180, y: 50 }
        ]
      }
    ]);
  });
});
