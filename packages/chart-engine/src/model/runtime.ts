import type { ChartEngineCommand } from "../commands/chartCommands";
import type { DrawingObject } from "../drawing/drawingTypes";
import type { ChartMark } from "./visual";

export const supportedPriceScaleModes = ["linear", "log", "percentage"] as const;

export type PriceScaleMode = (typeof supportedPriceScaleModes)[number];

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

export type ChartEvent =
  | { type: "viewportChanged"; viewport: ViewportState; visibleRange: VisibleRange }
  | { type: "crosshairMoved"; crosshair: ChartCrosshairState | undefined }
  | { type: "markClicked"; mark: ChartMark }
  | { type: "drawingChanged"; drawing: DrawingObject }
  | { type: "command"; command: ChartEngineCommand };
