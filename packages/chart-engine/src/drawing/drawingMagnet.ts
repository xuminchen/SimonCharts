import type { MagnetSessionState } from "../interaction/sessionTypes";
import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import { priceToY, type PriceScale } from "../viewport/priceScale";
import { indexToX, type TimeCoordinateMap } from "../viewport/viewport";
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

export interface MagnetPlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OhlcMagnetTargetOptions {
  series: CandleSeries;
  viewport: ViewportState;
  plotArea: MagnetPlotArea;
  priceScale: PriceScale;
  timeCoordinates?: TimeCoordinateMap;
  fields?: readonly OhlcMagnetField[];
}

export interface VisualMagnetPoint extends MagnetPoint {
  visualId?: string;
  pointIndex?: number;
}

export interface MagnetSnapState {
  point: MagnetPoint;
  target?: MagnetSnapTarget;
  magnet: MagnetSessionState;
}

export interface MagnetSnapStateOptions {
  point: MagnetPoint;
  targets: readonly MagnetSnapTarget[];
  radius: number;
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

export function getMagnetSnapState(options: MagnetSnapStateOptions): MagnetSnapState {
  const target = findNearestMagnetTarget(options.point, options.targets, options.radius);

  if (!target) {
    return {
      point: { ...options.point },
      magnet: { mode: "off" }
    };
  }

  const mode = toMagnetMode(target.type);

  return {
    point: { x: target.x, y: target.y },
    target: cloneMagnetTarget(target),
    magnet: {
      mode,
      target: {
        id: createMagnetTargetId(target),
        mode,
        point: { x: target.x, y: target.y },
        distance: Math.hypot(options.point.x - target.x, options.point.y - target.y)
      }
    }
  };
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

const defaultOhlcMagnetFields: readonly OhlcMagnetField[] = ["open", "high", "low", "close"];

export function createOhlcMagnetTargetsFromSeries(
  options: OhlcMagnetTargetOptions
): MagnetSnapTarget[] {
  const lastIndex = options.series.candles.length - 1;

  if (lastIndex < 0 || options.viewport.visibleRange.from > options.viewport.visibleRange.to) {
    return [];
  }

  const from = Math.max(0, options.viewport.visibleRange.from);
  const to = Math.min(lastIndex, options.viewport.visibleRange.to);

  if (from > to) {
    return [];
  }

  const fields = options.fields ?? defaultOhlcMagnetFields;
  const points: OhlcMagnetPoint[] = [];

  for (let index = from; index <= to; index += 1) {
    const candle = options.series.candles[index];
    const x = indexToX(
      index,
      options.viewport,
      options.plotArea.x,
      options.timeCoordinates
    );

    for (const field of fields) {
      const y = priceToY(
        candle[field],
        options.priceScale,
        options.plotArea.y,
        options.plotArea.height
      );

      points.push({ x, y, field, dataIndex: index });
    }
  }

  return createOhlcMagnetTargets(points);
}

export function createDrawingAnchorMagnetTargets(
  drawings: readonly DrawingObject[]
): MagnetSnapTarget[] {
  const targets: MagnetSnapTarget[] = [];

  for (const drawing of drawings) {
    if (drawing.interactive === false) continue;

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

function toMagnetMode(type: MagnetSnapTargetType): Exclude<MagnetSessionState["mode"], "off"> {
  return type;
}

function createMagnetTargetId(target: MagnetSnapTarget): string {
  if (target.type === "ohlc" && typeof target.dataIndex === "number" && target.field) {
    return `ohlc:${target.dataIndex}:${target.field}`;
  }

  if (target.type === "ohlc" && target.field) {
    return `ohlc:${target.field}:${target.x}:${target.y}`;
  }

  if (
    target.type === "drawingAnchor" &&
    target.drawingId !== undefined &&
    typeof target.anchorIndex === "number"
  ) {
    return `drawingAnchor:${target.drawingId}:${target.anchorIndex}`;
  }

  if (
    target.type === "visualPoint" &&
    target.visualId !== undefined &&
    typeof target.pointIndex === "number"
  ) {
    return `visualPoint:${target.visualId}:${target.pointIndex}`;
  }

  return `${target.type}:${target.x}:${target.y}`;
}

function hasFinitePoint<T extends Partial<MagnetPoint>>(point: T): point is T & MagnetPoint {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function cloneMagnetTarget(target: MagnetSnapTarget): MagnetSnapTarget {
  return { ...target };
}
