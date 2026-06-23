import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel, SeriesRenderPoint } from "../seriesTypes";

export interface LineBreakTransformOptions {
  lineCount: number;
}

export function transformLineBreak(
  series: CandleSeries,
  options: LineBreakTransformOptions
): SeriesRenderModel {
  assertPositiveInteger(options.lineCount, "lineCount");

  const first = series.candles[0];
  const points: SeriesRenderPoint[] = first
    ? [
        {
          time: first.time,
          open: first.close,
          high: first.close,
          low: first.close,
          close: first.close,
          volume: first.volume,
          turnover: first.turnover,
          sourceIndex: 0
        }
      ]
    : [];

  for (let sourceIndex = 1; sourceIndex < series.candles.length; sourceIndex += 1) {
    const candle = series.candles[sourceIndex];
    const recent = points.slice(-options.lineCount);
    const recentHigh = Math.max(...recent.map((point) => point.close));
    const recentLow = Math.min(...recent.map((point) => point.close));

    if (candle.close > recentHigh || candle.close < recentLow) {
      const previousClose = points[points.length - 1].close;
      points.push({
        time: candle.time,
        open: previousClose,
        high: Math.max(previousClose, candle.close),
        low: Math.min(previousClose, candle.close),
        close: candle.close,
        volume: candle.volume,
        turnover: candle.turnover,
        sourceIndex
      });
    }
  }

  return {
    type: "lineBreak",
    source: series,
    points
  };
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}
