import type { CandleSeries } from "../model/market";
import type { MovingAveragePoint } from "../indicators/movingAverage";
import type { PriceScaleMode, VisibleRange } from "../model/runtime";
import type { IndicatorVisualOutput } from "../model/visual";
import { computeVisiblePriceBounds } from "../viewport/priceRange";
import {
  createPriceScaleFromBounds,
  type PriceScale
} from "../viewport/priceScale";

export function createMainPanelPriceScale(
  series: CandleSeries,
  visibleRange: VisibleRange,
  mode: PriceScaleMode,
  visualOutputs: readonly IndicatorVisualOutput[],
  movingAverages: readonly (readonly MovingAveragePoint[])[]
): PriceScale {
  const rawBounds = computeVisiblePriceBounds(series, visibleRange);
  const indexByTime = new Map(series.candles.map((candle, index) => [candle.time, index]));
  const lastIndex = series.candles.length - 1;
  const from = Math.max(0, Math.min(lastIndex, visibleRange.from));
  const to = Math.max(from, Math.min(lastIndex, visibleRange.to));

  for (const output of visualOutputs) {
    if (output.visible === false || (output.panelId !== undefined && output.panelId !== "main")) {
      continue;
    }

    for (const point of getOutputValues(output)) {
      const index = point.index ?? indexByTime.get(point.time);

      if (
        index === undefined ||
        index < from ||
        index > to ||
        !Number.isFinite(point.value) ||
        (mode === "log" && point.value <= 0)
      ) {
        continue;
      }

      rawBounds.min = Math.min(rawBounds.min, point.value);
      rawBounds.max = Math.max(rawBounds.max, point.value);
    }
  }

  for (const points of movingAverages) {
    for (let index = from; index <= to; index += 1) {
      const value = points[index]?.value;

      if (
        value === undefined ||
        !Number.isFinite(value) ||
        (mode === "log" && value <= 0)
      ) {
        continue;
      }

      rawBounds.min = Math.min(rawBounds.min, value);
      rawBounds.max = Math.max(rawBounds.max, value);
    }
  }

  const firstVisibleCandle = series.candles[from];

  return createPriceScaleFromBounds(rawBounds, firstVisibleCandle?.close ?? 1, mode);
}

function getOutputValues(
  output: IndicatorVisualOutput
): Array<{ time: number; value: number; index?: number }> {
  if (output.type === "line") {
    return output.values.map((point) => ({ time: point.time, value: point.value ?? Number.NaN }));
  }

  if (output.type === "histogram") {
    return output.values.map((point) => ({ time: point.time, value: point.value }));
  }

  if (output.type === "band") {
    return [...output.upper, ...output.lower].map((point) => ({
      time: point.time,
      value: point.value ?? Number.NaN
    }));
  }

  return output.marks.map((mark) => ({
    time: mark.time,
    value: mark.price ?? Number.NaN,
    index: mark.index
  }));
}
