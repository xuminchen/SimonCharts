import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import { getDrawingParameterLabel } from "../../../drawing/drawingParameters";
import { createDrawingRenderer, drawRectFromPoints, drawText, getAnchorPoints } from "./drawingRendererHelpers";

export function createRangeDrawingRenderers(): DrawingRenderer[] {
  return [
    createDrawingRenderer("datePriceRange", (context, drawing) => {
      const points = getAnchorPoints(drawing);
      const first = points[0];
      const second = points[1] ?? first;

      if (!first) {
        return;
      }

      drawRectFromPoints(context, first, second);
      drawText(context, { ...drawing, text: drawing.text ?? getDrawingParameterLabel(drawing, "rangeLabel", "Range") }, first);
    })
  ];
}
