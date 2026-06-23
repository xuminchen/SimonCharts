import {
  createRenderer,
  getVisibleBounds,
  getVisiblePriceRange,
  pointColor,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createHighLowRenderer() {
  return createRenderer("highLow", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const capWidth = Math.max(1, renderContext.state.viewport.candleWidth * 0.35);
    const { context, state } = renderContext;

    withPlotClip(renderContext, () => {
      context.lineWidth = state.theme.lineWidths.candleWick;

      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        const x = xForIndex(renderContext, index);
        const highY = yForPrice(renderContext, range, point.high ?? point.close);
        const lowY = yForPrice(renderContext, range, point.low ?? point.close);

        context.strokeStyle = pointColor(renderContext, point);
        context.beginPath();
        context.moveTo(x, highY);
        context.lineTo(x, lowY);
        context.moveTo(x - capWidth / 2, highY);
        context.lineTo(x + capWidth / 2, highY);
        context.moveTo(x - capWidth / 2, lowY);
        context.lineTo(x + capWidth / 2, lowY);
        context.stroke();
      }
    });
  });
}
