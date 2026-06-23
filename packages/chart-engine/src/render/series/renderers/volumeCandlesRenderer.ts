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

export function createVolumeCandlesRenderer() {
  return createRenderer("volumeCandles", (renderContext) => {
    const bounds = getVisibleBounds(renderContext);

    if (!bounds) {
      return;
    }

    const range = getVisiblePriceRange(renderContext.model, bounds);
    const width = bodyWidth(renderContext);
    const { context, layout, state } = renderContext;
    let maxVolume = 0;

    for (let index = bounds.from; index <= bounds.to; index += 1) {
      maxVolume = Math.max(maxVolume, renderContext.model.points[index].volume ?? 0);
    }

    context.lineWidth = state.theme.lineWidths.candleWick;

    withPlotClip(renderContext, () => {
      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const point = renderContext.model.points[index];
        const x = xForIndex(renderContext, index);
        const openY = yForPrice(renderContext, range, point.open ?? point.close);
        const highY = yForPrice(renderContext, range, point.high ?? point.close);
        const lowY = yForPrice(renderContext, range, point.low ?? point.close);
        const closeY = yForPrice(renderContext, range, point.close);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));
        const volumeHeight =
          maxVolume > 0 ? ((point.volume ?? 0) / maxVolume) * layout.plotArea.height * 0.18 : 0;
        const color = pointColor(renderContext, point);

        context.strokeStyle = color;
        context.fillStyle = state.theme.colors.volume;
        context.fillRect(x - width / 2, layout.plotArea.y + layout.plotArea.height - volumeHeight, width, volumeHeight);
        context.beginPath();
        context.moveTo(x, highY);
        context.lineTo(x, lowY);
        context.stroke();
        context.fillStyle = color;
        context.fillRect(x - width / 2, bodyTop, width, bodyHeight);
      }
    });
  });
}
