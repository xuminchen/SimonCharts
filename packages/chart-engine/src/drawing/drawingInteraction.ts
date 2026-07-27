import { getDrawingBounds, type DrawingBounds } from "./drawingGeometry";
import type { DrawingObject } from "./drawingTypes";

export type DrawingEditHandleKind = "anchor" | "resize" | "rotate";
export type DrawingResizeHandlePosition =
  | "topLeft"
  | "top"
  | "topRight"
  | "right"
  | "bottomRight"
  | "bottom"
  | "bottomLeft"
  | "left";

export interface DrawingSelectionBounds extends DrawingBounds {}

export interface DrawingEditHandle {
  id: string;
  drawingId: string;
  kind: DrawingEditHandleKind;
  x: number;
  y: number;
  anchorIndex?: number;
  position?: DrawingResizeHandlePosition;
}

export interface DrawingSelectionOptions {
  includeHidden?: boolean;
  includeLocked?: boolean;
}

const rotateHandleOffset = 24;

export function getDrawingEditHandles(drawing: DrawingObject): DrawingEditHandle[] {
  if (drawing.interactive === false) {
    return [];
  }

  const handles: DrawingEditHandle[] = [];

  drawing.anchors.forEach((anchor, index) => {
    if (!isFinitePoint(anchor)) {
      return;
    }

    handles.push({
      id: `${drawing.id}:anchor:${index}`,
      drawingId: drawing.id,
      kind: "anchor",
      anchorIndex: index,
      x: anchor.x,
      y: anchor.y
    });
  });

  const bounds = getDrawingBounds(drawing);

  if (!bounds) {
    return handles;
  }

  for (const handle of createResizeHandles(drawing.id, bounds)) {
    handles.push(handle);
  }

  handles.push({
    id: `${drawing.id}:rotate`,
    drawingId: drawing.id,
    kind: "rotate",
    x: bounds.x + bounds.width / 2,
    y: bounds.y - rotateHandleOffset
  });

  return handles;
}

export function getDrawingSelectionBounds(
  drawings: DrawingObject[],
  options: DrawingSelectionOptions = {}
): DrawingSelectionBounds | undefined {
  const bounds = drawings
    .filter((drawing) => shouldIncludeDrawing(drawing, options))
    .map(getDrawingBounds)
    .filter((bounds): bounds is DrawingBounds => bounds !== undefined);

  if (bounds.length === 0) {
    return undefined;
  }

  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function getDrawingIdsInBounds(
  drawings: DrawingObject[],
  bounds: DrawingSelectionBounds,
  options: DrawingSelectionOptions = {}
): string[] {
  return drawings
    .filter((drawing) => shouldIncludeDrawing(drawing, options))
    .filter((drawing) => {
      const drawingBounds = getDrawingBounds(drawing);

      return drawingBounds ? boundsIntersect(bounds, drawingBounds) : false;
    })
    .map((drawing) => drawing.id);
}

export function boundsIntersect(first: DrawingBounds, second: DrawingBounds): boolean {
  return (
    first.x <= second.x + second.width &&
    first.x + first.width >= second.x &&
    first.y <= second.y + second.height &&
    first.y + first.height >= second.y
  );
}

export function normalizeDrawingSelectionBounds(
  start: { x: number; y: number },
  end: { x: number; y: number }
): DrawingSelectionBounds {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  return {
    x,
    y,
    width: Math.max(start.x, end.x) - x,
    height: Math.max(start.y, end.y) - y
  };
}

function createResizeHandles(drawingId: string, bounds: DrawingBounds): DrawingEditHandle[] {
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return [
    resizeHandle(drawingId, "topLeft", left, top),
    resizeHandle(drawingId, "top", centerX, top),
    resizeHandle(drawingId, "topRight", right, top),
    resizeHandle(drawingId, "right", right, centerY),
    resizeHandle(drawingId, "bottomRight", right, bottom),
    resizeHandle(drawingId, "bottom", centerX, bottom),
    resizeHandle(drawingId, "bottomLeft", left, bottom),
    resizeHandle(drawingId, "left", left, centerY)
  ];
}

function resizeHandle(
  drawingId: string,
  position: DrawingResizeHandlePosition,
  x: number,
  y: number
): DrawingEditHandle {
  return {
    id: `${drawingId}:resize:${position}`,
    drawingId,
    kind: "resize",
    position,
    x,
    y
  };
}

function shouldIncludeDrawing(drawing: DrawingObject, options: DrawingSelectionOptions): boolean {
  if (drawing.interactive === false) {
    return false;
  }

  if (!options.includeHidden && drawing.visible === false) {
    return false;
  }

  if (!options.includeLocked && drawing.locked === true) {
    return false;
  }

  return true;
}

function isFinitePoint(value: { x?: number; y?: number }): value is { x: number; y: number } {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}
