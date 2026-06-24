import type { DrawingObject } from "../drawing/drawingTypes";
import type { InteractionSessionState } from "../interaction/sessionTypes";
import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import type { IndicatorVisualOutput } from "../model/visual";
import type { RenderSchedulerState } from "../render/scheduler/renderSchedulerTypes";
import type { SeriesType } from "../series/seriesTypes";

export type ChartEngineEvent =
  | { type: "seriesChanged"; series: CandleSeries }
  | { type: "seriesTypeChanged"; seriesType: SeriesType }
  | { type: "viewportChanged"; viewport: ViewportState }
  | { type: "visualOutputsChanged"; outputs: IndicatorVisualOutput[] }
  | { type: "drawingsChanged"; drawings: DrawingObject[] }
  | { type: "interactionStateChanged"; interaction: InteractionSessionState }
  | { type: "renderStateChanged"; render: RenderSchedulerState };

export type ChartEngineEventListener = (event: ChartEngineEvent) => void;
