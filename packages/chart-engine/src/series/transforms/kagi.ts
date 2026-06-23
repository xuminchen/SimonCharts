import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel, SeriesRenderPoint } from "../seriesTypes";

export interface KagiTransformOptions {
  reversalAmount: number;
}

type KagiDirection = "up" | "down";

export function transformKagi(
  series: CandleSeries,
  options: KagiTransformOptions
): SeriesRenderModel {
  assertPositiveNumber(options.reversalAmount, "reversalAmount");

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

  if (!first) {
    return { type: "kagi", source: series, points };
  }

  let direction: KagiDirection | undefined;
  let extreme = first.close;

  for (let sourceIndex = 1; sourceIndex < series.candles.length; sourceIndex += 1) {
    const candle = series.candles[sourceIndex];
    const previousClose = points[points.length - 1].close;

    if (!direction) {
      if (candle.close === extreme) {
        continue;
      }

      direction = candle.close > extreme ? "up" : "down";
      extreme = candle.close;
      points.push(
        createKagiPoint(candle.time, previousClose, candle.close, candle.volume, candle.turnover, sourceIndex)
      );
      continue;
    }

    if (direction === "up") {
      if (candle.close > extreme) {
        extreme = candle.close;
        points.push(
          createKagiPoint(candle.time, previousClose, candle.close, candle.volume, candle.turnover, sourceIndex)
        );
      } else if (extreme - candle.close >= options.reversalAmount) {
        direction = "down";
        extreme = candle.close;
        points.push(
          createKagiPoint(candle.time, previousClose, candle.close, candle.volume, candle.turnover, sourceIndex)
        );
      }
    } else if (candle.close < extreme) {
      extreme = candle.close;
      points.push(
        createKagiPoint(candle.time, previousClose, candle.close, candle.volume, candle.turnover, sourceIndex)
      );
    } else if (candle.close - extreme >= options.reversalAmount) {
      direction = "up";
      extreme = candle.close;
      points.push(
        createKagiPoint(candle.time, previousClose, candle.close, candle.volume, candle.turnover, sourceIndex)
      );
    }
  }

  return {
    type: "kagi",
    source: series,
    points
  };
}

function createKagiPoint(
  time: number,
  open: number,
  close: number,
  volume: number,
  turnover: number,
  sourceIndex: number
): SeriesRenderPoint {
  return {
    time,
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    volume,
    turnover,
    sourceIndex
  };
}

function assertPositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}
