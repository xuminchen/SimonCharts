import type { CandleSeries } from "../model/market";
import type { SeriesRenderModel, SeriesRenderPoint, SeriesType } from "./seriesTypes";

export function createSourceSeriesRenderModel(
  type: SeriesType,
  series: CandleSeries
): SeriesRenderModel {
  const points: SeriesRenderPoint[] = series.candles.map((candle, sourceIndex) => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    turnover: candle.turnover,
    sourceIndex
  }));

  return {
    type,
    source: series,
    sourceIndexOffset: 0,
    points
  };
}
