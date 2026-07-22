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
    const referencePrice = state.priceScale.mode === "percentage"
      ? state.priceScale.basePrice
      : state.intradayDays === undefined
        ? lastClose
        : renderContext.model.points[bounds.from].open ?? renderContext.model.points[bounds.from].close;

    withPlotClip(renderContext, () => {
      context.strokeStyle = lastClose === referencePrice
        ? state.theme.colors.text
        : lastClose > referencePrice
          ? state.theme.colors.bullishCandle
          : state.theme.colors.bearishCandle;
      context.lineWidth = state.theme.lineWidths.indicator;

      context.beginPath();
      let previousY: number | undefined;
      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        const x = xForIndex(renderContext, index);
        const y = yForPrice(renderContext, range, point.close);

        if (index === bounds.from) {
          context.moveTo(x, y);
        } else {
          const dayPosition = state.timeCoordinates?.dayStartIndices.indexOf(index) ?? -1;
          const boundaryOffset = dayPosition <= 0
            ? undefined
            : state.timeCoordinates?.dayStartOffsets[dayPosition];
          if (boundaryOffset !== undefined && previousY !== undefined) {
            const boundaryX = renderContext.layout.plotArea.x + boundaryOffset;
            context.lineTo(boundaryX, previousY);
            context.lineTo(boundaryX, y);
          }
          context.lineTo(x, y);
        }
        previousY = y;
      }
      context.stroke();
    });
  });
}
