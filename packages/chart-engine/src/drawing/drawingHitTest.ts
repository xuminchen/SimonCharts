import type { DrawingObject } from "./drawingTypes";
import type { DrawingHitTestResult, DrawingRendererRegistry } from "./drawingRegistry";

export interface DrawingAnchorHit {
  drawingId: string;
  anchorIndex: number;
  distance: number;
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingHitTestOptions {
  registry: DrawingRendererRegistry;
  includeHidden?: boolean;
  includeLocked?: boolean;
}

export interface DrawingHitTestMatch {
  drawing: DrawingObject;
  hit: DrawingHitTestResult;
  index: number;
}

export function hitTestDrawingAll(
  drawings: DrawingObject[],
  point: DrawingPoint,
  options: DrawingHitTestOptions
): DrawingHitTestMatch[] {
  return drawings
    .map((drawing, index) => ({ drawing, index }))
    .filter(({ drawing }) => options.includeHidden === true || drawing.visible !== false)
    .filter(({ drawing }) => options.includeLocked !== false || drawing.locked !== true)
    .filter(({ drawing }) => drawing.interactive !== false)
    .map(({ drawing, index }) => ({
      drawing,
      hit: options.registry.require(drawing.type).hitTest(drawing, point),
      index
    }))
    .filter((match): match is DrawingHitTestMatch => match.hit !== undefined)
    .sort((left, right) => left.hit.distance - right.hit.distance || right.index - left.index);
}

export function hitTestDrawing(
  drawings: DrawingObject[],
  point: DrawingPoint,
  options: DrawingHitTestOptions
): DrawingHitTestMatch | undefined {
  return hitTestDrawingAll(drawings, point, options)[0];
}

export function hitTestDrawingAnchor(
  drawing: DrawingObject,
  point: DrawingPoint,
  radius: number
): DrawingAnchorHit | undefined {
  if (drawing.interactive === false) {
    return undefined;
  }

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
