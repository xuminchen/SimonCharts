import {
  createRenderer,
  getVisibleBounds,
  getVisiblePriceRange,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createLineRenderer() {
  return createRenderer("line", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const { context, state } = renderContext;
    const lastClose = renderContext.model.points[bounds.to].close;

    withPlotClip(renderContext, () => {
      context.strokeStyle = state.priceScale.mode !== "percentage" || lastClose === state.priceScale.basePrice
        ? state.theme.colors.text
        : lastClose > state.priceScale.basePrice
          ? state.theme.colors.bullishCandle
          : state.theme.colors.bearishCandle;
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
    });
  });
}
