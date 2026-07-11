import type { Timeframe } from "./market";

export type ChartTimeFormatter = (time: number, timeframe: Timeframe) => string;

export const defaultChartTimeFormatter: ChartTimeFormatter = (time) => String(time);
