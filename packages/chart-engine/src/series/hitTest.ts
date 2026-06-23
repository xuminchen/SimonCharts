import type { Candle } from "../model/market";
import type { VisibleRange } from "../model/runtime";
import type { SeriesHitTestResult, SeriesRenderModel } from "./seriesTypes";

export interface SeriesHitTestInput {
  plotLeft: number;
  candleWidth: number;
  visibleRange: VisibleRange;
}

export function hitTestSeriesPoint(
  model: SeriesRenderModel,
  x: number,
  input: SeriesHitTestInput
): SeriesHitTestResult | undefined {
  const from = Math.max(0, input.visibleRange.from);
  const to = Math.min(model.points.length - 1, input.visibleRange.to);

  if (model.points.length === 0 || from > to || input.candleWidth <= 0) {
    return undefined;
  }

  const rawIndex = from + Math.floor((x - input.plotLeft) / input.candleWidth);
  if (rawIndex < from || rawIndex > to) {
    return undefined;
  }

  const point = model.points[rawIndex];
  const centerX = input.plotLeft + (rawIndex - from) * input.candleWidth + input.candleWidth / 2;
  const sourceCandle = getSourceCandle(model, point.sourceIndex);

  return {
    type: model.type,
    point,
    sourceCandle,
    distance: Math.abs(x - centerX)
  };
}

function getSourceCandle(model: SeriesRenderModel, sourceIndex: number | undefined): Candle | undefined {
  if (sourceIndex === undefined) {
    return undefined;
  }

  return model.source.candles[sourceIndex];
}
