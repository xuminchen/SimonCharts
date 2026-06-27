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

  it("maps Fibonacci fans to fixed level lines and labels", () => {
    const figures = createFiguresForDrawing(drawing("fibFan", 2));
    const lines = figures.filter((figure) => figure.type === "line");
    const labels = figures.filter((figure) => figure.type === "label");

    expect(lines).toHaveLength(7);
    expect(labels.map((label) => label.text)).toEqual(["0", "0.236", "0.382", "0.5", "0.618", "0.786", "1"]);
    expect(figures.find((figure) => figure.id === "fibFan-1:level-0")).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 30 }
      ]
    });
    expect(figures.find((figure) => figure.id === "fibFan-1:level-0.618")).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 67.08 }
      ]
    });
    expect(figures.find((figure) => figure.id === "fibFan-1:label-1")).toMatchObject({
      type: "label",
      points: [{ x: 120, y: 90 }],
      text: "1"
    });
  });

  it("maps Fibonacci fans from metadata levels when provided", () => {
    const figures = createFiguresForDrawing({
      ...drawing("fibFan", 2),
      metadata: { fibonacciLevels: [0, 0.25, 1] }
    });

    expect(figures.filter((figure) => figure.type === "line")).toHaveLength(3);
    expect(figures.filter((figure) => figure.type === "label").map((label) => label.text)).toEqual([
      "0",
      "0.25",
      "1"
    ]);
    expect(figures.find((figure) => figure.id === "fibFan-1:level-0.25")).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 45 }
      ]
    });
  });

  it("maps trend-based Fibonacci extensions from the third anchor with fixed labels", () => {
    const figures = createFiguresForDrawing(drawing("fibTrendBasedExtension", 3));

    expect(figures).toHaveLength(14);
    expect(figures.find((figure) => figure.id === "fibTrendBasedExtension-1:level-0")).toMatchObject({
      type: "line",
      points: [
        { x: 180, y: 50 },
        { x: 280, y: 50 }
      ]
    });
    expect(figures.find((figure) => figure.id === "fibTrendBasedExtension-1:level-1")).toMatchObject({
      type: "line",
      points: [
        { x: 180, y: 110 },
        { x: 280, y: 110 }
      ]
    });
    expect(figures.find((figure) => figure.id === "fibTrendBasedExtension-1:label-0.5")).toMatchObject({
      type: "label",
      points: [{ x: 280, y: 80 }],
      text: "0.5"
    });
  });

  it("maps Gann fans to fixed ratio coordinates", () => {
    const figures = createFiguresForDrawing(drawing("gannFan", 2));

    expect(figures).toHaveLength(9);
    expect(figures.find((figure) => figure.id === "gannFan-1:fan-0.125")).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 37.5 }
      ]
    });
    expect(figures.find((figure) => figure.id === "gannFan-1:fan-1")).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 90 }
      ]
    });
    expect(figures.find((figure) => figure.id === "gannFan-1:fan-8")).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 510 }
      ]
    });
  });

  it("maps Gann fans from metadata ratios when provided", () => {
    const figures = createFiguresForDrawing({
      ...drawing("gannFan", 2),
      metadata: { gannRatios: [0.5, 2] }
    });

    expect(figures).toHaveLength(2);
    expect(figures.find((figure) => figure.id === "gannFan-1:fan-0.5")).toMatchObject({
      type: "line",
      points: [
        { x: 20, y: 30 },
        { x: 120, y: 60 }
      ]
    });
  });

  it("maps position and range labels from metadata", () => {
    expect(
      createFiguresForDrawing({
        ...drawing("longPosition", 2),
        metadata: { positionLabel: "2R long" }
      }).find((figure) => figure.type === "label")
    ).toMatchObject({ text: "2R long" });

    expect(
      createFiguresForDrawing({
        ...drawing("datePriceRange", 2),
        metadata: { rangeLabel: "Earnings window" }
      }).find((figure) => figure.type === "label")
    ).toMatchObject({ text: "Label" });

    expect(
      createFiguresForDrawing({
        ...drawing("datePriceRange", 2),
        text: undefined,
        metadata: { rangeLabel: "Earnings window" }
      }).find((figure) => figure.type === "label")
    ).toMatchObject({ text: "Earnings window" });
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

  it("maps Gann squares to square-normalized box geometry", () => {
    expect(createFiguresForDrawing(drawing("gannSquare", 2))).toMatchObject([
      {
        type: "rect",
        points: [
          { x: 20, y: 30 },
          { x: 120, y: 130 }
        ]
      },
      {
        type: "line",
        points: [
          { x: 20, y: 30 },
          { x: 120, y: 130 }
        ]
      },
      {
        type: "line",
        points: [
          { x: 20, y: 130 },
          { x: 120, y: 30 }
        ]
      }
    ]);
  });

  it("maps pitchforks to median and parallel vectors", () => {
    const figures = createFiguresForDrawing(drawing("pitchfork", 3));

    expect(figures).toMatchObject([
      {
        id: "pitchfork-1:median",
        type: "line",
        points: [
          { x: 20, y: 30 },
          { x: 150, y: 70 }
        ]
      },
      {
        id: "pitchfork-1:upper-parallel",
        type: "line",
        points: [
          { x: 120, y: 90 },
          { x: 250, y: 130 }
        ]
      },
      {
        id: "pitchfork-1:lower-parallel",
        type: "line",
        points: [
          { x: 180, y: 50 },
          { x: 310, y: 90 }
        ]
      }
    ]);
  });

  it("maps Elliott impulse waves to a polyline and point labels", () => {
    const figures = createFiguresForDrawing(drawing("elliottImpulseWave", 5));

    expect(figures[0]).toMatchObject({
      type: "polyline",
      points: baseAnchors
    });
    expect(figures.slice(1)).toMatchObject([
      { type: "label", points: [{ x: 20, y: 30 }], text: "1" },
      { type: "label", points: [{ x: 120, y: 90 }], text: "2" },
      { type: "label", points: [{ x: 180, y: 50 }], text: "3" },
      { type: "label", points: [{ x: 220, y: 120 }], text: "4" },
      { type: "label", points: [{ x: 280, y: 80 }], text: "5" }
    ]);
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
