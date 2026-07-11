import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel } from "../seriesTypes";
import { transformSeriesChunk } from "./seriesTransformChunk";

export function transformHeikinAshi(series: CandleSeries): SeriesRenderModel {
  return transformSeriesChunk("heikinAshi", series, {}).model;
}
