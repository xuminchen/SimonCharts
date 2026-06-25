import type {
  FigureBounds,
  FigureHitTestResult,
  FigureObject,
  FigurePoint,
  FigureType
} from "./figureTypes";

export function getFigureBounds(figure: FigureObject): FigureBounds | undefined {
  switch (figure.type) {
    case "circle":
      return getCircleBounds(figure) ?? getPointBounds(figure.points);
    case "ellipse":
    case "rect":
      return getTwoPointBounds(figure.points) ?? getPointBounds(figure.points);
    case "marker":
      return getMarkerBounds(figure);
    default:
      return getPointBounds(figure.points);
  }
}

export function hitTestFigure(
  figure: FigureObject,
  point: FigurePoint,
  tolerance: number
): FigureHitTestResult | undefined {
  if (isSemanticHitType(figure.type)) {
    return hitTestSemanticFigure(figure, point, tolerance);
  }

  const path = getHitTestPath(figure);

  if (path.filled && isPointInsidePolygon(path.points, point)) {
    return { figureId: figure.id, distance: 0 };
  }

  const distance = getMinimumSegmentDistance(path.points, point, path.closed);

  return distance <= tolerance ? { figureId: figure.id, distance } : undefined;
}

function getPointBounds(points: FigurePoint[]): FigureBounds | undefined {
  if (points.length === 0) {
    return undefined;
  }

  return points.reduce<FigureBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: points[0].x,
      minY: points[0].y,
      maxX: points[0].x,
      maxY: points[0].y
    }
  );
}

function getCircleBounds(figure: FigureObject): FigureBounds | undefined {
  const center = figure.points[0];
  const edge = figure.points[1];

  if (!center || !edge) {
    return undefined;
  }

  const radius = getPointDistance(center, edge);

  return {
    minX: center.x - radius,
    minY: center.y - radius,
    maxX: center.x + radius,
    maxY: center.y + radius
  };
}

function getTwoPointBounds(points: FigurePoint[]): FigureBounds | undefined {
  const start = points[0];
  const end = points[1];

  if (!start || !end) {
    return undefined;
  }

  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y)
  };
}

function getMarkerBounds(figure: FigureObject): FigureBounds | undefined {
  const point = figure.points[0];

  if (!point) {
    return undefined;
  }

  const radius = getMarkerRadius(figure);

  return {
    minX: point.x - radius,
    minY: point.y - radius,
    maxX: point.x + radius,
    maxY: point.y + radius
  };
}

function hitTestSemanticFigure(
  figure: FigureObject,
  point: FigurePoint,
  tolerance: number
): FigureHitTestResult | undefined {
  switch (figure.type) {
    case "circle":
      return hitTestCircle(figure, point, tolerance);
    case "ellipse":
      return hitTestEllipse(figure, point, tolerance);
    case "marker":
      return hitTestMarker(figure, point, tolerance);
    case "arc":
      return hitTestArc(figure, point, tolerance);
    default:
      return undefined;
  }
}

function isSemanticHitType(type: FigureType): boolean {
  return type === "circle" || type === "ellipse" || type === "marker" || type === "arc";
}

function hitTestCircle(
  figure: FigureObject,
  point: FigurePoint,
  tolerance: number
): FigureHitTestResult | undefined {
  const center = figure.points[0];
  const edge = figure.points[1];

  if (!center || !edge) {
    return undefined;
  }

  const radius = getPointDistance(center, edge);
  const centerDistance = getPointDistance(center, point);
  const distance = centerDistance <= radius ? 0 : centerDistance - radius;

  return distance <= tolerance ? { figureId: figure.id, distance } : undefined;
}

function hitTestEllipse(
  figure: FigureObject,
  point: FigurePoint,
  tolerance: number
): FigureHitTestResult | undefined {
  const start = figure.points[0];
  const end = figure.points[1];

  if (!start || !end) {
    return undefined;
  }

  const bounds = getTwoPointBounds(figure.points);

  if (!bounds) {
    return undefined;
  }

  const radiusX = (bounds.maxX - bounds.minX) / 2;
  const radiusY = (bounds.maxY - bounds.minY) / 2;
  const center = {
    x: bounds.minX + radiusX,
    y: bounds.minY + radiusY
  };

  if (radiusX > 0 && radiusY > 0) {
    const normalizedDistance =
      ((point.x - center.x) * (point.x - center.x)) / (radiusX * radiusX) +
      ((point.y - center.y) * (point.y - center.y)) / (radiusY * radiusY);

    if (normalizedDistance <= 1) {
      return { figureId: figure.id, distance: 0 };
    }
  }

  const distance = getMinimumSegmentDistance(
    getRectPoints(figure.points) ?? figure.points,
    point,
    true
  );

  return distance <= tolerance ? { figureId: figure.id, distance } : undefined;
}

function hitTestMarker(
  figure: FigureObject,
  point: FigurePoint,
  tolerance: number
): FigureHitTestResult | undefined {
  const center = figure.points[0];

  if (!center) {
    return undefined;
  }

  const distance = Math.max(0, getPointDistance(center, point) - getMarkerRadius(figure));

  return distance <= tolerance ? { figureId: figure.id, distance } : undefined;
}

function hitTestArc(
  figure: FigureObject,
  point: FigurePoint,
  tolerance: number
): FigureHitTestResult | undefined {
  const center = figure.points[0];
  const start = figure.points[1];
  const end = figure.points[2];

  if (!center || !start || !end) {
    return undefined;
  }

  const radius = getPointDistance(center, start);
  const distance = Math.abs(getPointDistance(center, point) - radius);

  if (distance > tolerance || !isAngleOnArc(center, start, end, point)) {
    return undefined;
  }

  return { figureId: figure.id, distance };
}

function getMarkerRadius(figure: FigureObject): number {
  return Math.max(3, figure.style?.lineWidth ?? 2);
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

function getAngle(a: FigurePoint, b: FigurePoint): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
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

function isAngleOnArc(
  center: FigurePoint,
  start: FigurePoint,
  end: FigurePoint,
  point: FigurePoint
): boolean {
  const arcAngle = normalizeAngle(getAngle(center, end) - getAngle(center, start));
  const pointAngle = normalizeAngle(getAngle(center, point) - getAngle(center, start));

  return pointAngle <= arcAngle;
}

function normalizeAngle(angle: number): number {
  const fullCircleRadians = Math.PI * 2;
  const normalized = angle % fullCircleRadians;

  return normalized < 0 ? normalized + fullCircleRadians : normalized;
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
