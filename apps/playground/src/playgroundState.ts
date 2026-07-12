import type { SeriesType, Timeframe } from "@simoncharts/chart-engine";

export interface PlaygroundState {
  seriesType: SeriesType;
  timeframe: Timeframe;
}

export const playgroundState: PlaygroundState = {
  seriesType: "candles",
  timeframe: "1d"
};
