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

export type BuiltInDrawingType = (typeof drawingTypes)[number];
export type CustomDrawingType = string & { readonly __customDrawingType?: never };
export type DrawingType = BuiltInDrawingType | CustomDrawingType;

const customDrawingTypePattern = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*([.-][a-z0-9]+)*$/;

export function isBuiltInDrawingType(type: string): type is BuiltInDrawingType {
  return drawingTypes.includes(type as BuiltInDrawingType);
}

export function isCustomDrawingType(type: string): type is CustomDrawingType {
  return customDrawingTypePattern.test(type);
}

export function isDrawingType(type: string): type is DrawingType {
  return isBuiltInDrawingType(type) || isCustomDrawingType(type);
}

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
  interactive?: boolean;
  affectsPriceScale?: boolean;
  zIndex?: number;
  metadata?: Record<string, unknown>;
}
