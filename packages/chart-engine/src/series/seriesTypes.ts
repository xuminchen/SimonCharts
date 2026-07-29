import type { Candle, CandleSeries, Timeframe } from "../model/market";
import type { ChartTimeFormatter } from "../model/formatters";
import type { ChartLayout, LayerRenderContext } from "../render/renderTypes";

export const supportedSeriesTypes = [
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "line",
  "lineWithMarkers",
  "stepLine",
  "area",
  "hlcArea",
  "baseline",
  "columns",
  "highLow",
  "heikinAshi",
  "renko",
  "lineBreak",
  "kagi",
  "pointAndFigure"
] as const;

export type SeriesType = (typeof supportedSeriesTypes)[number];

export interface SeriesPointSource {
  sourceIndex?: number;
  sourceRange?: {
    from: number;
    to: number;
  };
}

export interface SeriesRenderPoint extends SeriesPointSource {
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
  turnover?: number;
}

export interface SeriesRenderModel {
  type: SeriesType;
  source: CandleSeries;
  sourceIndexOffset: number;
  points: SeriesRenderPoint[];
}

export interface SeriesAutoscaleRange {
  min: number;
  max: number;
}

export interface SeriesHitTestResult {
  type: SeriesType;
  point: SeriesRenderPoint;
  sourceCandle?: Candle;
  distance: number;
}

export interface SeriesTooltipRow {
  label: string;
  value: string;
}

export interface TooltipFormattingContext {
  formatTime: ChartTimeFormatter;
  /** @internal */
  formatPrice?: (price: number) => string;
  timeframe: Timeframe;
}

export interface SeriesRendererContext extends LayerRenderContext {
  model: SeriesRenderModel;
  layout: ChartLayout;
}

export interface SeriesRenderer {
  type: SeriesType;
  render(context: SeriesRendererContext): void;
  getAutoscale(model: SeriesRenderModel): SeriesAutoscaleRange | undefined;
  hitTest(model: SeriesRenderModel, x: number, y: number): SeriesHitTestResult | undefined;
  getTooltipRows(
    hit: SeriesHitTestResult,
    formatting: TooltipFormattingContext
  ): SeriesTooltipRow[];
}
