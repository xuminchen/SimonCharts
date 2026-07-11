import type { PriceScaleMode, ViewportState } from "../model/runtime";
import type { ThemeMode } from "../settings/chartSettings";
import type { SeriesType } from "../series/seriesTypes";

export type ChartEngineCommand =
  | { type: "setSeriesType"; seriesType: SeriesType }
  | { type: "setViewport"; viewport: ViewportState }
  | { type: "setPriceScaleMode"; mode: PriceScaleMode }
  | { type: "zoomIn" }
  | { type: "zoomOut" }
  | { type: "resetZoom" }
  | { type: "pan"; deltaX: number }
  | { type: "toggleGrid" }
  | { type: "setThemeMode"; themeMode: ThemeMode };
