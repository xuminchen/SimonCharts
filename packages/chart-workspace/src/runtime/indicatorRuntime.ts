import type { CoreIndicatorId, CoreIndicatorParams } from "@simoncharts/chart-engine";

export interface IndicatorConfig {
  readonly id: CoreIndicatorId;
  readonly params: Readonly<CoreIndicatorParams>;
  readonly visible: boolean;
  readonly panelId?: string;
  readonly style?: Readonly<Record<string, unknown>>;
}
