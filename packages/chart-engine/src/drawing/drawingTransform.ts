import type { DrawingResizeHandlePosition, DrawingSelectionBounds } from "./drawingInteraction";
import type { DrawingAnchor, DrawingObject } from "./drawingTypes";

export interface DrawingTransformPoint {
  x: number;
  y: number;
}

export interface DrawingResizeOptions {
  handle: DrawingResizeHandlePosition;
  fromBounds: DrawingSelectionBounds;
  toPoint: DrawingTransformPoint;
  minSize?: number;
}

export interface DrawingRotateOptions {
  center: DrawingTransformPoint;
  angleRadians: number;
}

interface ResolvedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const defaultMinSize = 1;

export function resizeDrawing(drawing: DrawingObject, options: DrawingResizeOptions): DrawingObject {
  const nextBounds = resolveResizeBounds(options);

  return {
    ...drawing,
    anchors: drawing.anchors.map((anchor) => resizeAnchor(anchor, options.fromBounds, nextBounds))
  };
}

export function resizeDrawings(
  drawings: DrawingObject[],
  options: DrawingResizeOptions
): DrawingObject[] {
  return drawings.map((drawing) => resizeDrawing(drawing, options));
}

export function rotateDrawing(drawing: DrawingObject, options: DrawingRotateOptions): DrawingObject {
  return {
    ...drawing,
    anchors: drawing.anchors.map((anchor) => rotateAnchor(anchor, options))
  };
}

export function rotateDrawings(
  drawings: DrawingObject[],
  options: DrawingRotateOptions
): DrawingObject[] {
  return drawings.map((drawing) => rotateDrawing(drawing, options));
}

function resolveResizeBounds(options: DrawingResizeOptions): ResolvedBounds {
  const minSize = Math.max(options.minSize ?? defaultMinSize, 0);
  const left = options.fromBounds.x;
  const right = options.fromBounds.x + options.fromBounds.width;
  const top = options.fromBounds.y;
  const bottom = options.fromBounds.y + options.fromBounds.height;

  let nextLeft = left;
  let nextRight = right;
  let nextTop = top;
  let nextBottom = bottom;

  if (movesLeft(options.handle)) {
    nextLeft = options.toPoint.x;
  }

  if (movesRight(options.handle)) {
    nextRight = options.toPoint.x;
  }

  if (movesTop(options.handle)) {
    nextTop = options.toPoint.y;
  }

  if (movesBottom(options.handle)) {
    nextBottom = options.toPoint.y;
  }

  if (nextRight - nextLeft < minSize) {
    if (movesLeft(options.handle) && !movesRight(options.handle)) {
      nextLeft = nextRight - minSize;
    } else {
      nextRight = nextLeft + minSize;
    }
  }

  if (nextBottom - nextTop < minSize) {
    if (movesTop(options.handle) && !movesBottom(options.handle)) {
      nextTop = nextBottom - minSize;
    } else {
      nextBottom = nextTop + minSize;
    }
  }

  return {
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop
  };
}

function resizeAnchor(
  anchor: DrawingAnchor,
  fromBounds: DrawingSelectionBounds,
  toBounds: ResolvedBounds
): DrawingAnchor {
  return {
    ...anchor,
    x: isFiniteNumber(anchor.x)
      ? mapCoordinate(anchor.x, fromBounds.x, fromBounds.width, toBounds.x, toBounds.width)
      : anchor.x,
    y: isFiniteNumber(anchor.y)
      ? mapCoordinate(anchor.y, fromBounds.y, fromBounds.height, toBounds.y, toBounds.height)
      : anchor.y
  };
}

function rotateAnchor(anchor: DrawingAnchor, options: DrawingRotateOptions): DrawingAnchor {
  if (!isFiniteNumber(anchor.x) || !isFiniteNumber(anchor.y)) {
    return anchor;
  }

  const dx = anchor.x - options.center.x;
  const dy = anchor.y - options.center.y;
  const cos = Math.cos(options.angleRadians);
  const sin = Math.sin(options.angleRadians);

  return {
    ...anchor,
    x: options.center.x + dx * cos - dy * sin,
    y: options.center.y + dx * sin + dy * cos
  };
}

function mapCoordinate(
  value: number,
  fromStart: number,
  fromSize: number,
  toStart: number,
  toSize: number
): number {
  if (fromSize === 0) {
    return toStart + toSize / 2;
  }

  return toStart + ((value - fromStart) / fromSize) * toSize;
}

function movesLeft(handle: DrawingResizeHandlePosition): boolean {
  return handle === "left" || handle === "topLeft" || handle === "bottomLeft";
}

function movesRight(handle: DrawingResizeHandlePosition): boolean {
  return handle === "right" || handle === "topRight" || handle === "bottomRight";
}

function movesTop(handle: DrawingResizeHandlePosition): boolean {
  return handle === "top" || handle === "topLeft" || handle === "topRight";
}

function movesBottom(handle: DrawingResizeHandlePosition): boolean {
  return handle === "bottom" || handle === "bottomLeft" || handle === "bottomRight";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
