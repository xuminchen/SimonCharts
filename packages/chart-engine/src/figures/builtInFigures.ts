import type { FigureObject, FigurePoint, FigureRenderer, FigureType } from "./figureTypes";

const fullCircleRadians = Math.PI * 2;

const builtInFigureTypes: FigureType[] = [
  "line",
  "polyline",
  "polygon",
  "rect",
  "rotatedRect",
  "circle",
  "ellipse",
  "arc",
  "curve",
  "text",
  "label",
  "arrow",
  "band",
  "marker"
];

export function createBuiltInFigureRenderers(): FigureRenderer[] {
  return builtInFigureTypes.map((type) => ({
    type,
    render({ context, figure }) {
      renderFigure(context, figure);
    }
  }));
}

function renderFigure(context: CanvasRenderingContext2D, figure: FigureObject): void {
  context.save();
  try {
    context.strokeStyle = figure.style?.color ?? "#111827";
    context.fillStyle = figure.style?.fill ?? "rgba(17,24,39,0.12)";
    context.lineWidth = figure.style?.lineWidth ?? 2;
    context.setLineDash(figure.style?.lineDash ?? []);

    switch (figure.type) {
      case "line":
        drawLine(context, figure.points);
        break;
      case "polyline":
        drawPolyline(context, figure.points);
        break;
      case "polygon":
      case "band":
      case "rotatedRect":
        drawClosedPolygon(context, figure.points);
        break;
      case "rect":
        drawRect(context, figure.points);
        break;
      case "circle":
        drawCircle(context, figure.points);
        break;
      case "ellipse":
        drawEllipse(context, figure.points);
        break;
      case "arc":
        drawArc(context, figure.points);
        break;
      case "curve":
        drawCurve(context, figure.points);
        break;
      case "arrow":
        drawArrow(context, figure);
        break;
      case "marker":
        drawMarker(context, figure);
        break;
      case "text":
      case "label":
        drawText(context, figure);
        break;
    }
  } finally {
    context.restore();
  }
}

function drawLine(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  const start = points[0];
  const end = points[1];

  if (!start || !end) {
    return;
  }

  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function drawPolyline(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  drawOpenPath(context, points);
}

function drawClosedPolygon(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  if (points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.closePath();
  context.fill();
  context.stroke();
}

function drawRect(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  const start = points[0];
  const end = points[1];

  if (!start || !end) {
    return;
  }

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  context.beginPath();
  context.rect(x, y, width, height);
  context.fill();
  context.stroke();
}

function drawCircle(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  const center = points[0];
  const edge = points[1];

  if (!center || !edge) {
    return;
  }

  context.beginPath();
  context.arc(center.x, center.y, getPointDistance(center, edge), 0, fullCircleRadians);
  context.fill();
  context.stroke();
}

function drawEllipse(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  const start = points[0];
  const end = points[1];

  if (!start || !end) {
    return;
  }

  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const radiusX = Math.abs(end.x - start.x) / 2;
  const radiusY = Math.abs(end.y - start.y) / 2;
  const centerX = minX + radiusX;
  const centerY = minY + radiusY;

  context.beginPath();

  if (typeof context.ellipse === "function") {
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, fullCircleRadians);
  } else {
    context.save();
    try {
      context.translate(centerX, centerY);
      context.scale(radiusX, radiusY);
      context.arc(0, 0, 1, 0, fullCircleRadians);
    } finally {
      context.restore();
    }
  }

  context.fill();
  context.stroke();
}

function drawArc(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  const center = points[0];
  const start = points[1];
  const end = points[2];

  if (!center || !start || !end) {
    return;
  }

  context.beginPath();
  context.arc(
    center.x,
    center.y,
    getPointDistance(center, start),
    getAngle(center, start),
    getAngle(center, end)
  );
  context.stroke();
}

function drawCurve(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  const start = points[0];
  const control = points[1];
  const end = points[2];

  if (!start || !control || !end || typeof context.quadraticCurveTo !== "function") {
    drawOpenPath(context, points);
    return;
  }

  context.beginPath();
  context.moveTo(start.x, start.y);
  context.quadraticCurveTo(control.x, control.y, end.x, end.y);
  context.stroke();
}

function drawArrow(context: CanvasRenderingContext2D, figure: FigureObject): void {
  if (figure.points.length < 2) {
    return;
  }

  drawOpenPath(context, figure.points);

  const end = figure.points[figure.points.length - 1];
  const previous = figure.points[figure.points.length - 2];
  const angle = getAngle(previous, end);
  const size = Math.max(6, (figure.style?.lineWidth ?? 2) * 4);
  const left = {
    x: end.x - Math.cos(angle - Math.PI / 6) * size,
    y: end.y - Math.sin(angle - Math.PI / 6) * size
  };
  const right = {
    x: end.x - Math.cos(angle + Math.PI / 6) * size,
    y: end.y - Math.sin(angle + Math.PI / 6) * size
  };

  context.beginPath();
  context.moveTo(left.x, left.y);
  context.lineTo(end.x, end.y);
  context.lineTo(right.x, right.y);
  context.stroke();
}

function drawMarker(context: CanvasRenderingContext2D, figure: FigureObject): void {
  const point = figure.points[0];

  if (!point) {
    return;
  }

  const radius = Math.max(3, figure.style?.lineWidth ?? 2);

  context.beginPath();
  context.arc(point.x, point.y, radius, 0, fullCircleRadians);
  context.fill();
  context.stroke();
}

function drawText(context: CanvasRenderingContext2D, figure: FigureObject): void {
  const point = figure.points[0];

  if (!point) {
    return;
  }

  context.fillStyle = figure.style?.textColor ?? figure.style?.color ?? "#111827";
  context.font = `${figure.style?.fontSize ?? 12}px system-ui`;
  context.fillText(figure.text ?? "", point.x, point.y);
}

function drawOpenPath(context: CanvasRenderingContext2D, points: FigurePoint[]): void {
  if (points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.stroke();
}

function getPointDistance(a: FigurePoint, b: FigurePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getAngle(a: FigurePoint, b: FigurePoint): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
