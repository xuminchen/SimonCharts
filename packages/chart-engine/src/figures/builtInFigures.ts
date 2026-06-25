import type { FigureObject, FigureRenderer, FigureType } from "./figureTypes";

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
  context.strokeStyle = figure.style?.color ?? "#111827";
  context.fillStyle = figure.style?.fill ?? "rgba(17,24,39,0.12)";
  context.lineWidth = figure.style?.lineWidth ?? 2;
  context.setLineDash(figure.style?.lineDash ?? []);

  if (figure.type === "text" || figure.type === "label") {
    const point = figure.points[0];

    if (point) {
      context.fillStyle = figure.style?.textColor ?? figure.style?.color ?? "#111827";
      context.font = `${figure.style?.fontSize ?? 12}px system-ui`;
      context.fillText(figure.text ?? "", point.x, point.y);
    }

    context.restore();
    return;
  }

  drawPathFigure(context, figure);
  context.restore();
}

function drawPathFigure(context: CanvasRenderingContext2D, figure: FigureObject): void {
  if (figure.points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(figure.points[0].x, figure.points[0].y);

  for (const point of figure.points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  if (
    figure.type === "polygon" ||
    figure.type === "rect" ||
    figure.type === "rotatedRect" ||
    figure.type === "band"
  ) {
    context.closePath();
    context.fill();
  }

  context.stroke();
}
