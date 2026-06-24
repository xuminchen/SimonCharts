import type { DrawingObject } from "../drawing/drawingTypes";
import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import type { IndicatorVisualOutput } from "../model/visual";
import type { SeriesType } from "../series/seriesTypes";

export type ChartEngineEvent =
  | { type: "seriesChanged"; series: CandleSeries }
  | { type: "seriesTypeChanged"; seriesType: SeriesType }
  | { type: "viewportChanged"; viewport: ViewportState }
  | { type: "visualOutputsChanged"; outputs: IndicatorVisualOutput[] }
  | { type: "drawingsChanged"; drawings: DrawingObject[] };

export type ChartEngineEventListener = (event: ChartEngineEvent) => void;
