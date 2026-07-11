import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel } from "../seriesTypes";
import { transformSeriesChunk } from "./seriesTransformChunk";

export interface KagiTransformOptions {
  reversalAmount: number;
}

export function transformKagi(
  series: CandleSeries,
  options: KagiTransformOptions
): SeriesRenderModel {
  return transformSeriesChunk("kagi", series, options).model;
}
