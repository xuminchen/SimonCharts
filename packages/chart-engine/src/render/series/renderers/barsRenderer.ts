import {
  createRenderer,
  getVisibleBounds,
  getVisiblePriceRange,
  pointColor,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createBarsRenderer() {
  return createRenderer("bars", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const tickWidth = Math.max(1, renderContext.state.viewport.candleWidth * 0.35);
    const { context } = renderContext;

    context.lineWidth = renderContext.state.theme.lineWidths.candleWick;

    withPlotClip(renderContext, () => {
      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        const x = xForIndex(renderContext, index);
        const openY = yForPrice(renderContext, range, point.open ?? point.close);
        const highY = yForPrice(renderContext, range, point.high ?? point.close);
        const lowY = yForPrice(renderContext, range, point.low ?? point.close);
        const closeY = yForPrice(renderContext, range, point.close);

        context.strokeStyle = pointColor(renderContext, point);
        context.beginPath();
        context.moveTo(x, highY);
        context.lineTo(x, lowY);
        context.moveTo(x - tickWidth, openY);
        context.lineTo(x, openY);
        context.moveTo(x, closeY);
        context.lineTo(x + tickWidth, closeY);
        context.stroke();
      }
    });
  });
}
