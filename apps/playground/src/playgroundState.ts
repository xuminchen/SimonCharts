import type { SeriesType } from "@simoncharts/chart-engine";

export interface PlaygroundState {
  seriesType: SeriesType;
}

export const playgroundState: PlaygroundState = {
  seriesType: "candles"
};
