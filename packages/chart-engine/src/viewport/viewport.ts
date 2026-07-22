import type { ViewportState, VisibleRange } from "../model/runtime";

const defaultCandleWidth = 8;
const minCandleWidth = 0.05;
const minZoomCandleWidth = 2;
const maxCandleWidth = 48;
const wheelZoomFactor = 1.25;

export interface TimeCoordinateMap {
  readonly positions: readonly number[];
  readonly barWidth: number;
  readonly dayStartIndices: readonly number[];
  readonly dayStartOffsets: readonly number[];
}

export function createInitialViewport(candleCount: number, width: number): ViewportState {
  const viewport: ViewportState = {
    visibleRange: { from: 0, to: 0 },
    candleWidth: defaultCandleWidth,
    scrollOffset: 0,
    priceScaleMode: "linear"
  };

  return {
    ...viewport,
    visibleRange: computeVisibleRange(viewport, candleCount, width)
  };
}

export function computeVisibleRange(
  viewport: ViewportState,
  candleCount: number,
  width: number
): VisibleRange {
  if (candleCount <= 0) {
    return { from: 0, to: -1 };
  }

  const candleWidth = normalizeCandleWidth(viewport);
  const visibleCount = Math.max(1, Math.ceil(width / candleWidth));

  const maxScrollOffset = Math.max(0, candleCount - visibleCount);
  const scrollOffset = Math.min(maxScrollOffset, Math.max(0, Math.floor(viewport.scrollOffset)));
  const to = Math.max(0, candleCount - 1 - scrollOffset);
  const from = to - visibleCount + 1;

  return { from, to };
}

export function constrainViewportToWidth(
  viewport: ViewportState,
  candleCount: number,
  width: number
): ViewportState {
  if (candleCount <= 0) {
    return {
      ...viewport,
      visibleRange: { from: 0, to: -1 },
      scrollOffset: 0
    };
  }

  const plotWidth = Math.max(1, width);
  const visibleCount = getBoundedVisibleCount(viewport.candleWidth, candleCount, plotWidth);
  const maxScrollOffset = candleCount - visibleCount;
  const scrollOffset = clamp(Math.floor(viewport.scrollOffset), 0, maxScrollOffset);
  const to = candleCount - 1 - scrollOffset;

  return {
    ...viewport,
    candleWidth: plotWidth / visibleCount,
    scrollOffset,
    visibleRange: { from: to - visibleCount + 1, to }
  };
}

export function indexToX(
  index: number,
  viewport: ViewportState,
  plotLeft: number,
  timeCoordinates?: TimeCoordinateMap
): number {
  const mapped = timeCoordinates?.positions[index];
  if (mapped !== undefined && Number.isFinite(mapped)) return plotLeft + mapped;
  const candleWidth = normalizeCandleWidth(viewport);

  return plotLeft + (index - viewport.visibleRange.from) * candleWidth + candleWidth / 2;
}

export function xToIndex(
  x: number,
  viewport: ViewportState,
  plotLeft: number,
  timeCoordinates?: TimeCoordinateMap
): number {
  if (timeCoordinates !== undefined && timeCoordinates.positions.length > 0) {
    return nearestMappedIndex(x - plotLeft, timeCoordinates.positions);
  }
  const candleWidth = normalizeCandleWidth(viewport);

  return viewport.visibleRange.from + Math.floor((x - plotLeft) / candleWidth);
}

function nearestMappedIndex(x: number, positions: readonly number[]): number {
  if (x <= positions[0]!) return 0;
  const lastIndex = positions.length - 1;
  if (x >= positions[lastIndex]!) return lastIndex;

  let lower = 0;
  let upper = lastIndex;
  while (lower + 1 < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (positions[middle]! < x) lower = middle;
    else upper = middle;
  }

  return x - positions[lower]! < positions[upper]! - x ? lower : upper;
}

export function zoomViewportAtIndex(
  viewport: ViewportState,
  anchorIndex: number,
  deltaY: number,
  candleCount: number,
  plotWidth?: number
): ViewportState {
  if (candleCount <= 0) {
    return {
      ...viewport,
      visibleRange: { from: 0, to: -1 },
      scrollOffset: 0
    };
  }

  if (
    deltaY >= 0 &&
    viewport.visibleRange.from <= 0 &&
    viewport.visibleRange.to >= candleCount - 1
  ) {
    return viewport;
  }

  const candleWidth = normalizeCandleWidth(viewport);
  const requestedCandleWidth = clampCandleWidth(
    deltaY < 0 ? candleWidth * wheelZoomFactor : candleWidth / wheelZoomFactor
  );
  const visibleCount = getVisibleCount(viewport);
  const resolvedPlotWidth = Math.max(1, plotWidth ?? visibleCount * candleWidth);
  const nextVisibleCount = getBoundedVisibleCount(
    requestedCandleWidth,
    candleCount,
    resolvedPlotWidth
  );
  const nextCandleWidth = resolvedPlotWidth / nextVisibleCount;
  const anchorRatio = clamp(
    (anchorIndex - viewport.visibleRange.from + 0.5) / Math.max(1, visibleCount),
    0,
    1
  );
  const allCandlesVisible = nextVisibleCount >= candleCount;
  const alignedToLatest =
    viewport.scrollOffset === 0 && viewport.visibleRange.to >= candleCount - 1;
  const keepLatestAligned = allCandlesVisible || alignedToLatest;
  const nextFrom = keepLatestAligned
    ? candleCount - nextVisibleCount
    : clamp(
        Math.round(anchorIndex + 0.5 - anchorRatio * nextVisibleCount),
        0,
        candleCount - nextVisibleCount
      );
  const nextTo = keepLatestAligned
    ? candleCount - 1
    : nextFrom + nextVisibleCount - 1;

  return {
    ...viewport,
    candleWidth: nextCandleWidth,
    scrollOffset: candleCount - 1 - nextTo,
    visibleRange: { from: nextFrom, to: nextTo }
  };
}

export function panViewportByPixels(
  viewport: ViewportState,
  deltaX: number,
  candleCount: number
): ViewportState {
  if (candleCount <= 0) {
    return {
      ...viewport,
      visibleRange: { from: 0, to: -1 },
      scrollOffset: 0
    };
  }

  const candleDelta = Math.round(deltaX / normalizeCandleWidth(viewport));
  const visibleCount = getVisibleCount(viewport);
  if (visibleCount >= candleCount) {
    return {
      ...viewport,
      scrollOffset: 0,
      visibleRange: { from: candleCount - visibleCount, to: candleCount - 1 }
    };
  }
  const maxScrollOffset = Math.max(0, candleCount - visibleCount);
  const scrollOffset = clamp(Math.floor(viewport.scrollOffset) + candleDelta, 0, maxScrollOffset);
  const to = candleCount - 1 - scrollOffset;
  const from = Math.max(0, to - visibleCount + 1);

  return {
    ...viewport,
    scrollOffset,
    visibleRange: { from, to }
  };
}

export function resetViewportToLatest(candleCount: number, width: number): ViewportState {
  return createInitialViewport(candleCount, width);
}

function normalizeCandleWidth(viewport: ViewportState): number {
  return Math.max(minCandleWidth, viewport.candleWidth);
}

function clampCandleWidth(candleWidth: number): number {
  return clamp(candleWidth, minZoomCandleWidth, maxCandleWidth);
}

function getVisibleCount(viewport: ViewportState): number {
  const visibleCount = viewport.visibleRange.to - viewport.visibleRange.from + 1;

  if (visibleCount <= 0) {
    return 1;
  }

  return visibleCount;
}

function getBoundedVisibleCount(candleWidth: number, candleCount: number, width: number): number {
  const plotWidth = Math.max(1, width);
  const maximumVisibleCount = Math.min(
    candleCount,
    Math.max(1, Math.floor(plotWidth / minZoomCandleWidth))
  );
  const minimumVisibleCount = Math.min(
    candleCount,
    Math.max(1, Math.ceil(plotWidth / maxCandleWidth))
  );
  const requestedVisibleCount = Math.max(
    1,
    Math.ceil(plotWidth / clampCandleWidth(candleWidth) - 1e-9)
  );

  return clamp(requestedVisibleCount, minimumVisibleCount, maximumVisibleCount);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
