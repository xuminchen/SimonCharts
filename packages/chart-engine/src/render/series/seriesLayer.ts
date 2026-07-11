import type { CandleSeries } from "../../model/market";
import { createSourceSeriesRenderModel } from "../../series/renderModel";
import type { SeriesRendererRegistry } from "../../series/seriesRegistry";
import type { SeriesRenderModel, SeriesType } from "../../series/seriesTypes";
import { transformHeikinAshi } from "../../series/transforms/heikinAshi";
import { transformKagi } from "../../series/transforms/kagi";
import { transformLineBreak } from "../../series/transforms/lineBreak";
import { transformPointAndFigure } from "../../series/transforms/pointAndFigure";
import { transformRenko } from "../../series/transforms/renko";
import type { ChartLayer } from "../renderTypes";

export function createSeriesLayer(registry: SeriesRendererRegistry): ChartLayer {
  return {
    id: "series",
    render(context) {
      const type = context.state.seriesType ?? "candles";
      const renderer = registry.require(type);
      const model = isMatchingPrecomputedModel(
        context.state.seriesModel,
        type,
        context.state.series
      )
        ? context.state.seriesModel
        : createRenderModel(type, context.state.series);

      renderer.render({
        ...context,
        model,
        layout: context.state.layout
      });
    }
  };
}

function isMatchingPrecomputedModel(
  model: SeriesRenderModel | undefined,
  type: SeriesType,
  series: CandleSeries
): model is SeriesRenderModel {
  return (
    model !== undefined &&
    model.type === type &&
    model.source.symbol === series.symbol &&
    model.source.timeframe === series.timeframe &&
    model.source.adjustMode === series.adjustMode &&
    model.source.dataVersion === series.dataVersion
  );
}

function createRenderModel(type: SeriesType, series: CandleSeries): SeriesRenderModel {
  if (type === "heikinAshi") return transformHeikinAshi(series);
  if (type === "renko") return transformRenko(series, { brickSize: 2 });
  if (type === "lineBreak") return transformLineBreak(series, { lineCount: 3 });
  if (type === "kagi") return transformKagi(series, { reversalAmount: 2 });
  if (type === "pointAndFigure") {
    return transformPointAndFigure(series, { boxSize: 1, reversalBoxes: 3 });
  }

  return createSourceSeriesRenderModel(type, series);
}
