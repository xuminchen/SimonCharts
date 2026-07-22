import { getSeriesAutoscaleRange } from "../../../series/autoscale";
import { getDefaultSeriesTooltipRows } from "../../../series/tooltip";
import type {
  SeriesRenderer,
  SeriesRendererContext,
  SeriesRenderModel,
  SeriesRenderPoint,
  SeriesType
} from "../../../series/seriesTypes";
import { priceToY } from "../../../viewport/priceScale";
import { indexToX } from "../../../viewport/viewport";

export interface VisibleRenderBounds {
  from: number;
  to: number;
}

export interface PriceRange {
  min: number;
  max: number;
}

export function createRenderer(
  type: SeriesType,
  render: SeriesRenderer["render"]
): SeriesRenderer {
  return {
    type,
    render,
    getAutoscale(model) {
      return getSeriesAutoscaleRange(model, { from: 0, to: model.points.length - 1 });
    },
    hitTest() {
      return undefined;
    },
    getTooltipRows: getDefaultSeriesTooltipRows
  };
}

export function getVisibleBounds(context: SeriesRendererContext): VisibleRenderBounds | undefined {
  const { layout, model, state } = context;

  if (
    model.points.length <= 0 ||
    state.viewport.visibleRange.from > state.viewport.visibleRange.to ||
    layout.plotArea.width <= 0 ||
    layout.plotArea.height <= 0
  ) {
    return undefined;
  }

  const lastIndex = model.points.length - 1;
  const from = Math.max(0, state.viewport.visibleRange.from);
  const to = Math.min(lastIndex, state.viewport.visibleRange.to);

  return from <= to ? { from, to } : undefined;
}

export function getVisiblePriceRange(
  model: SeriesRenderModel,
  bounds: VisibleRenderBounds
): PriceRange {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = bounds.from; index <= bounds.to; index += 1) {
    const point = model.points[index];
    const low = point.low ?? point.close;
    const high = point.high ?? point.close;

    min = Math.min(min, low, point.close);
    max = Math.max(max, high, point.close);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }

  const span = max - min;
  const padding = span === 0 ? Math.max(Math.abs(max), 1) * 0.05 : span * 0.05;

  return {
    min: min - padding,
    max: max + padding
  };
}

export function xForIndex(context: SeriesRendererContext, index: number): number {
  return indexToX(
    index,
    context.state.viewport,
    context.layout.plotArea.x,
    context.state.timeCoordinates
  );
}

export function yForPrice(
  context: SeriesRendererContext,
  _range: PriceRange,
  price: number
): number {
  return priceToY(
    price,
    context.state.priceScale,
    context.layout.plotArea.y,
    context.layout.plotArea.height
  );
}

export function bodyWidth(context: SeriesRendererContext): number {
  return Math.max(
    1,
    context.state.timeCoordinates?.barWidth ?? context.state.viewport.candleWidth * 0.7
  );
}

export function pointColor(context: SeriesRendererContext, point: SeriesRenderPoint): string {
  const open = point.open ?? point.close;

  return point.close >= open
    ? context.state.theme.colors.bullishCandle
    : context.state.theme.colors.bearishCandle;
}

export function withPlotClip(context: SeriesRendererContext, draw: () => void): void {
  const plot = context.layout.plotArea;

  context.context.save();
  try {
    context.context.beginPath();
    context.context.rect(plot.x, plot.y, plot.width, plot.height);
    context.context.clip();
    draw();
  } finally {
    context.context.restore();
  }
}
