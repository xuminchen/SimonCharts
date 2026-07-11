import type { ViewportState, VisibleRange } from "../model/runtime";

const defaultCandleWidth = 8;
const minCandleWidth = 2;
const maxCandleWidth = 48;
const wheelZoomFactor = 1.25;

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

  if (candleCount <= visibleCount) {
    return { from: 0, to: candleCount - 1 };
  }

  const maxScrollOffset = Math.max(0, candleCount - visibleCount);
  const scrollOffset = Math.min(maxScrollOffset, Math.max(0, Math.floor(viewport.scrollOffset)));
  const to = Math.max(0, candleCount - 1 - scrollOffset);
  const from = Math.max(0, to - visibleCount + 1);

  return { from, to };
}

export function indexToX(index: number, viewport: ViewportState, plotLeft: number): number {
  const candleWidth = normalizeCandleWidth(viewport);

  return plotLeft + (index - viewport.visibleRange.from) * candleWidth + candleWidth / 2;
}

export function xToIndex(x: number, viewport: ViewportState, plotLeft: number): number {
  const candleWidth = normalizeCandleWidth(viewport);

  return viewport.visibleRange.from + Math.floor((x - plotLeft) / candleWidth);
}

export function zoomViewportAtIndex(
  viewport: ViewportState,
  anchorIndex: number,
  deltaY: number,
  candleCount: number
): ViewportState {
  if (candleCount <= 0) {
    return {
      ...viewport,
      visibleRange: { from: 0, to: -1 },
      scrollOffset: 0
    };
  }

  const candleWidth = normalizeCandleWidth(viewport);
  const nextCandleWidth = clampCandleWidth(
    deltaY < 0 ? candleWidth * wheelZoomFactor : candleWidth / wheelZoomFactor
  );
  const visibleCount = getVisibleCount(viewport, candleCount);
  const plotWidth = visibleCount * candleWidth;
  const nextVisibleCount = Math.max(1, Math.min(candleCount, Math.ceil(plotWidth / nextCandleWidth)));
  const anchorRatio = clamp(
    (anchorIndex - viewport.visibleRange.from + 0.5) / Math.max(1, visibleCount),
    0,
    1
  );
  const nextFrom = clamp(
    Math.round(anchorIndex + 0.5 - anchorRatio * nextVisibleCount),
    0,
    Math.max(0, candleCount - nextVisibleCount)
  );
  const nextTo = nextFrom + nextVisibleCount - 1;

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
  const visibleCount = getVisibleCount(viewport, candleCount);
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
  return Math.max(1, viewport.candleWidth);
}

function clampCandleWidth(candleWidth: number): number {
  return clamp(candleWidth, minCandleWidth, maxCandleWidth);
}

function getVisibleCount(viewport: ViewportState, candleCount: number): number {
  const visibleCount = viewport.visibleRange.to - viewport.visibleRange.from + 1;

  if (visibleCount <= 0) {
    return Math.min(candleCount, 1);
  }

  return Math.max(1, Math.min(candleCount, visibleCount));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
