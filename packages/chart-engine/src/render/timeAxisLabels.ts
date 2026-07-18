import type { ViewportState } from "../model/runtime";
import { indexToX } from "../viewport/viewport";
import type { RenderState } from "./renderTypes";

const minimumTimeTickSpacing = 96;
const maximumTimeTickCount = 10;
const labelGap = 8;

export interface TimeAxisLabel {
  label: string;
  x: number;
  halfWidth: number;
}

export function getTimeAxisLabels(
  context: CanvasRenderingContext2D,
  state: RenderState
): TimeAxisLabel[] {
  const { layout, series, theme, viewport } = state;
  const { plotArea, timeAxisArea } = layout;
  const bounds = getVisibleBounds(viewport, series.candles.length);
  if (!bounds || timeAxisArea.width <= 0) return [];

  const labels: TimeAxisLabel[] = [];
  let previousLabel: string | undefined;
  for (const index of getTimeTickIndices(bounds, timeAxisArea.width)) {
    const candle = series.candles[index];
    if (!candle) continue;

    const label = formatTimeAxisLabel(
      state.formatTime(candle.time, series.timeframe),
      state.intradayDays
    );
    if (label === previousLabel) continue;
    previousLabel = label;
    const halfWidth = measureText(context, label, theme.typography.fontSize) / 2;
    const x = clamp(
      indexToX(index, viewport, plotArea.x),
      timeAxisArea.x + halfWidth,
      timeAxisArea.x + timeAxisArea.width - halfWidth
    );

    labels.push({ label, x, halfWidth });
  }

  return selectNonOverlappingTimeLabels(labels);
}

function formatTimeAxisLabel(label: string, intradayDays: number | undefined): string {
  if (intradayDays === undefined) return label;
  const separator = label.indexOf(" ");
  if (separator < 0) return label;
  return intradayDays === 1 ? label.slice(separator + 1) : label.slice(5, separator);
}

function selectNonOverlappingTimeLabels(labels: TimeAxisLabel[]): TimeAxisLabel[] {
  if (labels.length <= 1) return labels;
  const first = labels[0];
  const last = labels[labels.length - 1];
  if (first.x + first.halfWidth + labelGap > last.x - last.halfWidth) return [last];

  const selected = [first];
  let right = first.x + first.halfWidth;
  const reservedLastLeft = last.x - last.halfWidth;
  for (let index = 1; index < labels.length - 1; index += 1) {
    const label = labels[index];
    const left = label.x - label.halfWidth;
    const nextRight = label.x + label.halfWidth;
    if (left < right + labelGap || nextRight > reservedLastLeft - labelGap) continue;
    selected.push(label);
    right = nextRight;
  }
  selected.push(last);
  return selected;
}

function getTimeTickIndices(
  bounds: { from: number; to: number },
  width: number
): number[] {
  const candleCount = bounds.to - bounds.from + 1;
  if (candleCount <= 1) return [bounds.from];

  const tickCount = Math.min(
    candleCount,
    maximumTimeTickCount,
    Math.max(2, Math.floor(width / minimumTimeTickSpacing) + 1)
  );
  const indices = new Set<number>();
  for (let step = 0; step < tickCount; step += 1) {
    indices.add(
      Math.round(bounds.from + ((bounds.to - bounds.from) * step) / (tickCount - 1))
    );
  }
  return [...indices];
}

function measureText(
  context: CanvasRenderingContext2D,
  label: string,
  fontSize: number
): number {
  return typeof context.measureText === "function"
    ? context.measureText(label).width
    : label.length * fontSize * 0.6;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function getVisibleBounds(
  viewport: ViewportState,
  candleCount: number
): { from: number; to: number } | undefined {
  if (candleCount <= 0 || viewport.visibleRange.from > viewport.visibleRange.to) {
    return undefined;
  }

  const lastIndex = candleCount - 1;
  const from = Math.max(0, viewport.visibleRange.from);
  const to = Math.min(lastIndex, viewport.visibleRange.to);
  return from > to ? undefined : { from, to };
}
