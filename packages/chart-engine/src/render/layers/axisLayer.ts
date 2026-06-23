import { computeVisiblePriceRange } from "../../viewport/priceRange";
import type { ViewportState } from "../../model/runtime";
import type { ChartLayer } from "../renderTypes";

const priceTickCount = 4;

export function createAxisLayer(): ChartLayer {
  return {
    id: "axis",
    render({ context, state }) {
      const { layout, series, theme, viewport } = state;
      const { plotArea, priceAxisArea, timeAxisArea } = layout;
      const bounds = getVisibleBounds(viewport, series.candles.length);

      if (
        !bounds ||
        plotArea.width <= 0 ||
        plotArea.height <= 0
      ) {
        return;
      }

      const priceRange = computeVisiblePriceRange(series, bounds);
      const priceSpan = priceRange.max - priceRange.min;

      context.fillStyle = theme.colors.text;
      context.font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
      context.textAlign = "left";
      context.textBaseline = "middle";

      for (let step = 0; step <= priceTickCount; step += 1) {
        const y = plotArea.y + (plotArea.height / priceTickCount) * step;
        const price = priceRange.max - (priceSpan / priceTickCount) * step;

        context.fillText(
          formatPrice(price),
          priceAxisArea.x + theme.spacing.axisPadding,
          y
        );
      }

      const fromCandle = series.candles[bounds.from];
      const toCandle = series.candles[bounds.to];

      if (fromCandle && toCandle) {
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(
          String(fromCandle.time),
          timeAxisArea.x,
          timeAxisArea.y + theme.spacing.axisPadding
        );
        context.fillText(
          String(toCandle.time),
          timeAxisArea.x + timeAxisArea.width,
          timeAxisArea.y + theme.spacing.axisPadding
        );
      }
    }
  };
}

function formatPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

function getVisibleBounds(
  viewport: ViewportState,
  candleCount: number
): { from: number; to: number } | undefined {
  if (candleCount <= 0 || viewport.visibleRange.from > viewport.visibleRange.to) {
    return undefined;
  }

  const lastIndex = candleCount - 1;
  const from = Math.max(0, viewport.visibleRange.from);
  const to = Math.min(lastIndex, viewport.visibleRange.to);

  if (from > to) {
    return undefined;
  }

  return { from, to };
}
