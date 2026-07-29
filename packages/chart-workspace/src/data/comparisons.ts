import type { ChartComparison, ChartSymbol } from "../contracts";
import { parseChartSymbol } from "./chartSymbol";

export const maxChartComparisons = 4;
export const chartComparisonColors = Object.freeze([
  "#2962ff",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899"
] as const);

const comparisonColor = /^#[\da-f]{6}$/i;

export function parseComparisons(
  value: unknown,
  mainSymbol: Readonly<ChartSymbol>
): readonly ChartComparison[] {
  if (!Array.isArray(value) || value.length > maxChartComparisons) {
    throw new TypeError(`Chart comparisons must be an array of at most ${maxChartComparisons} items`);
  }
  const ids = new Set<string>();
  return Object.freeze(value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new TypeError(`Chart comparison ${index} must be an object`);
    }
    const input = item as Record<string, unknown>;
    if (Object.keys(input).some((key) => !["symbol", "color", "visible"].includes(key))) {
      throw new TypeError(`Chart comparison ${index} contains unsupported fields`);
    }
    const symbol = parseChartSymbol(input.symbol);
    if (symbol === undefined || symbol.id === mainSymbol.id || ids.has(symbol.id)) {
      throw new TypeError(`Chart comparison ${index} symbol is invalid or duplicated`);
    }
    ids.add(symbol.id);
    if (input.color !== undefined && (
      typeof input.color !== "string" ||
      !comparisonColor.test(input.color)
    )) {
      throw new TypeError(`Chart comparison ${index} color must be a six-digit hex color`);
    }
    if (input.visible !== undefined && typeof input.visible !== "boolean") {
      throw new TypeError(`Chart comparison ${index} visibility must be boolean`);
    }
    return Object.freeze({
      symbol: Object.freeze(symbol),
      color: input.color === undefined
        ? chartComparisonColors[index % chartComparisonColors.length]
        : input.color as string,
      visible: input.visible ?? true
    });
  }));
}
