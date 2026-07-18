import type { MovingAveragePoint } from "../indicators/movingAverage";
import type { DrawingObject } from "../drawing/drawingTypes";
import type { ChartTimeFormatter } from "../model/formatters";
import type { CandleSeries } from "../model/market";
import type { ChartCrosshairState as CrosshairState, ViewportState } from "../model/runtime";
import type { ChartTheme } from "../model/theme";
import type { IndicatorVisualOutput } from "../model/visual";
import type { PanelArea } from "../panels/panelTypes";
import type { SeriesRenderModel, SeriesType } from "../series/seriesTypes";
import type { PriceScale } from "../viewport/priceScale";

export interface ChartLayout {
  width: number;
  height: number;
  leftAxisWidth: number;
  rightAxisWidth: number;
  bottomAxisHeight: number;
  leftPriceAxisArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  plotArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  priceAxisArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  volumeArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timeAxisArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RenderState {
  series: CandleSeries;
  seriesType?: SeriesType;
  seriesModel?: SeriesRenderModel;
  viewport: ViewportState;
  priceScale: PriceScale;
  formatTime: ChartTimeFormatter;
  theme: ChartTheme;
  layout: ChartLayout;
  movingAverages?: MovingAveragePoint[][];
  crosshair?: CrosshairState | undefined;
  panels?: PanelArea[];
  visualOutputs?: IndicatorVisualOutput[];
  drawings?: DrawingObject[];
  selectedDrawingIds?: string[];
  hoveredDrawingId?: string;
  intradayDays?: number;
}

export interface LayerRenderContext {
  context: CanvasRenderingContext2D;
  state: RenderState;
}

export interface ChartLayer {
  id: string;
  render(context: LayerRenderContext): void;
}
