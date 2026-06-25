import type {
  FigureBounds,
  FigureHitTestResult,
  FigureObject,
  FigurePoint,
  FigureType
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
  const path = getHitTestPath(figure);

  if (path.filled && isPointInsidePolygon(path.points, point)) {
    return { figureId: figure.id, distance: 0 };
  }

  const distance = getMinimumSegmentDistance(path.points, point, path.closed);

  return distance <= tolerance ? { figureId: figure.id, distance } : undefined;
}

interface HitTestPath {
  points: FigurePoint[];
  closed: boolean;
  filled: boolean;
}

function getHitTestPath(figure: FigureObject): HitTestPath {
  if (figure.type === "rect") {
    const rectPoints = getRectPoints(figure.points);

    return {
      points: rectPoints ?? figure.points,
      closed: Boolean(rectPoints),
      filled: Boolean(rectPoints)
    };
  }

  if (isClosedFilledType(figure.type)) {
    return {
      points: figure.points,
      closed: true,
      filled: true
    };
  }

  return {
    points: figure.points,
    closed: false,
    filled: false
  };
}

function getRectPoints(points: FigurePoint[]): FigurePoint[] | undefined {
  const start = points[0];
  const end = points[1];

  if (!start || !end) {
    return undefined;
  }

  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ];
}

function isClosedFilledType(type: FigureType): boolean {
  return type === "polygon" || type === "band" || type === "rotatedRect";
}

function getMinimumSegmentDistance(
  points: FigurePoint[],
  point: FigurePoint,
  closed: boolean
): number {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (points.length === 1) {
    return getPointDistance(points[0], point);
  }

  const openDistance = points.slice(1).reduce((best, current, index) => {
    const previous = points[index];

    return Math.min(best, getSegmentDistance(previous, current, point));
  }, Number.POSITIVE_INFINITY);

  if (!closed) {
    return openDistance;
  }

  return Math.min(openDistance, getSegmentDistance(points[points.length - 1], points[0], point));
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

function isPointInsidePolygon(points: FigurePoint[], point: FigurePoint): boolean {
  if (points.length < 3) {
    return false;
  }

  let inside = false;

  for (
    let index = 0, previousIndex = points.length - 1;
    index < points.length;
    previousIndex = index++
  ) {
    const current = points[index];
    const previous = points[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) +
          current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}
