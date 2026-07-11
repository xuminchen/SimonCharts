import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel } from "../seriesTypes";
import { transformSeriesChunk } from "./seriesTransformChunk";

export interface RenkoTransformOptions {
  brickSize: number;
}

export function transformRenko(
  series: CandleSeries,
  options: RenkoTransformOptions
): SeriesRenderModel {
  return transformSeriesChunk("renko", series, options).model;
}
