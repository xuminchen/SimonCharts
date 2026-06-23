import type { CandleSeries } from "../../../model/market";
import type { IndicatorPoint } from "../../../model/visual";
import { formatVisualValue } from "../../../visuals/visualTooltip";
import type {
  VisualAutoscaleRange,
  VisualHitTestResult,
  VisualRenderer,
  VisualRenderContext,
  VisualTooltipRow
} from "../../../visuals/visualTypes";
import { indexToX, priceToY } from "../../../viewport/viewport";

export interface VisibleValuePoint {
  index: number;
  time: number;
  value: number;
}

export function createVisualRenderer(
  type: VisualRenderer["type"],
  render: VisualRenderer["render"],
  getAutoscale: VisualRenderer["getAutoscale"]
): VisualRenderer {
  return {
    type,
    render,
    getAutoscale,
    hitTest() {
      return undefined;
    },
    getTooltipRows: getDefaultVisualTooltipRows
  };
}

export function withPanelPlotClip(context: VisualRenderContext, draw: () => void): void {
  const plot = context.panel.plotArea;

  if (plot.width <= 0 || plot.height <= 0) {
    return;
  }

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

export function getAutoscaleFromValues(
  values: Array<number | null | undefined>
): VisualAutoscaleRange | undefined {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!isFiniteNumber(value)) {
      continue;
    }

    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : undefined;
}

export function getAutoscaleFromIndicatorPoints(
  points: IndicatorPoint[]
): VisualAutoscaleRange | undefined {
  return getAutoscaleFromValues(points.map((point) => point.value));
}

export function createTimeIndex(series: CandleSeries): Map<number, number> {
  const indexByTime = new Map<number, number>();

  series.candles.forEach((candle, index) => {
    indexByTime.set(candle.time, index);
  });

  return indexByTime;
}

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isVisibleIndex(context: VisualRenderContext, index: number): boolean {
  return index >= context.state.viewport.visibleRange.from && index <= context.state.viewport.visibleRange.to;
}

export function xForVisualIndex(context: VisualRenderContext, index: number): number {
  return indexToX(index, context.state.viewport, context.panel.plotArea.x);
}

export function yForVisualValue(
  context: VisualRenderContext,
  range: VisualAutoscaleRange,
  value: number
): number {
  return priceToY(
    value,
    range,
    context.panel.plotArea.y,
    context.panel.plotArea.height,
    context.state.viewport.priceScaleMode
  );
}

export function getPaddedRange(range: VisualAutoscaleRange): VisualAutoscaleRange {
  const span = range.max - range.min;
  const padding = span === 0 ? Math.max(Math.abs(range.max), 1) * 0.05 : span * 0.05;

  return {
    min: range.min - padding,
    max: range.max + padding
  };
}

export function getVisibleIndicatorPoint(
  context: VisualRenderContext,
  indexByTime: Map<number, number>,
  point: IndicatorPoint
): VisibleValuePoint | undefined {
  if (!isFiniteNumber(point.value)) {
    return undefined;
  }

  const index = indexByTime.get(point.time);

  if (index === undefined || !isVisibleIndex(context, index)) {
    return undefined;
  }

  return {
    index,
    time: point.time,
    value: point.value
  };
}

export function getDefaultVisualTooltipRows(hit: VisualHitTestResult): VisualTooltipRow[] {
  const rows: VisualTooltipRow[] = [{ label: "Time", value: String(hit.time) }];

  if (isFiniteNumber(hit.value)) {
    rows.push({ label: "Value", value: formatVisualValue(hit.value) });
  }

  return rows;
}
