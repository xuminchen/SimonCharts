import type { DrawingObject } from "./drawingTypes";

export interface MagnetPoint {
  x: number;
  y: number;
}

export type MagnetSnapTargetType = "ohlc" | "drawingAnchor" | "visualPoint";

export type OhlcMagnetField = "open" | "high" | "low" | "close";

export interface MagnetSnapTarget extends MagnetPoint {
  type: MagnetSnapTargetType;
  field?: OhlcMagnetField;
  dataIndex?: number;
  drawingId?: string;
  anchorIndex?: number;
  visualId?: string;
  pointIndex?: number;
}

export interface OhlcMagnetPoint extends MagnetPoint {
  field: OhlcMagnetField;
  dataIndex?: number;
}

export interface VisualMagnetPoint extends MagnetPoint {
  visualId?: string;
  pointIndex?: number;
}

export function snapPointToTargets(
  point: MagnetPoint,
  targets: MagnetPoint[],
  radius: number
): MagnetPoint {
  let best = point;
  let bestDistance = radius;

  for (const target of targets) {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);

    if (distance <= bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return best;
}

export function findNearestMagnetTarget(
  point: MagnetPoint,
  targets: readonly MagnetSnapTarget[],
  radius: number
): MagnetSnapTarget | undefined {
  let best: MagnetSnapTarget | undefined;
  let bestDistance = radius;

  for (const target of targets) {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);

    if (
      distance < bestDistance ||
      (distance === bestDistance && shouldPreferTarget(target, best))
    ) {
      best = target;
      bestDistance = distance;
    }
  }

  return best ? cloneMagnetTarget(best) : undefined;
}

export function snapPointToMagnetTargets(
  point: MagnetPoint,
  targets: readonly MagnetSnapTarget[],
  radius: number
): MagnetPoint {
  const target = findNearestMagnetTarget(point, targets, radius);

  return target ? { x: target.x, y: target.y } : point;
}

export function createOhlcMagnetTargets(points: readonly OhlcMagnetPoint[]): MagnetSnapTarget[] {
  return points
    .filter(hasFinitePoint)
    .map((point) => ({
      type: "ohlc",
      x: point.x,
      y: point.y,
      field: point.field,
      dataIndex: point.dataIndex
    }));
}

export function createDrawingAnchorMagnetTargets(
  drawings: readonly DrawingObject[]
): MagnetSnapTarget[] {
  const targets: MagnetSnapTarget[] = [];

  for (const drawing of drawings) {
    drawing.anchors.forEach((anchor, anchorIndex) => {
      if (!hasFinitePoint(anchor)) {
        return;
      }

      targets.push({
        type: "drawingAnchor",
        x: anchor.x,
        y: anchor.y,
        drawingId: drawing.id,
        anchorIndex
      });
    });
  }

  return targets;
}

export function createVisualPointMagnetTargets(
  points: readonly VisualMagnetPoint[]
): MagnetSnapTarget[] {
  return points
    .filter(hasFinitePoint)
    .map((point) => ({
      type: "visualPoint",
      x: point.x,
      y: point.y,
      visualId: point.visualId,
      pointIndex: point.pointIndex
    }));
}

function shouldPreferTarget(
  target: MagnetSnapTarget,
  current: MagnetSnapTarget | undefined
): boolean {
  if (!current) {
    return true;
  }

  return getTargetTypePriority(target.type) < getTargetTypePriority(current.type);
}

function getTargetTypePriority(type: MagnetSnapTargetType): number {
  switch (type) {
    case "ohlc":
      return 0;
    case "drawingAnchor":
      return 1;
    case "visualPoint":
      return 2;
  }
}

function hasFinitePoint<T extends Partial<MagnetPoint>>(point: T): point is T & MagnetPoint {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function cloneMagnetTarget(target: MagnetSnapTarget): MagnetSnapTarget {
  return { ...target };
}
