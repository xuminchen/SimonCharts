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
});
