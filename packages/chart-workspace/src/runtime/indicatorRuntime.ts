import type { ChartIndicator } from "../contracts";

export type IndicatorConfig = ChartIndicator;

export const indicatorOutputPrefix = (instanceId: string): string =>
  `study:${JSON.stringify(instanceId)}:`;

export const indicatorOutputId = (instanceId: string, outputId: string): string =>
  `${indicatorOutputPrefix(instanceId)}${outputId}`;

export const indicatorPanelId = (instanceId: string): string =>
  `study:${instanceId}`;
