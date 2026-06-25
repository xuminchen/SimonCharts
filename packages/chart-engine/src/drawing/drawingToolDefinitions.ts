import type { DrawingStyle, DrawingType } from "./drawingTypes";

export type DrawingToolCategory =
  | "basic"
  | "channel"
  | "fibonacci"
  | "annotation"
  | "shape"
  | "path"
  | "position"
  | "measurement"
  | "gann"
  | "pitchfork"
  | "pattern"
  | "forecast";

export type DrawingMode = "step" | "continuous";

export interface DrawingToolDefinition {
  type: DrawingType;
  label: string;
  category: DrawingToolCategory;
  totalStep: number;
  anchorCount: number;
  drawingMode: DrawingMode;
  defaultStyle: DrawingStyle;
  hotkeyId: string;
}

export const builtInDrawingToolDefinitions: DrawingToolDefinition[] = [
  tool("trendLine", "Trend Line", "basic", 2),
  tool("ray", "Ray", "basic", 2),
  tool("extendedLine", "Extended Line", "basic", 2),
  tool("horizontalLine", "Horizontal Line", "basic", 1),
  tool("verticalLine", "Vertical Line", "basic", 1),
  tool("crossLine", "Cross Line", "basic", 1),
  tool("segment", "Segment", "basic", 2),
  tool("straightLine", "Straight Line", "basic", 2),
  tool("rayLine", "Ray Line", "basic", 2),
  tool("horizontalRayLine", "Horizontal Ray", "basic", 1),
  tool("horizontalSegment", "Horizontal Segment", "basic", 2),
  tool("horizontalStraightLine", "Horizontal Straight Line", "basic", 1),
  tool("verticalRayLine", "Vertical Ray", "basic", 1),
  tool("verticalSegment", "Vertical Segment", "basic", 2),
  tool("verticalStraightLine", "Vertical Straight Line", "basic", 1),
  tool("priceLine", "Price Line", "basic", 1),
  tool("parallelChannel", "Parallel Channel", "channel", 3),
  tool("regressionChannel", "Regression Channel", "channel", 3),
  tool("priceChannelLine", "Price Channel", "channel", 3),
  tool("fibonacciRetracement", "Fibonacci Retracement", "fibonacci", 2),
  tool("fibonacciExtension", "Fibonacci Extension", "fibonacci", 2),
  tool("fibTrendBasedExtension", "Trend-Based Extension", "fibonacci", 3),
  tool("fibTimeZone", "Fibonacci Time Zone", "fibonacci", 2),
  tool("fibFan", "Fibonacci Fan", "fibonacci", 2),
  tool("fibArc", "Fibonacci Arc", "fibonacci", 2),
  tool("fibChannel", "Fibonacci Channel", "fibonacci", 3),
  tool("fibWedge", "Fibonacci Wedge", "fibonacci", 3),
  tool("text", "Text", "annotation", 1),
  tool("callout", "Callout", "annotation", 2),
  tool("simpleAnnotation", "Annotation", "annotation", 1),
  tool("simpleTag", "Tag", "annotation", 1),
  tool("rectangle", "Rectangle", "shape", 2),
  tool("rotatedRectangle", "Rotated Rectangle", "shape", 3),
  tool("circle", "Circle", "shape", 2),
  tool("ellipse", "Ellipse", "shape", 2),
  tool("polygon", "Polygon", "shape", 3),
  tool("triangle", "Triangle", "shape", 3),
  tool("arc", "Arc", "shape", 3),
  tool("curve", "Curve", "shape", 3),
  tool("path", "Path", "path", 3, "continuous"),
  tool("brush", "Brush", "path", 3, "continuous"),
  tool("arrow", "Arrow", "path", 2),
  tool("longPosition", "Long Position", "position", 2),
  tool("shortPosition", "Short Position", "position", 2),
  tool("profitLossRange", "Profit/Loss Range", "position", 2),
  tool("datePriceRange", "Date Price Range", "measurement", 2),
  tool("dateRange", "Date Range", "measurement", 2),
  tool("priceRange", "Price Range", "measurement", 2),
  tool("measure", "Measure", "measurement", 2),
  tool("trendAngle", "Trend Angle", "measurement", 2),
  tool("gannFan", "Gann Fan", "gann", 2),
  tool("gannBox", "Gann Box", "gann", 2),
  tool("gannSquare", "Gann Square", "gann", 2),
  tool("pitchfork", "Pitchfork", "pitchfork", 3),
  tool("schiffPitchfork", "Schiff Pitchfork", "pitchfork", 3),
  tool("modifiedSchiffPitchfork", "Modified Schiff Pitchfork", "pitchfork", 3),
  tool("insidePitchfork", "Inside Pitchfork", "pitchfork", 3),
  tool("elliottImpulseWave", "Elliott Impulse Wave", "pattern", 5),
  tool("elliottCorrectionWave", "Elliott Correction Wave", "pattern", 3),
  tool("xabcdPattern", "XABCD Pattern", "pattern", 5),
  tool("cypherPattern", "Cypher Pattern", "pattern", 5),
  tool("headAndShouldersPattern", "Head And Shoulders", "pattern", 5),
  tool("forecastPath", "Forecast Path", "forecast", 3, "continuous")
];

function tool(
  type: DrawingType,
  label: string,
  category: DrawingToolCategory,
  anchorCount: number,
  drawingMode: DrawingMode = "step"
): DrawingToolDefinition {
  return {
    type,
    label,
    category,
    totalStep: anchorCount + 1,
    anchorCount,
    drawingMode,
    defaultStyle: { color: "#2563eb", lineWidth: 2, fill: "rgba(37,99,235,0.12)" },
    hotkeyId: `drawing.${type}`
  };
}
