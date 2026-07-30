import type { ChartStudy } from "../contracts";

export type IndicatorConfig = ChartStudy;

export const indicatorOutputPrefix = (instanceId: string): string =>
  `study:${JSON.stringify(instanceId)}:`;

export const indicatorOutputId = (instanceId: string, outputId: string): string =>
  `${indicatorOutputPrefix(instanceId)}${outputId}`;

export const indicatorPanelId = (instanceId: string): string =>
  `study:${instanceId}`;
