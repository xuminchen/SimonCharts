import { getDrawingBounds } from "../../../drawing/drawingGeometry";
import { hitTestDrawingAnchor, type DrawingPoint } from "../../../drawing/drawingHitTest";
import type { DrawingObject, DrawingType } from "../../../drawing/drawingTypes";
import type { DrawingRenderer } from "../../../drawing/drawingRegistry";

const defaultStroke = "#2563eb";
const defaultFill = "rgba(37, 99, 235, 0.12)";

export interface AnchorPoint {
  x: number;
  y: number;
}

export function createDrawingRenderer(
  type: DrawingType,
  draw: (context: CanvasRenderingContext2D, drawing: DrawingObject) => void
): DrawingRenderer {
  return {
    type,
    render({ context, drawing }) {
      const points = getAnchorPoints(drawing);

      if (points.length === 0) {
        return;
      }

      context.save();
      try {
        applyDrawingStyle(context, drawing);
        draw(context, drawing);
      } finally {
        context.restore();
      }
    },
    hitTest(drawing, point) {
      const anchorHit = hitTestDrawingAnchor(drawing, point, 6);

      if (anchorHit) {
        return { drawingId: drawing.id, distance: anchorHit.distance };
      }

      const bounds = getDrawingBounds(drawing);

      if (!bounds) {
        return undefined;
      }

      const distance = distanceToBounds(point, bounds);

      return distance <= 6 ? { drawingId: drawing.id, distance } : undefined;
    }
  };
}

export function applyDrawingStyle(
  context: CanvasRenderingContext2D,
  drawing: DrawingObject
): void {
  context.strokeStyle = drawing.style?.color ?? defaultStroke;
  context.fillStyle = drawing.style?.fill ?? defaultFill;
  context.lineWidth = drawing.style?.lineWidth ?? 2;
  context.setLineDash(drawing.style?.lineDash ?? []);
}

export function getAnchorPoints(drawing: DrawingObject): AnchorPoint[] {
  return drawing.anchors
    .filter(
      (anchor): anchor is typeof anchor & { x: number; y: number } =>
        typeof anchor.x === "number" &&
        typeof anchor.y === "number" &&
        Number.isFinite(anchor.x) &&
        Number.isFinite(anchor.y)
    )
    .map((anchor) => ({ x: anchor.x, y: anchor.y }));
}

export function drawLine(
  context: CanvasRenderingContext2D,
  start: AnchorPoint,
  end: AnchorPoint
): void {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

export function drawPolyline(
  context: CanvasRenderingContext2D,
  points: AnchorPoint[],
  close = false
): void {
  if (points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }

  if (close) {
    context.lineTo(points[0].x, points[0].y);
  }

  context.stroke();
}

export function drawRectFromPoints(
  context: CanvasRenderingContext2D,
  start: AnchorPoint,
  end: AnchorPoint,
  fill = false
): void {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  context.beginPath();
  context.rect(x, y, width, height);
  if (fill) {
    context.fill();
  }
  context.stroke();
}

export function drawCircleFromPoints(
  context: CanvasRenderingContext2D,
  center: AnchorPoint,
  edge: AnchorPoint,
  yScale = 1
): void {
  const radius = Math.max(1, Math.hypot(edge.x - center.x, edge.y - center.y));

  context.beginPath();
  context.save();
  try {
    context.translate(center.x, center.y);
    context.scale(1, yScale);
    context.arc(0, 0, radius, 0, Math.PI * 2);
  } finally {
    context.restore();
  }
  context.stroke();
}

export function drawText(
  context: CanvasRenderingContext2D,
  drawing: DrawingObject,
  point: AnchorPoint
): void {
  context.fillStyle = drawing.style?.textColor ?? drawing.style?.color ?? defaultStroke;
  context.font = `${drawing.style?.fontSize ?? 12}px system-ui`;
  context.fillText(drawing.text ?? drawing.type, point.x, point.y);
}

function distanceToBounds(
  point: DrawingPoint,
  bounds: { x: number; y: number; width: number; height: number }
): number {
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const clampedX = Math.max(left, Math.min(point.x, right));
  const clampedY = Math.max(top, Math.min(point.y, bottom));

  return Math.hypot(point.x - clampedX, point.y - clampedY);
}
