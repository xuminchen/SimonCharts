import type { Candle, CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import { yToPrice, type PriceScale } from "../viewport/priceScale";
import { xToIndex, type TimeCoordinateMap } from "../viewport/viewport";

export function hitTestCandleAtX(
  series: CandleSeries,
  viewport: ViewportState,
  x: number,
  plotLeft: number,
  timeCoordinates?: TimeCoordinateMap
): { index: number; candle: Candle } | undefined {
  const candleCount = series.candles.length;
  const rawVisibleCount = viewport.visibleRange.to - viewport.visibleRange.from + 1;

  if (candleCount <= 0 || rawVisibleCount <= 0) {
    return undefined;
  }

  const lastIndex = candleCount - 1;
  const rawFrom = viewport.visibleRange.from;
  const rawTo = viewport.visibleRange.to;

  if (rawTo < 0 || rawFrom > lastIndex) {
    return undefined;
  }

  const visibleFrom = Math.max(0, rawFrom);
  const visibleTo = Math.min(lastIndex, rawTo);

  if (visibleFrom > visibleTo) {
    return undefined;
  }

  const offsetX = x - plotLeft;
  const index = xToIndex(x, viewport, plotLeft, timeCoordinates);

  const firstX = timeCoordinates?.positions[visibleFrom];
  const lastX = timeCoordinates?.positions[visibleTo];
  const halfBar = (timeCoordinates?.barWidth ?? viewport.candleWidth) / 2;
  if (
    offsetX < 0 ||
    (firstX !== undefined && offsetX < firstX - halfBar) ||
    (lastX !== undefined && offsetX > lastX + halfBar) ||
    index < visibleFrom ||
    index > visibleTo
  ) {
    return undefined;
  }

  return {
    index,
    candle: series.candles[index]
  };
}

export function priceAtY(
  y: number,
  priceScale: PriceScale,
  plotTop: number,
  plotHeight: number
): number {
  return yToPrice(y, priceScale, plotTop, plotHeight);
}
