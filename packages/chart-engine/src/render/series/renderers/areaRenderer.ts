import {
  createRenderer,
  getVisibleBounds,
  getVisiblePriceRange,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createAreaRenderer() {
  return createRenderer("area", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const { context, state } = renderContext;
    const baselineY = yForPrice(renderContext, range, range.min);

    withPlotClip(renderContext, () => {
      context.strokeStyle = state.theme.colors.text;
      context.fillStyle = state.theme.colors.volume;
      context.lineWidth = state.theme.lineWidths.indicator;

      context.beginPath();
      context.moveTo(xForIndex(renderContext, bounds.from), baselineY);
      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        context.lineTo(xForIndex(renderContext, index), yForPrice(renderContext, range, point.close));
      }
      context.lineTo(xForIndex(renderContext, bounds.to), baselineY);
      context.fill();

      context.beginPath();
      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        const x = xForIndex(renderContext, index);
        const y = yForPrice(renderContext, range, point.close);

        if (index === bounds.from) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
    });
  });
}
