import type { CandleSeries } from "../model/market";
import type { VisibleRange } from "../model/runtime";

export function computeVisiblePriceRange(
  series: CandleSeries,
  visibleRange: VisibleRange
): { min: number; max: number } {
  const lastIndex = series.candles.length - 1;

  if (lastIndex < 0) {
    return { min: 0, max: 1 };
  }

  const from = Math.max(0, Math.min(lastIndex, visibleRange.from));
  const to = Math.max(from, Math.min(lastIndex, visibleRange.to));
  let min = series.candles[from].low;
  let max = series.candles[from].high;

  for (let index = from + 1; index <= to; index += 1) {
    const candle = series.candles[index];

    min = Math.min(min, candle.low);
    max = Math.max(max, candle.high);
  }

  const span = max - min;
  const padding = span === 0 ? Math.max(Math.abs(max), 1) * 0.05 : span * 0.05;

  return {
    min: min - padding,
    max: max + padding
  };
}
