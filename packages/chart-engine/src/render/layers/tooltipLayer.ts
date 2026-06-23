import { computeVisiblePriceRange } from "../../viewport/priceRange";
import { indexToX, priceToY } from "../../viewport/viewport";
import type { Candle } from "../../model/market";
import type { ChartLayer, ChartLayout } from "../renderTypes";

const tooltipPadding = 8;
const tooltipOffset = 8;
const lineHeight = 16;

export function createTooltipLayer(): ChartLayer {
  return {
    id: "tooltip",
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

      const candle = series.candles[crosshair.index];
      const lines = createTooltipLines(candle);
      const priceRange = computeVisiblePriceRange(series, viewport.visibleRange);
      const x = indexToX(crosshair.index, viewport, plotArea.x);
      const y = priceToY(
        crosshair.price,
        priceRange,
        plotArea.y,
        plotArea.height,
        viewport.priceScaleMode
      );

      context.save();
      context.font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
      context.textAlign = "left";
      context.textBaseline = "top";

      const textWidth = Math.max(...lines.map((line) => context.measureText(line).width));
      const boxWidth = textWidth + tooltipPadding * 2;
      const boxHeight = lines.length * lineHeight + tooltipPadding * 2;
      const { x: boxX, y: boxY } = placeTooltipBox(x, y, boxWidth, boxHeight, layout);

      context.fillStyle = theme.colors.tooltip.background;
      context.fillRect(boxX, boxY, boxWidth, boxHeight);
      context.strokeStyle = theme.colors.tooltip.border;
      context.lineWidth = 1;
      context.strokeRect(boxX, boxY, boxWidth, boxHeight);

      context.fillStyle = theme.colors.tooltip.text;
      lines.forEach((line, index) => {
        context.fillText(
          line,
          boxX + tooltipPadding,
          boxY + tooltipPadding + index * lineHeight
        );
      });

      context.restore();
    }
  };
}

function createTooltipLines(candle: Candle): string[] {
  return [
    `Time: ${candle.time}`,
    `Open: ${formatNumber(candle.open)}`,
    `High: ${formatNumber(candle.high)}`,
    `Low: ${formatNumber(candle.low)}`,
    `Close: ${formatNumber(candle.close)}`,
    `Volume: ${formatNumber(candle.volume)}`,
    `Turnover: ${formatNumber(candle.turnover)}`
  ];
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function placeTooltipBox(
  x: number,
  y: number,
  width: number,
  height: number,
  layout: ChartLayout
): { x: number; y: number } {
  const { plotArea } = layout;
  const right = plotArea.x + plotArea.width;
  const bottom = plotArea.y + plotArea.height;
  const preferredX = x + tooltipOffset;
  const preferredY = y + tooltipOffset;
  const boxX =
    preferredX + width <= right ? preferredX : Math.max(plotArea.x, x - tooltipOffset - width);
  const boxY =
    preferredY + height <= bottom ? preferredY : Math.max(plotArea.y, y - tooltipOffset - height);

  return { x: boxX, y: boxY };
}
