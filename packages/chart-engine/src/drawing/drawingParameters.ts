import type { DrawingObject, DrawingType } from "./drawingTypes";

export const defaultFibonacciRetracementLevels = [0, 0.382, 0.5, 0.618, 1] as const;
export const defaultFibonacciExtensionLevels = [0, 0.618, 1, 1.272, 1.618] as const;
export const defaultFibonacciAdvancedLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;
export const defaultGannFanRatios = [1 / 8, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 8] as const;

export const fibonacciParameterTypes = new Set<DrawingType>([
  "fibonacciRetracement",
  "fibonacciExtension",
  "fibTrendBasedExtension",
  "fibTimeZone",
  "fibFan",
  "fibArc",
  "fibChannel",
  "fibWedge"
]);

export const gannFanParameterTypes = new Set<DrawingType>(["gannFan"]);
export const positionLabelParameterTypes = new Set<DrawingType>([
  "longPosition",
  "shortPosition",
  "profitLossRange"
]);
export const rangeLabelParameterTypes = new Set<DrawingType>([
  "datePriceRange",
  "dateRange",
  "priceRange",
  "measure",
  "trendAngle"
]);

export function getDefaultFibonacciLevels(type: DrawingType): number[] {
  if (type === "fibonacciRetracement") {
    return [...defaultFibonacciRetracementLevels];
  }

  if (type === "fibonacciExtension") {
    return [...defaultFibonacciExtensionLevels];
  }

  return [...defaultFibonacciAdvancedLevels];
}

export function getDrawingFibonacciLevels(drawing: DrawingObject): number[] {
  return readFiniteNumberList(drawing.metadata?.fibonacciLevels, getDefaultFibonacciLevels(drawing.type));
}

export function getDrawingGannFanRatios(drawing: DrawingObject): number[] {
  return readFiniteNumberList(drawing.metadata?.gannRatios, [...defaultGannFanRatios]);
}

export function getDrawingParameterLabel(
  drawing: DrawingObject,
  key: "positionLabel" | "rangeLabel",
  fallback: string
): string {
  const value = drawing.metadata?.[key];

  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function readFiniteNumberList(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const numbers = value.filter((item): item is number => Number.isFinite(item));

  return numbers.length > 0 ? numbers : fallback;
}
