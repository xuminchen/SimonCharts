import type { DrawingObject } from "./drawingTypes";

export interface DrawingAnchorHit {
  drawingId: string;
  anchorIndex: number;
  distance: number;
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export function hitTestDrawingAnchor(
  drawing: DrawingObject,
  point: DrawingPoint,
  radius: number
): DrawingAnchorHit | undefined {
  if (radius < 0 || !Number.isFinite(radius)) {
    return undefined;
  }

  let best: DrawingAnchorHit | undefined;

  drawing.anchors.forEach((anchor, anchorIndex) => {
    const anchorX = anchor.x;
    const anchorY = anchor.y;

    if (
      typeof anchorX !== "number" ||
      typeof anchorY !== "number" ||
      !Number.isFinite(anchorX) ||
      !Number.isFinite(anchorY)
    ) {
      return;
    }

    const distance = Math.hypot(point.x - anchorX, point.y - anchorY);

    if (distance <= radius && (!best || distance < best.distance)) {
      best = { drawingId: drawing.id, anchorIndex, distance };
    }
  });

  return best;
}
