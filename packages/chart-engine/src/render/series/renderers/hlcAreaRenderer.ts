import {
  createRenderer,
  getVisibleBounds,
  getVisiblePriceRange,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createHlcAreaRenderer() {
  return createRenderer("hlcArea", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const { context, state } = renderContext;

    context.strokeStyle = state.theme.colors.text;
    context.fillStyle = state.theme.colors.volume;
    context.lineWidth = state.theme.lineWidths.candleWick;

    withPlotClip(renderContext, () => {
      context.beginPath();
      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        const x = xForIndex(renderContext, index);
        const y = yForPrice(renderContext, range, point.high ?? point.close);

        if (index === bounds.from) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      for (let index = bounds.to; index >= bounds.from; index -= 1) {
        const point = renderContext.model.points[index];
        context.lineTo(xForIndex(renderContext, index), yForPrice(renderContext, range, point.low ?? point.close));
      }
      context.fill();
      context.stroke();
    });
  });
}
