import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel, SeriesRenderPoint } from "../seriesTypes";

export interface RenkoTransformOptions {
  brickSize: number;
}

export function transformRenko(
  series: CandleSeries,
  options: RenkoTransformOptions
): SeriesRenderModel {
  assertPositiveNumber(options.brickSize, "brickSize");

  const points: SeriesRenderPoint[] = [];
  const first = series.candles[0];

  if (!first) {
    return { type: "renko", source: series, points };
  }

  let lastBrickClose = first.close;
  let rangeStart = 0;

  for (let sourceIndex = 1; sourceIndex < series.candles.length; sourceIndex += 1) {
    const candle = series.candles[sourceIndex];
    let move = candle.close - lastBrickClose;

    while (Math.abs(move) >= options.brickSize) {
      const direction = Math.sign(move);
      const open = lastBrickClose;
      const close = lastBrickClose + direction * options.brickSize;

      points.push({
        time: candle.time,
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        sourceIndex,
        sourceRange: { from: rangeStart, to: sourceIndex }
      });

      lastBrickClose = close;
      rangeStart = sourceIndex;
      move = candle.close - lastBrickClose;
    }
  }

  return {
    type: "renko",
    source: series,
    points
  };
}

function assertPositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}
