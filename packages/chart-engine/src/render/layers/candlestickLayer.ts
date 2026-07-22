import { priceToY, type PriceScale } from "../../viewport/priceScale";
import { indexToX, type TimeCoordinateMap } from "../../viewport/viewport";
import type { Candle } from "../../model/market";
import type { ViewportState } from "../../model/runtime";
import type { ChartLayer, ChartLayout } from "../renderTypes";

export function createCandlestickLayer(): ChartLayer {
  return {
    id: "candlestick",
    render({ context, state }) {
      const { layout, series, theme, viewport } = state;
      const bounds = getVisibleBounds(viewport, series.candles.length);

      if (!bounds || layout.plotArea.width <= 0 || layout.plotArea.height <= 0) {
        return;
      }

      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const candle = series.candles[index];
        const color =
          candle.close >= candle.open ? theme.colors.bullishCandle : theme.colors.bearishCandle;

        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = theme.lineWidths.candleWick;
        drawWick(context, candle, index, viewport, layout, state.priceScale, state.timeCoordinates);
        drawBody(context, candle, index, viewport, layout, state.priceScale, state.timeCoordinates);
      }
    }
  };
}

function drawWick(
  context: CanvasRenderingContext2D,
  candle: Candle,
  index: number,
  viewport: ViewportState,
  layout: ChartLayout,
  priceScale: PriceScale,
  timeCoordinates?: TimeCoordinateMap
): void {
  const x = indexToX(index, viewport, layout.plotArea.x, timeCoordinates);
  const highY = priceToY(
    candle.high,
    priceScale,
    layout.plotArea.y,
    layout.plotArea.height
  );
  const lowY = priceToY(
    candle.low,
    priceScale,
    layout.plotArea.y,
    layout.plotArea.height
  );

  context.beginPath();
  context.moveTo(x, highY);
  context.lineTo(x, lowY);
  context.stroke();
}

function drawBody(
  context: CanvasRenderingContext2D,
  candle: Candle,
  index: number,
  viewport: ViewportState,
  layout: ChartLayout,
  priceScale: PriceScale,
  timeCoordinates?: TimeCoordinateMap
): void {
  const x = indexToX(index, viewport, layout.plotArea.x, timeCoordinates);
  const openY = priceToY(
    candle.open,
    priceScale,
    layout.plotArea.y,
    layout.plotArea.height
  );
  const closeY = priceToY(
    candle.close,
    priceScale,
    layout.plotArea.y,
    layout.plotArea.height
  );
  const bodyWidth = Math.max(1, timeCoordinates?.barWidth ?? viewport.candleWidth * 0.7);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(1, Math.abs(closeY - openY));

  context.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
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
