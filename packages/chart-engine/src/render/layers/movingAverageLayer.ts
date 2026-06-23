import { computeVisiblePriceRange } from "../../viewport/priceRange";
import { indexToX, priceToY } from "../../viewport/viewport";
import type { MovingAveragePoint } from "../../indicators/movingAverage";
import type { ViewportState } from "../../model/runtime";
import type { ChartLayer, ChartLayout } from "../renderTypes";

export function createMovingAverageLayer(): ChartLayer {
  return {
    id: "movingAverage",
    render({ context, state }) {
      const { layout, movingAverages, series, theme, viewport } = state;
      const bounds = getVisibleBounds(viewport, series.candles.length);

      if (
        !bounds ||
        !movingAverages ||
        movingAverages.length === 0 ||
        layout.plotArea.width <= 0 ||
        layout.plotArea.height <= 0
      ) {
        return;
      }

      const priceRange = computeVisiblePriceRange(series, bounds);

      movingAverages.forEach((points, seriesIndex) => {
        const color =
          theme.colors.maLines[seriesIndex % theme.colors.maLines.length] ?? theme.colors.text;

        context.strokeStyle = color;
        context.lineWidth = theme.lineWidths.indicator;
        drawMovingAveragePath(context, points, bounds, viewport, layout, priceRange);
      });
    }
  };
}

function drawMovingAveragePath(
  context: CanvasRenderingContext2D,
  points: MovingAveragePoint[],
  bounds: { from: number; to: number },
  viewport: ViewportState,
  layout: ChartLayout,
  priceRange: { min: number; max: number }
): void {
  let hasOpenPath = false;
  let hasSegment = false;

  for (let index = bounds.from; index <= bounds.to; index += 1) {
    const point = points[index];

    if (!point || point.value === undefined) {
      if (hasSegment) {
        context.stroke();
      }

      hasOpenPath = false;
      hasSegment = false;
      continue;
    }

    const x = indexToX(index, viewport, layout.plotArea.x);
    const y = priceToY(
      point.value,
      priceRange,
      layout.plotArea.y,
      layout.plotArea.height,
      viewport.priceScaleMode
    );

    if (!hasOpenPath) {
      context.beginPath();
      context.moveTo(x, y);
      hasOpenPath = true;
      continue;
    }

    context.lineTo(x, y);
    hasSegment = true;
  }

  if (hasSegment) {
    context.stroke();
  }
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
