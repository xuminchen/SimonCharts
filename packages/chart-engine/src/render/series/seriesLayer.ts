import { createSourceSeriesRenderModel } from "../../series/renderModel";
import type { SeriesRendererRegistry } from "../../series/seriesRegistry";
import type { ChartLayer } from "../renderTypes";

export function createSeriesLayer(registry: SeriesRendererRegistry): ChartLayer {
  return {
    id: "series",
    render(context) {
      const type = context.state.seriesType ?? "candles";
      const renderer = registry.require(type);
      const model = createSourceSeriesRenderModel(type, context.state.series);

      renderer.render({
        ...context,
        model,
        layout: context.state.layout
      });
    }
  };
}
