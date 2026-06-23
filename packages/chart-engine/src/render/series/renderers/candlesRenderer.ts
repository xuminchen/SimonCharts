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

export function createCandlesRenderer() {
  return createRenderer("candles", (renderContext) => {
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
        const openY = yForPrice(renderContext, range, point.open ?? point.close);
        const highY = yForPrice(renderContext, range, point.high ?? point.close);
        const lowY = yForPrice(renderContext, range, point.low ?? point.close);
        const closeY = yForPrice(renderContext, range, point.close);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));
        const color = pointColor(renderContext, point);

        context.strokeStyle = color;
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(x, highY);
        context.lineTo(x, lowY);
        context.stroke();
        context.fillRect(x - width / 2, bodyTop, width, bodyHeight);
      }
    });
  });
}
