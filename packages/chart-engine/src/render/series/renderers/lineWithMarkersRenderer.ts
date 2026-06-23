import {
  createRenderer,
  getVisibleBounds,
  getVisiblePriceRange,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createLineWithMarkersRenderer() {
  return createRenderer("lineWithMarkers", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const { context, state } = renderContext;

    withPlotClip(renderContext, () => {
      context.strokeStyle = state.theme.colors.text;
      context.fillStyle = state.theme.colors.text;
      context.lineWidth = state.theme.lineWidths.indicator;

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

      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        context.beginPath();
        context.arc(xForIndex(renderContext, index), yForPrice(renderContext, range, point.close), 2.5, 0, Math.PI * 2);
        context.fill();
      }
    });
  });
}
