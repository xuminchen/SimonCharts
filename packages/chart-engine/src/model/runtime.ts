import type { Timeframe } from "./market";
import type { ChartMark, DrawingObject } from "./visual";

export type PriceScaleMode = "linear" | "log" | "percent";

export interface VisibleRange {
  from: number;
  to: number;
}

export interface ViewportState {
  visibleRange: VisibleRange;
  candleWidth: number;
  scrollOffset: number;
  priceScaleMode: PriceScaleMode;
}

export interface ChartCrosshairState {
  index: number;
  time: number;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export type ChartCommand =
  | { type: "resetViewport" }
  | { type: "setSymbol"; symbol: string }
  | { type: "setTimeframe"; timeframe: Timeframe }
  | { type: "setPriceScaleMode"; mode: PriceScaleMode }
  | { type: "toggleIndicator"; indicatorId: string }
  | { type: "selectDrawing"; drawingId: string }
  | { type: "deleteDrawing"; drawingId: string };

export type ChartEvent =
  | { type: "viewportChanged"; viewport: ViewportState; visibleRange: VisibleRange }
  | { type: "crosshairMoved"; crosshair: ChartCrosshairState | undefined }
  | { type: "markClicked"; mark: ChartMark }
  | { type: "drawingChanged"; drawing: DrawingObject }
  | { type: "command"; command: ChartCommand };
