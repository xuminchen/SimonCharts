import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import {
  createDrawingRenderer,
  drawLine,
  drawText,
  getAnchorPoints
} from "./drawingRendererHelpers";

export function createTextDrawingRenderers(): DrawingRenderer[] {
  return textDrawingTypes.map((type) =>
    createDrawingRenderer(type, (context, drawing) => {
      const points = getAnchorPoints(drawing);
      const first = points[0];
      const second = points[1];

      if (!first) {
        return;
      }

      if (type === "callout" && second) {
        drawLine(context, first, second);
        drawText(context, drawing, second);
        return;
      }

      drawText(context, drawing, first);
    })
  );
}

const textDrawingTypes: DrawingType[] = ["text", "callout"];
