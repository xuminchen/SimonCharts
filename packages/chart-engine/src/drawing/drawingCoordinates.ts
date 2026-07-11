import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import { priceToY, yToPrice, type PriceScale } from "../viewport/priceScale";
import { indexToX, xToIndex } from "../viewport/viewport";
import type { DrawingEditorPoint } from "./drawingEditor";
import type { DrawingAnchor, DrawingObject } from "./drawingTypes";

export interface DrawingCoordinateContext {
  series: CandleSeries;
  viewport: ViewportState;
  plotArea: { x: number; y: number; width: number; height: number };
  priceScale: PriceScale;
}

export function projectDrawingObject(
  drawing: DrawingObject,
  context: DrawingCoordinateContext
): DrawingObject {
  const projected = structuredClone(drawing);
  projected.anchors = drawing.anchors.map((anchor) => projectAnchor(anchor, context));
  return projected;
}

export function unprojectDrawingObject(
  drawing: DrawingObject,
  context: DrawingCoordinateContext
): DrawingObject {
  const canonical = structuredClone(drawing);
  canonical.anchors = drawing.anchors.map((anchor) => unprojectAnchor(anchor, context));
  return canonical;
}

export function drawingPointFromPointer(
  pointer: Pick<DrawingEditorPoint, "x" | "y">,
  context: DrawingCoordinateContext
): DrawingEditorPoint {
  const rawIndex = xToIndex(pointer.x, context.viewport, context.plotArea.x);
  const index = clampCandleIndex(rawIndex, context.series.candles.length);

  return {
    x: pointer.x,
    y: pointer.y,
    time: context.series.candles[index]?.time,
    price: yToPrice(
      pointer.y,
      context.priceScale,
      context.plotArea.y,
      context.plotArea.height
    )
  };
}

function projectAnchor(
  anchor: DrawingAnchor,
  context: DrawingCoordinateContext
): DrawingAnchor {
  const index = resolveAnchorIndex(anchor, context.series);
  const price = anchor.price;

  return {
    time: anchor.time,
    price,
    x: indexToX(index, context.viewport, context.plotArea.x),
    y:
      typeof price === "number"
        ? priceToY(price, context.priceScale, context.plotArea.y, context.plotArea.height)
        : anchor.y
  };
}

function resolveAnchorIndex(anchor: DrawingAnchor, series: CandleSeries): number {
  if (series.candles.length === 0 || typeof anchor.time !== "number") {
    return 0;
  }

  let nearestIndex = 0;
  let nearestDistance = Math.abs(series.candles[0].time - anchor.time);

  for (let index = 0; index < series.candles.length; index += 1) {
    const candleTime = series.candles[index].time;

    if (candleTime === anchor.time) {
      return index;
    }

    const distance = Math.abs(candleTime - anchor.time);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }

  return nearestIndex;
}

function unprojectAnchor(
  anchor: DrawingAnchor,
  context: DrawingCoordinateContext
): DrawingAnchor {
  const rawIndex = xToIndex(
    anchor.x ?? context.plotArea.x,
    context.viewport,
    context.plotArea.x
  );
  const index = clampCandleIndex(rawIndex, context.series.candles.length);
  const y = anchor.y ?? context.plotArea.y;
  const projectedCanonicalY =
    typeof anchor.price === "number"
      ? priceToY(
          anchor.price,
          context.priceScale,
          context.plotArea.y,
          context.plotArea.height
        )
      : undefined;
  const price =
    anchor.y === projectedCanonicalY && typeof anchor.price === "number"
      ? anchor.price
      : yToPrice(y, context.priceScale, context.plotArea.y, context.plotArea.height);

  return {
    time: context.series.candles[index]?.time,
    price
  };
}

function clampCandleIndex(index: number, candleCount: number): number {
  if (candleCount === 0) {
    return 0;
  }

  return Math.max(0, Math.min(candleCount - 1, index));
}
