import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import {
  createDrawingRenderer,
  drawCircleFromPoints,
  drawPolyline,
  drawRectFromPoints,
  getAnchorPoints
} from "./drawingRendererHelpers";

export function createShapeDrawingRenderers(): DrawingRenderer[] {
  return shapeDrawingTypes.map((type) =>
    createDrawingRenderer(type, (context, drawing) => {
      const points = getAnchorPoints(drawing);
      const first = points[0];
      const second = points[1] ?? first;

      if (!first) {
        return;
      }

      if (type === "rectangle" || type === "rotatedRectangle") {
        drawRectFromPoints(context, first, second);
        return;
      }

      if (type === "circle") {
        drawCircleFromPoints(context, first, second);
        return;
      }

      if (type === "ellipse") {
        drawCircleFromPoints(context, first, second, 0.62);
        return;
      }

      drawPolyline(context, points, true);
    })
  );
}

const shapeDrawingTypes: DrawingType[] = [
  "rectangle",
  "rotatedRectangle",
  "circle",
  "ellipse",
  "polygon"
];
