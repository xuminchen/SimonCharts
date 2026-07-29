import type { CandleSeries } from "../model/market";
import type { MovingAveragePoint } from "../indicators/movingAverage";
import type { PriceScaleMode, VisibleRange } from "../model/runtime";
import type { IndicatorVisualOutput } from "../model/visual";
import { computeVisiblePriceBounds } from "../viewport/priceRange";
import {
  createPriceScaleFromBounds,
  priceToScaleValue,
  scaleValueToPrice,
  type PriceScale
} from "../viewport/priceScale";

export function createMainPanelPriceScale(
  series: CandleSeries,
  visibleRange: VisibleRange,
  mode: PriceScaleMode,
  visualOutputs: readonly IndicatorVisualOutput[],
  movingAverages: readonly (readonly MovingAveragePoint[])[],
  additionalPrices: readonly number[] = [],
  percentageBasePrice?: number
): PriceScale {
  const rawBounds = computeVisiblePriceBounds(series, visibleRange);
  const indexByTime = new Map(series.candles.map((candle, index) => [candle.time, index]));
  const lastIndex = series.candles.length - 1;
  const from = Math.max(0, Math.min(lastIndex, visibleRange.from));
  const to = Math.max(from, Math.min(lastIndex, visibleRange.to));
  const firstVisibleCandle = series.candles[from];
  if (
    mode === "percentage" &&
    percentageBasePrice !== undefined &&
    (!Number.isFinite(percentageBasePrice) || percentageBasePrice <= 0)
  ) {
    throw new Error("Percentage price scale requires a finite positive base price");
  }
  const basePrice =
    mode === "percentage" && percentageBasePrice !== undefined
      ? percentageBasePrice
      : firstVisibleCandle?.close ?? 1;
  const percentageValues: number[] = [];

  for (const output of visualOutputs) {
    if (output.visible === false || (output.panelId !== undefined && output.panelId !== "main")) {
      continue;
    }

    if (output.coordinateSpace === "percentage") {
      if (mode !== "percentage") continue;
      for (const point of getOutputValues(output)) {
        const index =
          typeof point.index === "number" && Number.isFinite(point.index)
            ? point.index
            : indexByTime.get(point.time);
        if (
          index !== undefined &&
          index >= from &&
          index <= to &&
          Number.isFinite(point.value)
        ) percentageValues.push(point.value);
      }
      continue;
    }

    for (const point of getOutputValues(output)) {
      const index =
        typeof point.index === "number" && Number.isFinite(point.index)
          ? point.index
          : indexByTime.get(point.time);

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

  for (let index = 0; index < additionalPrices.length; index += 2) {
    const prices = additionalPrices.slice(index, index + 2);
    if (
      prices.length !== 2 ||
      prices.some((price) => !Number.isFinite(price) || (mode === "log" && price <= 0))
    ) continue;
    const nextBounds = {
      min: Math.min(rawBounds.min, ...prices),
      max: Math.max(rawBounds.max, ...prices)
    };
    if (createSafePriceScale(nextBounds, basePrice, mode) === undefined) continue;
    rawBounds.min = nextBounds.min;
    rawBounds.max = nextBounds.max;
  }

  return (
    createSafePriceScale(rawBounds, basePrice, mode, percentageValues) ??
    createSafePriceScale(rawBounds, firstVisibleCandle?.close ?? 1, "linear")!
  );
}

function createSafePriceScale(
  bounds: { min: number; max: number },
  basePrice: number,
  mode: PriceScaleMode,
  scaleValues: readonly number[] = []
): PriceScale | undefined {
  if (mode === "percentage" && scaleValues.length > 0) {
    const provisional: PriceScale = { mode, basePrice, min: 0, max: 1 };
    const min = Math.min(priceToScaleValue(bounds.min, provisional), ...scaleValues);
    const max = Math.max(priceToScaleValue(bounds.max, provisional), ...scaleValues);
    const span = max - min;
    const padding = span === 0 ? Math.max(Math.abs(max), 1) * 0.05 : span * 0.05;
    const combined = { ...provisional, min: min - padding, max: max + padding };
    return isFinitePriceScale(combined) ? combined : undefined;
  }
  const padded = createPriceScaleFromBounds(bounds, basePrice, mode);
  if (isFinitePriceScale(padded)) return padded;

  const provisional: PriceScale = { mode, basePrice, min: 0, max: 1 };
  const unpadded: PriceScale = {
    mode,
    basePrice,
    min: priceToScaleValue(bounds.min, provisional),
    max: priceToScaleValue(bounds.max, provisional)
  };
  return isFinitePriceScale(unpadded) ? unpadded : undefined;
}

function isFinitePriceScale(scale: PriceScale): boolean {
  return (
    Number.isFinite(scale.min) &&
    Number.isFinite(scale.max) &&
    Number.isFinite(scale.max - scale.min) &&
    Number.isFinite(scaleValueToPrice(scale.min, scale)) &&
    Number.isFinite(scaleValueToPrice(scale.max, scale))
  );
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
