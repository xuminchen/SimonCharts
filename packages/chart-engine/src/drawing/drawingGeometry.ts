import type { DrawingObject } from "./drawingTypes";

export interface DrawingBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getDrawingBounds(drawing: DrawingObject): DrawingBounds | undefined {
  const points = drawing.anchors.filter(
    (anchor): anchor is typeof anchor & { x: number; y: number } =>
      Number.isFinite(anchor.x) && Number.isFinite(anchor.y)
  );

  if (points.length === 0) {
    return undefined;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
