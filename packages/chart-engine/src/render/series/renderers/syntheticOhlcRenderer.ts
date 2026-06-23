import { getSeriesAutoscaleRange } from "../../../series/autoscale";
import { getDefaultSeriesTooltipRows } from "../../../series/tooltip";
import type { SeriesRenderer, SeriesType } from "../../../series/seriesTypes";
import {
  bodyWidth,
  getVisibleBounds,
  getVisiblePriceRange,
  pointColor,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createSyntheticOhlcSeriesRenderer(type: SeriesType): SeriesRenderer {
  return {
    type,
    render(renderContext) {
      const bounds = getVisibleBounds(renderContext);

      if (!bounds) {
        return;
      }

      const range = getVisiblePriceRange(renderContext.model, bounds);
      const width = bodyWidth(renderContext);
      const { context } = renderContext;

      withPlotClip(renderContext, () => {
        context.lineWidth = renderContext.state.theme.lineWidths.candleWick;

        for (let index = bounds.from; index <= bounds.to; index += 1) {
          const point = renderContext.model.points[index];
          const x = xForIndex(renderContext, index);
          const closeY = yForPrice(renderContext, range, point.close);
          const color = pointColor(renderContext, point);

          context.strokeStyle = color;
          context.fillStyle = color;

          if (point.open === undefined || point.high === undefined || point.low === undefined) {
            context.beginPath();
            context.moveTo(x - width / 2, closeY);
            context.lineTo(x + width / 2, closeY);
            context.stroke();
            continue;
          }

          const openY = yForPrice(renderContext, range, point.open);
          const highY = yForPrice(renderContext, range, point.high);
          const lowY = yForPrice(renderContext, range, point.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1, Math.abs(closeY - openY));

          context.beginPath();
          context.moveTo(x, highY);
          context.lineTo(x, lowY);
          context.stroke();
          context.fillRect(x - width / 2, bodyTop, width, bodyHeight);
        }
      });
    },
    getAutoscale(model) {
      return getSeriesAutoscaleRange(model, { from: 0, to: model.points.length - 1 });
    },
    hitTest() {
      return undefined;
    },
    getTooltipRows: getDefaultSeriesTooltipRows
  };
}
