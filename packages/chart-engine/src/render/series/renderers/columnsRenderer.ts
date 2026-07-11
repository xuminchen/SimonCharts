import { scaleValueToPrice } from "../../../viewport/priceScale";
import {
  bodyWidth,
  createRenderer,
  getVisibleBounds,
  getVisiblePriceRange,
  pointColor,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createColumnsRenderer() {
  return createRenderer("columns", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const scale = renderContext.state.priceScale;
    const scaleMinPrice = scaleValueToPrice(scale.min, scale);
    const scaleMaxPrice = scaleValueToPrice(scale.max, scale);
    const baseline = scaleMinPrice <= 0 && scaleMaxPrice >= 0 ? 0 : scaleMinPrice;
    const baselineY = yForPrice(renderContext, range, baseline);
    const width = bodyWidth(renderContext);
    const { context } = renderContext;

    withPlotClip(renderContext, () => {
      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        const closeY = yForPrice(renderContext, range, point.close);
        const top = Math.min(closeY, baselineY);
        const height = Math.max(1, Math.abs(baselineY - closeY));

        context.fillStyle = pointColor(renderContext, point);
        context.fillRect(xForIndex(renderContext, index) - width / 2, top, width, height);
      }
    });
  });
}
