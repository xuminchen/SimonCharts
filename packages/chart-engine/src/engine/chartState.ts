import type { ChartEngineCommand, ChartCommandTimeframe } from "../commands/chartCommands";
import type { DrawingObject, DrawingType } from "../drawing/drawingTypes";
import type { InteractionSessionState } from "../interaction/sessionTypes";
import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import type { IndicatorVisualOutput } from "../model/visual";
import type { RenderSchedulerState } from "../render/scheduler/renderSchedulerTypes";
import type { ChartSettings } from "../settings/chartSettings";
import type { SeriesType } from "../series/seriesTypes";

export interface ChartEngineState {
  series: CandleSeries;
  seriesType: SeriesType;
  timeframe: ChartCommandTimeframe;
  viewport: ViewportState;
  visualOutputs: IndicatorVisualOutput[];
  drawings: DrawingObject[];
  settings: ChartSettings;
  invertedPriceScale: boolean;
  drawingTool: DrawingType | "select";
  interaction?: InteractionSessionState;
  render?: RenderSchedulerState;
  lastCommandType?: ChartEngineCommand["type"];
}
