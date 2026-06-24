export const drawingTypes = [
  "trendLine",
  "ray",
  "extendedLine",
  "horizontalLine",
  "verticalLine",
  "crossLine",
  "parallelChannel",
  "regressionChannel",
  "fibonacciRetracement",
  "fibonacciExtension",
  "text",
  "callout",
  "rectangle",
  "rotatedRectangle",
  "circle",
  "ellipse",
  "polygon",
  "path",
  "brush",
  "arrow",
  "longPosition",
  "shortPosition",
  "datePriceRange"
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
  metadata?: Record<string, unknown>;
}
