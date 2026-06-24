import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import {
  createDrawingRenderer,
  drawLine,
  getAnchorPoints
} from "./drawingRendererHelpers";

export function createLineDrawingRenderers(): DrawingRenderer[] {
  return lineDrawingTypes.map((type) =>
    createDrawingRenderer(type, (context, drawing) => {
      const points = getAnchorPoints(drawing);
      const first = points[0];
      const second = points[1] ?? first;

      if (!first) {
        return;
      }

      if (type === "horizontalLine") {
        drawLine(context, { x: first.x - 80, y: first.y }, { x: first.x + 80, y: first.y });
        return;
      }

      if (type === "verticalLine") {
        drawLine(context, { x: first.x, y: first.y - 80 }, { x: first.x, y: first.y + 80 });
        return;
      }

      if (type === "crossLine") {
        drawLine(context, { x: first.x - 80, y: first.y }, { x: first.x + 80, y: first.y });
        drawLine(context, { x: first.x, y: first.y - 80 }, { x: first.x, y: first.y + 80 });
        return;
      }

      drawLine(context, first, second);
    })
  );
}

const lineDrawingTypes: DrawingType[] = [
  "trendLine",
  "ray",
  "extendedLine",
  "horizontalLine",
  "verticalLine",
  "crossLine"
];
