import type { CandleSeries } from "../../../model/market";
import type { IndicatorPoint, IndicatorVisualOutput } from "../../../model/visual";
import { formatVisualValue } from "../../../visuals/visualTooltip";
import type {
  VisualAutoscaleRange,
  VisualHitTestContext,
  VisualHitTestResult,
  VisualRenderer,
  VisualRenderContext,
  VisualTooltipRow
} from "../../../visuals/visualTypes";
import type { TooltipFormattingContext } from "../../../series/seriesTypes";
import { priceToY } from "../../../viewport/priceScale";
import { indexToX } from "../../../viewport/viewport";

export interface VisibleValuePoint {
  index: number;
  time: number;
  value: number;
}

export interface VisualHitPoint {
  time: number;
  value?: number;
  x: number;
  y: number;
}

type VisualCoordinateContext = VisualRenderContext | VisualHitTestContext;

export function createVisualRenderer(
  type: VisualRenderer["type"],
  render: VisualRenderer["render"],
  getAutoscale: VisualRenderer["getAutoscale"],
  hitTest: VisualRenderer["hitTest"] = () => undefined
): VisualRenderer {
  return {
    type,
    render,
    getAutoscale,
    hitTest,
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

export function isRenderableVisualValue(
  context: VisualCoordinateContext,
  value: number | null | undefined
): value is number {
  return isFiniteNumber(value) && !(context.valueScale.mode === "log" && value <= 0);
}

export function isVisibleIndex(context: VisualCoordinateContext, index: number): boolean {
  return index >= context.state.viewport.visibleRange.from && index <= context.state.viewport.visibleRange.to;
}

export function xForVisualIndex(context: VisualCoordinateContext, index: number): number {
  return indexToX(index, context.state.viewport, context.panel.plotArea.x);
}

export function yForVisualValue(
  context: VisualCoordinateContext,
  _range: VisualAutoscaleRange,
  value: number
): number {
  return priceToY(
    value,
    context.valueScale,
    context.panel.plotArea.y,
    context.panel.plotArea.height
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

export function getVisualRenderRange(
  context: VisualCoordinateContext,
  fallbackRange: VisualAutoscaleRange
): VisualAutoscaleRange {
  return getPaddedRange(context.valueRange ?? fallbackRange);
}

export function getVisibleIndicatorPoint(
  context: VisualCoordinateContext,
  indexByTime: Map<number, number>,
  point: IndicatorPoint
): VisibleValuePoint | undefined {
  if (!isRenderableVisualValue(context, point.value)) {
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

export function getNearestVisualHit(
  output: IndicatorVisualOutput,
  x: number,
  y: number,
  points: VisualHitPoint[]
): VisualHitTestResult | undefined {
  let nearestHit: VisualHitTestResult | undefined;

  for (const point of points) {
    const distance = Math.hypot(x - point.x, y - point.y);

    if (!Number.isFinite(distance)) {
      continue;
    }

    if (!nearestHit || distance < nearestHit.distance) {
      nearestHit = {
        outputId: output.id,
        outputType: output.type,
        time: point.time,
        value: point.value,
        distance
      };
    }
  }

  return nearestHit;
}

export function getDefaultVisualTooltipRows(
  hit: VisualHitTestResult,
  formatting: TooltipFormattingContext
): VisualTooltipRow[] {
  const rows: VisualTooltipRow[] = [
    { label: "Time", value: formatting.formatTime(hit.time, formatting.timeframe) }
  ];

  if (isFiniteNumber(hit.value)) {
    rows.push({ label: "Value", value: formatVisualValue(hit.value) });
  }

  return rows;
}
