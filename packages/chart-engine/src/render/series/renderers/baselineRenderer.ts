import {
  createRenderer,
  getVisibleBounds,
  getVisiblePriceRange,
  withPlotClip,
  xForIndex,
  yForPrice
} from "./rendererHelpers";

export function createBaselineRenderer() {
  return createRenderer("baseline", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const { context, state } = renderContext;
    const baseline = renderContext.model.points[bounds.from].close;
    const baselineY = yForPrice(renderContext, range, baseline);

    withPlotClip(renderContext, () => {
      context.lineWidth = state.theme.lineWidths.indicator;
      context.strokeStyle = state.theme.colors.grid;
      context.beginPath();
      context.moveTo(renderContext.layout.plotArea.x, baselineY);
      context.lineTo(renderContext.layout.plotArea.x + renderContext.layout.plotArea.width, baselineY);
      context.stroke();

      for (let index = bounds.from + 1; index <= bounds.to; index += 1) {
        const previous = renderContext.model.points[index - 1];
        const point = renderContext.model.points[index];

        context.strokeStyle =
          point.close >= baseline && previous.close >= baseline
            ? state.theme.colors.bullishCandle
            : state.theme.colors.bearishCandle;
        context.beginPath();
        context.moveTo(xForIndex(renderContext, index - 1), yForPrice(renderContext, range, previous.close));
        context.lineTo(xForIndex(renderContext, index), yForPrice(renderContext, range, point.close));
        context.stroke();
      }
    });
  });
}
