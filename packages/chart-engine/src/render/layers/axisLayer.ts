import type { ViewportState } from "../../model/runtime";
import {
  formatPriceScaleTick,
  scaleValueToPrice
} from "../../viewport/priceScale";
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

      const priceScale = state.priceScale;
      const scaleSpan = priceScale.max - priceScale.min;

      context.fillStyle = theme.colors.text;
      context.font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
      context.textAlign = "left";
      context.textBaseline = "middle";

      for (let step = 0; step <= priceTickCount; step += 1) {
        const y = plotArea.y + (plotArea.height / priceTickCount) * step;
        const scaleValue = priceScale.max - (scaleSpan / priceTickCount) * step;
        const price = scaleValueToPrice(scaleValue, priceScale);

        context.fillText(
          formatPriceScaleTick(price, priceScale),
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
          state.formatTime(fromCandle.time, series.timeframe),
          timeAxisArea.x,
          timeAxisArea.y + theme.spacing.axisPadding
        );
        context.fillText(
          state.formatTime(toCandle.time, series.timeframe),
          timeAxisArea.x + timeAxisArea.width,
          timeAxisArea.y + theme.spacing.axisPadding
        );
      }
    }
  };
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
