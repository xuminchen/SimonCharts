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
});
