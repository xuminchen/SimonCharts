export const drawingTypes = [
  "trendLine",
  "ray",
  "extendedLine",
  "horizontalLine",
  "verticalLine",
  "crossLine",
  "segment",
  "straightLine",
  "rayLine",
  "horizontalRayLine",
  "horizontalSegment",
  "horizontalStraightLine",
  "verticalRayLine",
  "verticalSegment",
  "verticalStraightLine",
  "priceLine",
  "parallelChannel",
  "regressionChannel",
  "priceChannelLine",
  "fibonacciRetracement",
  "fibonacciExtension",
  "fibTrendBasedExtension",
  "fibTimeZone",
  "fibFan",
  "fibArc",
  "fibChannel",
  "fibWedge",
  "text",
  "callout",
  "simpleAnnotation",
  "simpleTag",
  "rectangle",
  "rotatedRectangle",
  "circle",
  "ellipse",
  "polygon",
  "triangle",
  "arc",
  "curve",
  "path",
  "brush",
  "arrow",
  "longPosition",
  "shortPosition",
  "profitLossRange",
  "datePriceRange",
  "dateRange",
  "priceRange",
  "measure",
  "trendAngle",
  "gannFan",
  "gannBox",
  "gannSquare",
  "pitchfork",
  "schiffPitchfork",
  "modifiedSchiffPitchfork",
  "insidePitchfork",
  "elliottImpulseWave",
  "elliottCorrectionWave",
  "xabcdPattern",
  "cypherPattern",
  "headAndShouldersPattern",
  "forecastPath"
] as const;

export type DrawingType = (typeof drawingTypes)[number];

export interface DrawingAnchor {
  time?: number;
  index?: number;
  price?: number;
  x?: number;
  y?: number;
}

export interface DrawingStyle {
  color?: string;
  lineWidth?: number;
  lineDash?: number[];
  fill?: string;
  textColor?: string;
  fontSize?: number;
}

export interface DrawingObject {
  id: string;
  type: DrawingType;
  anchors: DrawingAnchor[];
  style?: DrawingStyle;
  text?: string;
  visible?: boolean;
  locked?: boolean;
  zIndex?: number;
  metadata?: Record<string, unknown>;
}
