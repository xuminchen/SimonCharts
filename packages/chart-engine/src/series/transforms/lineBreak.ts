import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel } from "../seriesTypes";
import { transformSeriesChunk } from "./seriesTransformChunk";

export interface LineBreakTransformOptions {
  lineCount: number;
}

export function transformLineBreak(
  series: CandleSeries,
  options: LineBreakTransformOptions
): SeriesRenderModel {
  return transformSeriesChunk("lineBreak", series, options).model;
}
