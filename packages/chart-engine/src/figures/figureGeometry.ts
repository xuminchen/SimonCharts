import type {
  FigureBounds,
  FigureHitTestResult,
  FigureObject,
  FigurePoint
} from "./figureTypes";

export function getFigureBounds(figure: FigureObject): FigureBounds | undefined {
  if (figure.points.length === 0) {
    return undefined;
  }

  return figure.points.reduce<FigureBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: figure.points[0].x,
      minY: figure.points[0].y,
      maxX: figure.points[0].x,
      maxY: figure.points[0].y
    }
  );
}

export function hitTestFigure(
  figure: FigureObject,
  point: FigurePoint,
  tolerance: number
): FigureHitTestResult | undefined {
  const distance = getMinimumSegmentDistance(figure.points, point);

  return distance <= tolerance ? { figureId: figure.id, distance } : undefined;
}

function getMinimumSegmentDistance(points: FigurePoint[], point: FigurePoint): number {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (points.length === 1) {
    return getPointDistance(points[0], point);
  }

  return points.slice(1).reduce((best, current, index) => {
    const previous = points[index];

    return Math.min(best, getSegmentDistance(previous, current, point));
  }, Number.POSITIVE_INFINITY);
}

function getPointDistance(a: FigurePoint, b: FigurePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getSegmentDistance(a: FigurePoint, b: FigurePoint, point: FigurePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
        );

  return getPointDistance({ x: a.x + t * dx, y: a.y + t * dy }, point);
}
