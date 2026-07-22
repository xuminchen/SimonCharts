import { priceToY, type PriceScale } from "../../viewport/priceScale";
import { indexToX, type TimeCoordinateMap } from "../../viewport/viewport";
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

      movingAverages.forEach((points, seriesIndex) => {
        const color =
          theme.colors.maLines[seriesIndex % theme.colors.maLines.length] ?? theme.colors.text;

        context.strokeStyle = color;
        context.lineWidth = theme.lineWidths.indicator;
        drawMovingAveragePath(
          context,
          points,
          bounds,
          viewport,
          layout,
          state.priceScale,
          state.timeCoordinates
        );
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
  priceScale: PriceScale,
  timeCoordinates?: TimeCoordinateMap
): void {
  let hasOpenPath = false;
  let hasSegment = false;
  let previousY: number | undefined;

  for (let index = bounds.from; index <= bounds.to; index += 1) {
    const point = points[index];

    if (
      !point ||
      point.value === undefined ||
      !Number.isFinite(point.value) ||
      (priceScale.mode === "log" && point.value <= 0)
    ) {
      if (hasSegment) {
        context.stroke();
      }

      hasOpenPath = false;
      hasSegment = false;
      previousY = undefined;
      continue;
    }

    const x = indexToX(index, viewport, layout.plotArea.x, timeCoordinates);
    const y = priceToY(
      point.value,
      priceScale,
      layout.plotArea.y,
      layout.plotArea.height
    );

    if (!hasOpenPath) {
      context.beginPath();
      context.moveTo(x, y);
      hasOpenPath = true;
      previousY = y;
      continue;
    }

    const dayPosition = timeCoordinates?.dayStartIndices.indexOf(index) ?? -1;
    const boundaryOffset = dayPosition <= 0
      ? undefined
      : timeCoordinates?.dayStartOffsets[dayPosition];
    if (boundaryOffset !== undefined && previousY !== undefined) {
      const boundaryX = layout.plotArea.x + boundaryOffset;
      context.lineTo(boundaryX, previousY);
      context.lineTo(boundaryX, y);
    }
    context.lineTo(x, y);
    hasSegment = true;
    previousY = y;
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
