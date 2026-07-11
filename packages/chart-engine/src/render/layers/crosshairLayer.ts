import { priceToY } from "../../viewport/priceScale";
import { indexToX } from "../../viewport/viewport";
import type { ChartLayer } from "../renderTypes";

export function createCrosshairLayer(): ChartLayer {
  return {
    id: "crosshair",
    render({ context, state }) {
      const { crosshair, layout, series, theme, viewport } = state;
      const { plotArea } = layout;

      if (
        !crosshair ||
        crosshair.index < viewport.visibleRange.from ||
        crosshair.index > viewport.visibleRange.to ||
        crosshair.index < 0 ||
        crosshair.index >= series.candles.length ||
        plotArea.width <= 0 ||
        plotArea.height <= 0
      ) {
        return;
      }

      const x = indexToX(crosshair.index, viewport, plotArea.x);
      const y = priceToY(
        crosshair.price,
        state.priceScale,
        plotArea.y,
        plotArea.height
      );

      context.save();
      context.strokeStyle = theme.colors.crosshair;
      context.lineWidth = theme.lineWidths.crosshair;
      context.beginPath();
      context.moveTo(x, plotArea.y);
      context.lineTo(x, plotArea.y + plotArea.height);
      context.moveTo(plotArea.x, y);
      context.lineTo(plotArea.x + plotArea.width, y);
      context.stroke();
      context.restore();
    }
  };
}
