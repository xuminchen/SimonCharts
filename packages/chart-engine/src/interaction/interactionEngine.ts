import type { Candle, CandleSeries } from "../model/market";
import type { ChartCrosshairState, ChartEvent, ViewportState } from "../model/runtime";
import type { PriceScale } from "../viewport/priceScale";
import {
  panViewportByPixels,
  resetViewportToLatest,
  zoomViewportAtIndex,
  type TimeCoordinateMap
} from "../viewport/viewport";
import { hitTestCandleAtX, priceAtY } from "./hitTest";

export type CrosshairState = ChartCrosshairState;

export interface InteractionState {
  viewport: ViewportState;
  crosshair?: CrosshairState;
  isDragging: boolean;
}

export type InteractionEvent =
  | Extract<ChartEvent, { type: "viewportChanged" }>
  | Extract<ChartEvent, { type: "crosshairMoved" }>;

export interface InteractionPointInput {
  x: number;
  y?: number;
}

export interface InteractionWheelInput {
  x: number;
  deltaY: number;
}

export interface CreateInteractionEngineOptions {
  series: CandleSeries;
  width: number;
  plotHeight: number;
  viewport?: ViewportState;
  priceScale: PriceScale;
  plotLeft?: number;
  plotTop?: number;
  timeCoordinates?: TimeCoordinateMap;
  onEvent?: (event: InteractionEvent) => void;
}

export interface InteractionEngine {
  handleWheel(input: InteractionWheelInput): void;
  handlePointerDown(input: InteractionPointInput): void;
  handlePointerMove(input: InteractionPointInput): void;
  handlePointerUp(input: InteractionPointInput): void;
  resetView(): void;
  setPriceScale(priceScale: PriceScale): void;
  getViewport(): ViewportState;
  getCrosshair(): CrosshairState | undefined;
  getState(): InteractionState;
}

export function createInteractionEngine(options: CreateInteractionEngineOptions): InteractionEngine {
  const series = options.series;
  const width = options.width;
  const plotLeft = options.plotLeft ?? 0;
  const plotTop = options.plotTop ?? 0;
  const plotHeight = options.plotHeight;
  const onEvent = options.onEvent;
  const timeCoordinates = options.timeCoordinates;

  let viewport =
    options.viewport ?? resetViewportToLatest(series.candles.length, Math.max(0, width));
  let priceScale = options.priceScale;
  let crosshair: CrosshairState | undefined;
  let dragStartX: number | undefined;
  let dragStartViewport: ViewportState | undefined;

  function emitViewportChanged(): void {
    onEvent?.({
      type: "viewportChanged",
      viewport,
      visibleRange: viewport.visibleRange
    });
  }

  function updateViewport(nextViewport: ViewportState): boolean {
    if (isSameViewport(viewport, nextViewport)) {
      return false;
    }

    viewport = nextViewport;
    emitViewportChanged();
    return true;
  }

  function clearCrosshair(): void {
    if (!crosshair) {
      return;
    }

    crosshair = undefined;
    onEvent?.({ type: "crosshairMoved", crosshair });
  }

  function updateCrosshair(input: InteractionPointInput): void {
    if (input.y === undefined) {
      clearCrosshair();
      return;
    }

    if (input.y < plotTop || input.y > plotTop + plotHeight) {
      clearCrosshair();
      return;
    }

    const hit = hitTestCandleAtX(series, viewport, input.x, plotLeft, timeCoordinates);

    if (!hit) {
      clearCrosshair();
      return;
    }

    const price = priceAtY(
      input.y,
      priceScale,
      plotTop,
      plotHeight
    );

    crosshair = createCrosshairState(hit.index, hit.candle, price);
    onEvent?.({ type: "crosshairMoved", crosshair });
  }

  return {
    handleWheel(input) {
      if (input.deltaY === 0) {
        return;
      }

      const hit = hitTestCandleAtX(series, viewport, input.x, plotLeft, timeCoordinates);

      if (!hit) {
        return;
      }

      const changed = updateViewport(
        zoomViewportAtIndex(viewport, hit.index, input.deltaY, series.candles.length, width)
      );

      if (changed) {
        clearCrosshair();
      }
    },
    handlePointerDown(input) {
      dragStartX = input.x;
      dragStartViewport = viewport;
    },
    handlePointerMove(input) {
      if (dragStartX !== undefined && dragStartViewport !== undefined) {
        updateViewport(
          panViewportByPixels(dragStartViewport, input.x - dragStartX, series.candles.length)
        );
      }

      updateCrosshair(input);
    },
    handlePointerUp(input) {
      if (dragStartX !== undefined && dragStartViewport !== undefined) {
        updateViewport(
          panViewportByPixels(dragStartViewport, input.x - dragStartX, series.candles.length)
        );
      }

      dragStartX = undefined;
      dragStartViewport = undefined;
    },
    resetView() {
      updateViewport(resetViewportToLatest(series.candles.length, width));
      clearCrosshair();
    },
    setPriceScale(nextPriceScale) {
      priceScale = nextPriceScale;
    },
    getViewport() {
      return viewport;
    },
    getCrosshair() {
      return crosshair;
    },
    getState() {
      return {
        viewport,
        crosshair,
        isDragging: dragStartX !== undefined && dragStartViewport !== undefined
      };
    }
  };
}

function createCrosshairState(index: number, candle: Candle, price: number): CrosshairState {
  return {
    index,
    time: candle.time,
    price,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    turnover: candle.turnover
  };
}

function isSameViewport(left: ViewportState, right: ViewportState): boolean {
  return (
    left.candleWidth === right.candleWidth &&
    left.scrollOffset === right.scrollOffset &&
    left.priceScaleMode === right.priceScaleMode &&
    left.visibleRange.from === right.visibleRange.from &&
    left.visibleRange.to === right.visibleRange.to
  );
}
