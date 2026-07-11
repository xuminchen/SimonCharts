import type { CandleSeries } from "../model/market";
import type { IndicatorResult } from "../model/visual";
import type { CoreIndicatorId } from "./indicatorDefinitions";
import { runCoreIndicatorChunk } from "./indicatorChunk";

export type CoreIndicatorParams = Partial<Record<string, number>>;

export function calculateCoreIndicator(
  id: CoreIndicatorId | string,
  series: CandleSeries,
  params: CoreIndicatorParams = {}
): IndicatorResult {
  return runCoreIndicatorChunk(id, series, params, undefined, true).result;
}
