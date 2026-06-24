import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import { createDrawingRenderer, drawLine, drawPolyline, getAnchorPoints } from "./drawingRendererHelpers";

export function createPathDrawingRenderers(): DrawingRenderer[] {
  return pathDrawingTypes.map((type) =>
    createDrawingRenderer(type, (context, drawing) => {
      const points = getAnchorPoints(drawing);

      if (points.length === 0) {
        return;
      }

      drawPolyline(context, points);

      if (type !== "arrow" || points.length < 2) {
        return;
      }

      const end = points[points.length - 1];
      const beforeEnd = points[points.length - 2];
      const angle = Math.atan2(end.y - beforeEnd.y, end.x - beforeEnd.x);
      const size = 8;

      drawLine(context, end, {
        x: end.x - Math.cos(angle - Math.PI / 6) * size,
        y: end.y - Math.sin(angle - Math.PI / 6) * size
      });
      drawLine(context, end, {
        x: end.x - Math.cos(angle + Math.PI / 6) * size,
        y: end.y - Math.sin(angle + Math.PI / 6) * size
      });
    })
  );
}

const pathDrawingTypes: DrawingType[] = ["path", "brush", "arrow"];
