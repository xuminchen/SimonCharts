import type { FigureObject, FigurePoint, FigureStyle } from "../figures/figureTypes";
import type { DrawingAnchor, DrawingObject, DrawingStyle, DrawingType } from "./drawingTypes";

const axisLineHalfLength = 80;
const retracementLevels = [0, 0.382, 0.5, 0.618, 1];
const extensionLevels = [0, 0.618, 1, 1.272, 1.618];

export function createFiguresForDrawing(drawing: DrawingObject): FigureObject[] {
  const points = drawing.anchors.filter(isFinitePointAnchor).map(({ x, y }) => ({ x, y }));

  if (points.length === 0) {
    return [];
  }

  switch (drawing.type) {
    case "trendLine":
    case "ray":
    case "extendedLine":
    case "segment":
    case "straightLine":
    case "rayLine":
      return createLineFigure(drawing.id, points, drawing.style);
    case "horizontalSegment":
      return createHorizontalSegmentFigure(drawing.id, points, drawing.style);
    case "verticalSegment":
      return createVerticalSegmentFigure(drawing.id, points, drawing.style);
    case "horizontalLine":
    case "horizontalRayLine":
    case "horizontalStraightLine":
    case "priceLine":
    case "verticalLine":
    case "verticalRayLine":
    case "verticalStraightLine":
      return [
        {
          id: `${drawing.id}:axis-line`,
          type: "line",
          points: createAxisLinePoints(drawing.type, points[0]),
          style: drawing.style
        }
      ];
    case "crossLine":
      return [
        {
          id: `${drawing.id}:horizontal-line`,
          type: "line",
          points: createAxisLinePoints("horizontalLine", points[0]),
          style: drawing.style
        },
        {
          id: `${drawing.id}:vertical-line`,
          type: "line",
          points: createAxisLinePoints("verticalLine", points[0]),
          style: drawing.style
        }
      ];
    case "parallelChannel":
    case "regressionChannel":
    case "priceChannelLine":
      return createChannelFigures(drawing.id, points, drawing.style);
    case "fibonacciRetracement":
      return createFibonacciFigures(drawing.id, points, drawing.style, retracementLevels);
    case "fibonacciExtension":
      return createFibonacciFigures(drawing.id, points, drawing.style, extensionLevels);
    case "text":
    case "simpleAnnotation":
    case "simpleTag":
      return [
        {
          id: `${drawing.id}:label`,
          type: "label",
          points: [points[0]],
          text: drawing.text ?? drawing.type,
          style: drawing.style
        }
      ];
    case "callout":
      return createCalloutFigures(drawing, points);
    case "rectangle":
      return points.length >= 2
        ? [{ id: `${drawing.id}:rect`, type: "rect", points: points.slice(0, 2), style: drawing.style }]
        : [];
    case "rotatedRectangle":
      return createRotatedRectangleFigures(drawing.id, points, drawing.style);
    case "circle":
      return points.length >= 2
        ? [
            {
              id: `${drawing.id}:circle`,
              type: "circle",
              points: points.slice(0, 2),
              style: drawing.style
            }
          ]
        : [];
    case "ellipse":
      return points.length >= 2
        ? [
            {
              id: `${drawing.id}:ellipse`,
              type: "ellipse",
              points: points.slice(0, 2),
              style: drawing.style
            }
          ]
        : [];
    case "polygon":
      return points.length >= 3
        ? [{ id: `${drawing.id}:polygon`, type: "polygon", points, style: drawing.style }]
        : [];
    case "triangle":
      return points.length >= 3
        ? [
            {
              id: `${drawing.id}:triangle`,
              type: "polygon",
              points: points.slice(0, 3),
              style: drawing.style
            }
          ]
        : [];
    case "arc":
      return points.length >= 3
        ? [{ id: `${drawing.id}:arc`, type: "arc", points: points.slice(0, 3), style: drawing.style }]
        : [];
    case "curve":
      return points.length >= 3
        ? [
            {
              id: `${drawing.id}:curve`,
              type: "curve",
              points: points.slice(0, 3),
              style: drawing.style
            }
          ]
        : [];
    case "path":
    case "brush":
      return points.length >= 2
        ? [{ id: `${drawing.id}:path`, type: "polyline", points, style: drawing.style }]
        : [];
    case "arrow":
      return points.length >= 2
        ? [{ id: `${drawing.id}:arrow`, type: "arrow", points, style: drawing.style }]
        : [];
    case "longPosition":
      return createPositionFigures(drawing.id, points, drawing.style, "rgba(22, 163, 74, 0.14)");
    case "shortPosition":
      return createPositionFigures(drawing.id, points, drawing.style, "rgba(220, 38, 38, 0.14)");
    case "datePriceRange":
      return createDatePriceRangeFigures(drawing, points);
    default:
      return [];
  }
}

function isFinitePointAnchor(anchor: DrawingAnchor): anchor is DrawingAnchor & FigurePoint {
  return Number.isFinite(anchor.x) && Number.isFinite(anchor.y);
}

function createLineFigure(
  id: string,
  points: FigurePoint[],
  style: DrawingStyle | undefined
): FigureObject[] {
  return points.length >= 2 ? [{ id: `${id}:line`, type: "line", points: points.slice(0, 2), style }] : [];
}

function createHorizontalSegmentFigure(
  id: string,
  points: FigurePoint[],
  style: DrawingStyle | undefined
): FigureObject[] {
  const start = points[0];
  const end = points[1];

  return start && end
    ? [{ id: `${id}:line`, type: "line", points: [start, { x: end.x, y: start.y }], style }]
    : [];
}

function createVerticalSegmentFigure(
  id: string,
  points: FigurePoint[],
  style: DrawingStyle | undefined
): FigureObject[] {
  const start = points[0];
  const end = points[1];

  return start && end
    ? [{ id: `${id}:line`, type: "line", points: [start, { x: start.x, y: end.y }], style }]
    : [];
}

function createAxisLinePoints(type: DrawingType, anchor: FigurePoint): FigurePoint[] {
  if (
    type === "verticalLine" ||
    type === "verticalRayLine" ||
    type === "verticalStraightLine"
  ) {
    return [
      { x: anchor.x, y: anchor.y - axisLineHalfLength },
      { x: anchor.x, y: anchor.y + axisLineHalfLength }
    ];
  }

  return [
    { x: anchor.x - axisLineHalfLength, y: anchor.y },
    { x: anchor.x + axisLineHalfLength, y: anchor.y }
  ];
}

function createChannelFigures(
  id: string,
  points: FigurePoint[],
  style: DrawingStyle | undefined
): FigureObject[] {
  const first = points[0];
  const second = points[1];
  const third = points[2];

  if (!first || !second) {
    return [];
  }

  const figures: FigureObject[] = [
    { id: `${id}:line`, type: "line", points: [first, second], style }
  ];

  if (!third) {
    return figures;
  }

  const offsetX = third.x - first.x;
  const offsetY = third.y - first.y;

  figures.push({
    id: `${id}:parallel-line`,
    type: "line",
    points: [
      { x: first.x + offsetX, y: first.y + offsetY },
      { x: second.x + offsetX, y: second.y + offsetY }
    ],
    style
  });

  return figures;
}

function createFibonacciFigures(
  id: string,
  points: FigurePoint[],
  style: DrawingStyle | undefined,
  levels: number[]
): FigureObject[] {
  const first = points[0];
  const second = points[1];

  if (!first || !second) {
    return [];
  }

  const minX = Math.min(first.x, second.x);
  const maxX = Math.max(first.x, second.x);
  const spanY = second.y - first.y;

  return levels.map((level) => {
    const y = first.y + spanY * level;

    return {
      id: `${id}:level-${level}`,
      type: "line",
      points: [
        { x: minX, y },
        { x: maxX, y }
      ],
      style
    };
  });
}

function createCalloutFigures(drawing: DrawingObject, points: FigurePoint[]): FigureObject[] {
  const first = points[0];
  const second = points[1];

  if (!first) {
    return [];
  }

  if (!second) {
    return [
      {
        id: `${drawing.id}:label`,
        type: "label",
        points: [first],
        text: drawing.text ?? drawing.type,
        style: drawing.style
      }
    ];
  }

  return [
    { id: `${drawing.id}:line`, type: "line", points: [first, second], style: drawing.style },
    {
      id: `${drawing.id}:label`,
      type: "label",
      points: [second],
      text: drawing.text ?? drawing.type,
      style: drawing.style
    }
  ];
}

function createRotatedRectangleFigures(
  id: string,
  points: FigurePoint[],
  style: DrawingStyle | undefined
): FigureObject[] {
  const first = points[0];
  const second = points[1];
  const third = points[2];

  if (!first || !second) {
    return [];
  }

  if (!third) {
    return [{ id: `${id}:rect`, type: "rect", points: [first, second], style }];
  }

  return [
    {
      id: `${id}:rotated-rect`,
      type: "rotatedRect",
      points: [first, second, third, { x: first.x + third.x - second.x, y: first.y + third.y - second.y }],
      style
    }
  ];
}

function createPositionFigures(
  id: string,
  points: FigurePoint[],
  style: DrawingStyle | undefined,
  fill: string
): FigureObject[] {
  return points.length >= 2
    ? [
        {
          id: `${id}:range`,
          type: "rect",
          points: points.slice(0, 2),
          style: withDefaultFill(style, fill)
        }
      ]
    : [];
}

function createDatePriceRangeFigures(drawing: DrawingObject, points: FigurePoint[]): FigureObject[] {
  if (points.length < 2) {
    return [];
  }

  return [
    {
      id: `${drawing.id}:range`,
      type: "rect",
      points: points.slice(0, 2),
      style: drawing.style
    },
    {
      id: `${drawing.id}:label`,
      type: "label",
      points: [points[0]],
      text: drawing.text ?? "Range",
      style: drawing.style
    }
  ];
}

function withDefaultFill(style: DrawingStyle | undefined, fill: string): FigureStyle {
  return { ...style, fill: style?.fill ?? fill };
}
