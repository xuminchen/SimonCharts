import type { IndicatorLineOutput, VisibleRange } from "@simoncharts/chart-engine";
import type { Candle, ChartComparison } from "../contracts";

export interface ComparisonProjectionInput {
  readonly comparison: Readonly<ChartComparison>;
  readonly mainCandles: readonly Readonly<Candle>[];
  readonly comparisonCandles: readonly Readonly<Candle>[];
  readonly visibleRange: Readonly<VisibleRange>;
  readonly previousClose?: number;
}

export function comparisonValueAtTime(
  candles: readonly Readonly<Candle>[],
  time: number
): number | undefined {
  let low = 0;
  let high = candles.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candle = candles[middle]!;
    if (candle.time === time) return candle.close;
    if (candle.time < time) low = middle + 1;
    else high = middle - 1;
  }
  return undefined;
}

export function comparisonBaseValue(input: ComparisonProjectionInput): number | undefined {
  if (
    input.previousClose !== undefined &&
    Number.isFinite(input.previousClose) &&
    input.previousClose > 0
  ) return input.previousClose;
  const from = Math.max(0, input.visibleRange.from);
  const to = Math.min(input.mainCandles.length - 1, input.visibleRange.to);
  return input.mainCandles
    .slice(from, to + 1)
    .map((item) => comparisonValueAtTime(input.comparisonCandles, item.time))
    .find((value) => value !== undefined && Number.isFinite(value) && value > 0);
}

export function createComparisonLineOutput(
  input: ComparisonProjectionInput
): IndicatorLineOutput {
  const from = Math.max(0, input.visibleRange.from);
  const to = Math.min(input.mainCandles.length - 1, input.visibleRange.to);
  const base = comparisonBaseValue(input);
  const validBase = base !== undefined && Number.isFinite(base) && base > 0;

  return {
    id: `comparison:${input.comparison.symbol.id}`,
    label: `${input.comparison.symbol.name} ${input.comparison.symbol.code}`,
    type: "line",
    panelId: "main",
    coordinateSpace: "percentage",
    visible: input.comparison.visible !== false,
    ...(input.comparison.color === undefined ? {} : { color: input.comparison.color }),
    values: input.mainCandles.slice(from, to + 1).map(({ time }) => {
      const value = comparisonValueAtTime(input.comparisonCandles, time);
      return {
        time,
        value: validBase && value !== undefined && Number.isFinite(value) && value > 0
          ? (value / base - 1) * 100
          : null
      };
    })
  };
}
