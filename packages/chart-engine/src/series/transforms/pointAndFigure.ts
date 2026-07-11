import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel } from "../seriesTypes";
import { transformSeriesChunk } from "./seriesTransformChunk";

export interface PointAndFigureTransformOptions {
  boxSize: number;
  reversalBoxes: number;
}

export function transformPointAndFigure(
  series: CandleSeries,
  options: PointAndFigureTransformOptions
): SeriesRenderModel {
  return transformSeriesChunk("pointAndFigure", series, options).model;
}
