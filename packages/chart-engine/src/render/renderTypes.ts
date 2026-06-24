import type { MovingAveragePoint } from "../indicators/movingAverage";
import type { DrawingObject } from "../drawing/drawingTypes";
import type { CandleSeries } from "../model/market";
import type { ChartCrosshairState as CrosshairState, ViewportState } from "../model/runtime";
import type { ChartTheme } from "../model/theme";
import type { IndicatorVisualOutput } from "../model/visual";
import type { PanelArea } from "../panels/panelTypes";
import type { SeriesType } from "../series/seriesTypes";

export interface ChartLayout {
  width: number;
  height: number;
  rightAxisWidth: number;
  bottomAxisHeight: number;
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
  viewport: ViewportState;
  theme: ChartTheme;
  layout: ChartLayout;
  movingAverages?: MovingAveragePoint[][];
  crosshair?: CrosshairState | undefined;
  panels?: PanelArea[];
  visualOutputs?: IndicatorVisualOutput[];
  drawings?: DrawingObject[];
  selectedDrawingIds?: string[];
  hoveredDrawingId?: string;
}

export interface LayerRenderContext {
  context: CanvasRenderingContext2D;
  state: RenderState;
}

export interface ChartLayer {
  id: string;
  render(context: LayerRenderContext): void;
}
