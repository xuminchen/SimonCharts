import type { VisibleRange } from "../model/runtime";
import type { SeriesAutoscaleRange, SeriesRenderModel } from "./seriesTypes";

export function getSeriesAutoscaleRange(
  model: SeriesRenderModel,
  visibleRange: VisibleRange
): SeriesAutoscaleRange | undefined {
  const from = Math.max(0, visibleRange.from);
  const to = Math.min(model.points.length - 1, visibleRange.to);

  if (model.points.length === 0 || from > to) {
    return undefined;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = from; index <= to; index += 1) {
    const point = model.points[index];
    const low = point.low ?? point.close;
    const high = point.high ?? point.close;

    min = Math.min(min, low, point.close);
    max = Math.max(max, high, point.close);
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : undefined;
}
