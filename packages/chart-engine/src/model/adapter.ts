import type { ChartEngineCommand } from "../commands/chartCommands";
import type { DrawingObject } from "../drawing/drawingTypes";
import type { AdjustMode, CandleSeries, Timeframe } from "./market";
import type { ViewportState, VisibleRange } from "./runtime";
import type { ChartMark } from "./visual";

export interface DataRequest {
  symbol: string;
  timeframe: Timeframe;
  adjustMode: AdjustMode;
  range?: VisibleRange;
}

export type DataResponse = CandleSeries | Promise<CandleSeries>;

export interface LayoutSnapshot {
  viewport: ViewportState;
  drawings: DrawingObject[];
  indicators: string[];
}

export interface HostAdapter {
  resolveData?: (request: DataRequest) => DataResponse;
  onRangeNeedMoreData?: (range: VisibleRange) => void;
  onViewportChange?: (viewport: ViewportState) => void;
  onDrawingChange?: (drawing: DrawingObject) => void;
  onCommand?: (command: ChartEngineCommand) => void;
  onMarkClick?: (mark: ChartMark) => void;
  persistLayout?: (layout: LayoutSnapshot) => void | Promise<void>;
}
