import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel, SeriesRenderPoint } from "../seriesTypes";

export function transformHeikinAshi(series: CandleSeries): SeriesRenderModel {
  const points: SeriesRenderPoint[] = [];
  let previousOpen: number | undefined;
  let previousClose: number | undefined;

  for (let sourceIndex = 0; sourceIndex < series.candles.length; sourceIndex += 1) {
    const candle = series.candles[sourceIndex];
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    const open =
      previousOpen === undefined || previousClose === undefined
        ? (candle.open + candle.close) / 2
        : (previousOpen + previousClose) / 2;
    const high = Math.max(candle.high, open, close);
    const low = Math.min(candle.low, open, close);

    points.push({
      time: candle.time,
      open,
      high,
      low,
      close,
      volume: candle.volume,
      turnover: candle.turnover,
      sourceIndex
    });

    previousOpen = open;
    previousClose = close;
  }

  return {
    type: "heikinAshi",
    source: series,
    points
  };
}
